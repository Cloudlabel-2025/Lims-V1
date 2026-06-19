import { jsonError } from "@/app/lib/api-response";
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
