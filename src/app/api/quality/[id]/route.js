import { jsonError } from "@/app/lib/api-response";
import { writeAuditLog } from "@/app/lib/audit";
import { getTenantModels } from "@/app/lib/tenant-db";
import { requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";

export async function PATCH(req, { params }) {
  try {
    const auth = requireTenantSession(req, "quality.manage");
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "quality.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { id } = await params;
    const body = await req.json();

    const { QcLog } = await getTenantModels(auth.tenantId);
    const log = await QcLog.findById(id);
    if (!log) return Response.json({ error: "QC log not found" }, { status: 404 });

    if (body.testName !== undefined) log.testName = String(body.testName).trim();
    if (body.instrument !== undefined) log.instrument = String(body.instrument).trim();
    if (body.lotNumber !== undefined) log.lotNumber = String(body.lotNumber).trim();
    if (body.result !== undefined) log.result = body.result;
    if (body.value !== undefined) log.value = String(body.value).trim();
    if (body.expectedRange !== undefined) log.expectedRange = String(body.expectedRange).trim();
    if (body.remarks !== undefined) log.remarks = String(body.remarks).trim();

    await log.save();

    await writeAuditLog(req, auth, {
      action: "quality.updated",
      resourceType: "QcLog",
      resourceId: log._id,
      metadata: { result: log.result },
    });

    return Response.json({ log });
  } catch (error) {
    return jsonError("Unable to update QC log", error, 500);
  }
}
