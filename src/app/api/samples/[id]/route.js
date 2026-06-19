import { jsonError } from "@/app/lib/api-response";
import { writeAuditLog } from "@/app/lib/audit";
import { getTenantModels } from "@/app/lib/tenant-db";
import { hasPermission, requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";

function clean(value) {
  return String(value || "").trim();
}

function deriveBillingStatus(items) {
  if (items.every((item) => item.status === "reported")) return "completed";
  if (items.some((item) => item.status !== "sample-pending")) return "in-progress";
  return "open";
}

export async function PUT(req, { params }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const action = body.action;
    const requiredPermission =
      action === "collect"
        ? "samples.collect"
        : action === "reject"
          ? "samples.reject"
          : "samples.update";

    const auth = requireTenantSession(req, requiredPermission);
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "samples.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { Sample, BillingRecord } = await getTenantModels(auth.tenantId);
    const sample = await Sample.findById(id);
    if (!sample) return Response.json({ error: "Sample not found" }, { status: 404 });

    const billingRecord = await BillingRecord.findById(sample.billingRecord);
    if (!billingRecord) {
      return Response.json({ error: "Sample collection requires an existing bill" }, { status: 400 });
    }
    if (billingRecord.billingStatus === "cancelled" || billingRecord.status === "cancelled") {
      return Response.json({ error: "Cannot update sample for a cancelled bill" }, { status: 400 });
    }

    if (action === "collect") {
      if (sample.status !== "pending") {
        return Response.json({ error: "Only pending samples can be collected" }, { status: 400 });
      }
      sample.status = "collected";
      sample.collectedAt = body.collectedAt ? new Date(body.collectedAt) : new Date();
      sample.collectorName = clean(body.collectorName) || auth.session.email;
      sample.rejectionReason = undefined;
    } else if (action === "processing") {
      if (sample.status !== "collected") {
        return Response.json({ error: "Sample must be collected before processing" }, { status: 400 });
      }
      sample.status = "processing";
    } else if (action === "reject") {
      sample.status = "rejected";
      sample.rejectionReason = clean(body.rejectionReason);
      if (!sample.rejectionReason) {
        return Response.json({ error: "Rejection reason is required" }, { status: 400 });
      }
    } else {
      return Response.json({ error: "Invalid sample action" }, { status: 400 });
    }

    await sample.save();

    if (billingRecord) {
      const item = billingRecord.items.id(sample.billingItemId);
      if (item) {
        item.status =
          sample.status === "collected"
            ? "sample-collected"
            : sample.status === "processing"
              ? "processing"
              : sample.status;
      }
      billingRecord.status = deriveBillingStatus(billingRecord.items);
      await billingRecord.save();
    }

    await writeAuditLog(req, auth, {
      action:
        sample.status === "collected"
          ? "samples.collected"
          : sample.status === "processing"
            ? "samples.processing"
            : "samples.rejected",
      resourceType: "Sample",
      resourceId: sample._id,
      metadata: { billingRecordId: billingRecord._id, status: sample.status },
    });

    await sample.populate("patient", "name patientId age gender phone");
    await sample.populate("billingRecord", "billId priority status");

    return Response.json({ sample });
  } catch (error) {
    return jsonError("Unable to update sample", error, 500);
  }
}
