import { jsonError } from "@/app/lib/api-response";
import { getTenantModels } from "@/app/lib/tenant-db";
import { requireTenantSession } from "@/app/lib/auth";

export async function GET(req, { params }) {
  try {
    const auth = requireTenantSession(req, "billing.view");
    if (auth.error) return auth.error;

    const { tenantId } = auth;
    const { BillingRecord } = await getTenantModels(tenantId);
    const { id } = await params;

    const billingRecords = await BillingRecord.find({ patient: id })
      .populate("patient", "name patientId age gender phone")
      .select("billId patient items priority status notes subtotalAmount discountAmount taxAmount totalAmount billingStatus createdBy createdAt")
      .sort({ createdAt: -1 })
      .lean();

    return Response.json({ billingRecords });
  } catch (err) {
    return jsonError("Unable to load billing records", err, 500);
  }
}
