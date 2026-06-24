import { jsonError } from "@/app/lib/api-response";
import { writeAuditLog } from "@/app/lib/audit";
import { getTenantModels } from "@/app/lib/tenant-db";
import { requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";

const URL_RE = /https?:\/\//;
const EXP_RE = /[eE]/;
const SAFE_TEXT = /^[A-Za-z0-9 .&'\/,()@_-]*$/;

function isValidName(v) {
  return !v || SAFE_TEXT.test(v);
}
function hasUrl(v) {
  return v && URL_RE.test(v);
}
function isExponential(v) {
  return v && EXP_RE.test(v);
}

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

    if (body.testName !== undefined) {
      const v = String(body.testName).trim();
      if (!isValidName(v)) return Response.json({ error: "Test name contains invalid characters" }, { status: 400 });
      if (hasUrl(v)) return Response.json({ error: "URLs are not allowed in test name" }, { status: 400 });
      log.testName = v;
    }
    if (body.instrument !== undefined) {
      const v = String(body.instrument).trim();
      if (!isValidName(v)) return Response.json({ error: "Instrument contains invalid characters" }, { status: 400 });
      if (hasUrl(v)) return Response.json({ error: "URLs are not allowed in instrument" }, { status: 400 });
      log.instrument = v;
    }
    if (body.lotNumber !== undefined) {
      const v = String(body.lotNumber).trim();
      if (!isValidName(v)) return Response.json({ error: "Lot number contains invalid characters" }, { status: 400 });
      if (hasUrl(v)) return Response.json({ error: "URLs are not allowed in lot number" }, { status: 400 });
      log.lotNumber = v;
    }
    if (body.result !== undefined) log.result = body.result;
    if (body.value !== undefined) {
      const v = String(body.value).trim();
      if (isExponential(v)) return Response.json({ error: "Exponential notation is not allowed in observed value" }, { status: 400 });
      log.value = v;
    }
    if (body.expectedRange !== undefined) {
      const v = String(body.expectedRange).trim();
      if (isExponential(v)) return Response.json({ error: "Exponential notation is not allowed in expected range" }, { status: 400 });
      log.expectedRange = v;
    }
    if (body.remarks !== undefined) {
      const v = String(body.remarks).trim();
      if (hasUrl(v)) return Response.json({ error: "URLs are not allowed in remarks" }, { status: 400 });
      log.remarks = v;
    }

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
