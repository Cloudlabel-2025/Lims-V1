import { getTenantModels } from "@/app/lib/tenant-db";
import { requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";

export async function GET(req, { params }) {
  try {
    const auth = requireTenantSession(req, "reports.view");
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "reports.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { id } = await params;
    const { TestReport } = await getTenantModels(auth.tenantId);
    const report = await TestReport.findById(id).populate("patient", "name patientId age gender phone address");

    if (!report) {
      return Response.json({ error: "Report not found" }, { status: 404 });
    }

    return Response.json({ report });
  } catch (error) {
    return Response.json({ error: "Unable to load report", details: error.message }, { status: 500 });
  }
}
