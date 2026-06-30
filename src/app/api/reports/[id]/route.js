import { jsonError } from "@/app/lib/api-response";
import { writeAuditLog } from "@/app/lib/audit";
import { getTenantModels } from "@/app/lib/tenant-db";
import { requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";

function clean(value) {
  return String(value || "").trim();
}

function isExponentialNotation(value) {
  if (typeof value === "string" && /[eE]/.test(value)) return true;
  return false;
}

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

    await writeAuditLog(req, auth, {
      action: "reports.accessed",
      resourceType: "TestReport",
      resourceId: report._id,
      metadata: { status: report.status },
    });

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

    const permissionMap = { save: "reports.edit", verify: "reports.verify", release: "reports.release", deliver: "reports.print" };
    const permission = permissionMap[action];
    if (!permission) return Response.json({ error: "Invalid action" }, { status: 400 });

    const auth = requireTenantSession(req, permission);
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "reports.view");
    if (moduleAuth.error) return moduleAuth.error;

    const isLabAdmin =
      auth.session?.permissions?.includes("*") ||
      ["admin", "lab admin"].includes(String(auth.session?.roleName || "").trim().toLowerCase());
    if ((action === "verify" || action === "release") && !isLabAdmin) {
      return Response.json({ error: "Only Lab Admin can verify or release reports" }, { status: 403 });
    }

    const { TestReport, BillingRecord } = await getTenantModels(auth.tenantId);
    const report = await TestReport.findById(id);
    if (!report) return Response.json({ error: "Report not found" }, { status: 404 });

    if (action === "verify" && (!report.results || report.results.length === 0)) {
      return Response.json({ error: "Draft results are required before verification" }, { status: 400 });
    }

    if (action === "save") {
      if (report.status !== "draft") {
        return Response.json({ error: "Only draft reports can be edited" }, { status: 400 });
      }
      if (body.results) {
        if (typeof body.results !== "object" || Array.isArray(body.results)) {
          return Response.json({ error: "Results must be an object" }, { status: 400 });
        }
        for (const [key, rawValue] of Object.entries(body.results)) {
          const textValue = clean(rawValue);
          if (textValue === "") continue;
          if (isExponentialNotation(textValue)) {
            return Response.json({ error: `Exponential notation (${textValue}) is not allowed in result values` }, { status: 400 });
          }
          if (!Number.isFinite(Number(textValue))) {
            return Response.json({ error: `Invalid numeric value "${textValue}" for result field` }, { status: 400 });
          }
        }
        report.results = body.results;
      }
      if (body.remarks !== undefined) report.remarks = body.remarks;
    } else {
      if (action === "deliver") {
        const billingRecord = report.billingRecord ? await BillingRecord.findById(report.billingRecord) : null;
        if (!billingRecord || billingRecord.billingStatus !== "paid") {
          return Response.json({ error: "Bill must be paid before report delivery" }, { status: 400 });
        }
      }

      const transitions = { verify: ["draft", "verified"], release: ["verified", "released"], deliver: ["released", "delivered"] };
      const [from, to] = transitions[action];
      if (report.status !== from) {
        return Response.json({ error: `Report must be in '${from}' status to ${action}` }, { status: 400 });
      }

      report.status = to;
    }
    await report.save();
    await report.populate("patient", "name patientId age gender phone");

    const auditAction =
      action === "save" ? "reports.saved" :
      action === "verify" ? "reports.verified" :
      action === "release" ? "reports.released" :
      "reports.delivered";

    await writeAuditLog(req, auth, {
      action: auditAction,
      resourceType: "TestReport",
      resourceId: report._id,
      metadata: { status: report.status, billingRecordId: report.billingRecord },
    });

    return Response.json({ report });
  } catch (error) {
    return jsonError("Unable to update report", error, 500);
  }
}

export async function DELETE(req, { params }) {
  try {
    const auth = requireTenantSession(req, "reports.delete");
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "reports.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { id } = await params;
    const { TestReport } = await getTenantModels(auth.tenantId);
    const report = await TestReport.findById(id);
    if (!report) return Response.json({ error: "Report not found" }, { status: 404 });
    if (report.status !== "draft") return Response.json({ error: "Only draft reports can be deleted" }, { status: 400 });

    await TestReport.findByIdAndDelete(id);

    await writeAuditLog(req, auth, {
      action: "reports.deleted",
      resourceType: "TestReport",
      resourceId: id,
      metadata: { status: report.status },
    });

    return Response.json({ success: true });
  } catch (error) {
    return jsonError("Unable to delete report", error, 500);
  }
}
