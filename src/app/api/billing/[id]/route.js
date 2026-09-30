import { jsonError } from "@/app/lib/api-response";
import { writeAuditLog } from "@/app/lib/audit";
import { getTenantModels } from "@/app/lib/tenant-db";
import { hasPermission, requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";

export async function GET(req, { params }) {
  try {
    const auth = requireTenantSession(req, "billing.view");
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "billing.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { id } = await params;
    const { BillingRecord, Sample } = await getTenantModels(auth.tenantId);
    const canViewSamples = hasPermission(auth.session, "samples.view");
    const [billingRecord, samples] = await Promise.all([
      BillingRecord.findById(id).populate("patient", "name patientId age gender phone"),
      canViewSamples ? Sample.find({ billingRecord: id }).populate("patient", "name patientId") : Promise.resolve([]),
    ]);

    if (!billingRecord) return Response.json({ error: "Billing record not found" }, { status: 404 });

    return Response.json({ billingRecord, ...(canViewSamples ? { samples } : {}) });
  } catch (error) {
    return jsonError("Unable to load billing record", error, 500);
  }
}

export async function PATCH(req, { params }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const action = String(body.action || "");

    if (action === "update") {
      const auth = requireTenantSession(req, "billing.update");
      if (auth.error) return auth.error;

      const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "billing.view");
      if (moduleAuth.error) return moduleAuth.error;

      const { BillingRecord } = await getTenantModels(auth.tenantId);
      const billingRecord = await BillingRecord.findById(id);
      if (!billingRecord) return Response.json({ error: "Billing record not found" }, { status: 404 });
      if (billingRecord.billingStatus === "paid" || billingRecord.billingStatus === "cancelled") {
        return Response.json({ error: "Cannot edit a paid or cancelled bill" }, { status: 400 });
      }

      if (body.discountAmount !== undefined) {
        const attemptedDiscount = Number(body.discountAmount) || 0;
        if (attemptedDiscount > 0 && !hasPermission(auth.session, "billing.discount")) {
          await writeAuditLog(req, auth, {
            action: "billing.discount_denied",
            resourceType: "BillingRecord",
            resourceId: billingRecord._id,
            metadata: {
              attemptedDiscount,
              reason: "Unauthorized discount: billing.discount permission required",
              actor: auth.session.email || auth.session.userId,
            },
          });
          return Response.json({ error: "No permission to apply discounts" }, { status: 403 });
        }
        const subtotal = billingRecord.subtotalAmount || 0;
        if (attemptedDiscount > subtotal) {
          await writeAuditLog(req, auth, {
            action: "billing.excessive_discount_blocked",
            resourceType: "BillingRecord",
            resourceId: billingRecord._id,
            metadata: {
              attemptedDiscount,
              subtotal,
              reason: "Excessive discount: cannot exceed bill subtotal",
              actor: auth.session.email || auth.session.userId,
            },
          });
          return Response.json({ error: "Discount amount cannot exceed bill subtotal" }, { status: 400 });
        }
        billingRecord.discountAmount = Math.max(0, attemptedDiscount);
      }
      if (body.taxAmount !== undefined) {
        const subtotal = billingRecord.subtotalAmount || 0;
        billingRecord.taxAmount = Math.min(Math.max(0, Number(body.taxAmount) || 0), subtotal);
      }
      if (body.notes !== undefined) billingRecord.notes = body.notes;

      billingRecord.totalAmount = Math.max(0, (billingRecord.subtotalAmount || 0) - (billingRecord.discountAmount || 0) + (billingRecord.taxAmount || 0));
      await billingRecord.save();

      await writeAuditLog(req, auth, {
        action: "billing.updated",
        resourceType: "BillingRecord",
        resourceId: billingRecord._id,
        metadata: { discountAmount: billingRecord.discountAmount, taxAmount: billingRecord.taxAmount },
      });

      return Response.json({ billingRecord, message: "Bill updated successfully" });
    }

    if (action !== "cancel") {
      return Response.json({ error: "Invalid action" }, { status: 400 });
    }

    const auth = requireTenantSession(req, "billing.cancel");
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "billing.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { BillingRecord } = await getTenantModels(auth.tenantId);
    const billingRecord = await BillingRecord.findById(id);

    if (!billingRecord) {
      return Response.json({ error: "Billing record not found" }, { status: 404 });
    }

    if (billingRecord.billingStatus === "cancelled") {
      return Response.json({ error: "Bill is already cancelled" }, { status: 400 });
    }

    if (billingRecord.billingStatus === "partial") {
      return Response.json({ error: "Cannot cancel a partially paid bill — revert it instead" }, { status: 400 });
    }

    if (billingRecord.billingStatus === "paid") {
      return Response.json({ error: "Cannot cancel a paid bill. Issue a refund instead." }, { status: 400 });
    }

    const reason = String(body.reason || "").trim().slice(0, 150);
    if (!reason) {
      return Response.json({ error: "Cancellation reason is required" }, { status: 400 });
    }

    billingRecord.billingStatus = "cancelled";
    billingRecord.invoiceStatus = "cancelled";
    billingRecord.status = "cancelled";
    billingRecord.cancelledAt = new Date();
    billingRecord.cancelledBy = auth.session.userId;
    billingRecord.cancellationReason = reason;
    await billingRecord.save();

    await writeAuditLog(req, auth, {
      action: "billing.cancelled",
      resourceType: "BillingRecord",
      resourceId: billingRecord._id,
      metadata: { reason: billingRecord.cancellationReason },
    });

    return Response.json({ billingRecord, message: "Bill cancelled successfully" });
  } catch (error) {
    return jsonError("Unable to cancel billing record", error, 500);
  }
}
