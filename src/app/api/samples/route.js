import { jsonError } from "@/app/lib/api-response";
import { getTenantModels } from "@/app/lib/tenant-db";
import { requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";

export async function GET(req) {
  try {
    const auth = requireTenantSession(req, "samples.view");
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "samples.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const collectorName = searchParams.get("collectorName");
    const query = {};
    if (status && status !== "all") query.status = status;
    if (collectorName) {
      query.collectorName = { $regex: collectorName, $options: "i" };
    }

    const { Sample } = await getTenantModels(auth.tenantId);
    const samples = await Sample.find(query)
      .populate("patient", "name patientId age gender phone")
      .populate("billingRecord", "billId priority status")
      .sort({ createdAt: -1 })
      .limit(150);

    return Response.json({ samples });
  } catch (error) {
    return jsonError("Unable to load samples", error, 500);
  }
}
