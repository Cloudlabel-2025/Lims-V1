import { jsonError } from "@/app/lib/api-response";
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
    return jsonError("Unable to load report", error, 500);
  }
}

export async function PATCH(req, { params }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const action = String(body.action || "");

    const permissionMap = { verify: "reports.verify", release: "reports.release" };
    const permission = permissionMap[action];
    if (!permission) return Response.json({ error: "Invalid action" }, { status: 400 });

    const auth = requireTenantSession(req, permission);
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "reports.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { TestReport } = await getTenantModels(auth.tenantId);
    const report = await TestReport.findById(id);
    if (!report) return Response.json({ error: "Report not found" }, { status: 404 });

    const transitions = { verify: ["completed", "verified"], release: ["verified", "released"] };
    const [from, to] = transitions[action];
    if (report.status !== from) {
      return Response.json({ error: `Report must be in '${from}' status to ${action}` }, { status: 400 });
    }

    report.status = to;
    await report.save();
    await report.populate("patient", "name patientId age gender phone");

    return Response.json({ report });
  } catch (error) {
    return jsonError("Unable to update report", error, 500);
  }
}
