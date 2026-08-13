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
    const { TestReport, BillingRecord, User } = await getTenantModels(auth.tenantId);
    const reportDoc = await TestReport.findById(id)
      .populate("patient", "name patientId age gender phone address")
      .populate("billingRecord", "billId");

    if (!reportDoc) {
      return Response.json({ error: "Report not found" }, { status: 404 });
    }

    const report = reportDoc.toObject();

    const resolveNameAndRole = async (identifier) => {
      if (!identifier) return identifier;
      if (identifier.includes("(")) return identifier;

      const query = identifier.includes("@")
        ? { email: identifier.toLowerCase() }
        : { userId: identifier.toUpperCase() };

      const userDoc = await User.findOne(query).populate("role").lean();
      if (userDoc) {
        const fullName = [userDoc.firstName, userDoc.lastName].filter(Boolean).join(" ").trim();
        if (fullName) {
          return userDoc.role?.name
            ? `${fullName} (${userDoc.role.name})`
            : fullName;
        }
      }
      return identifier;
    };

    report.reviewedBy = await resolveNameAndRole(report.reviewedBy);
    report.approvedBy = await resolveNameAndRole(report.approvedBy);
    report.releasedBy = await resolveNameAndRole(report.releasedBy);

    if (auth.session.doctorId) {
      const ownsReferral = report.status === "released" && report.billingRecord
        ? await BillingRecord.exists({
            _id: report.billingRecord?._id || report.billingRecord,
            tenantId: auth.tenantId,
            referralDoctor: auth.session.doctorId,
          })
        : null;
      if (!ownsReferral) return Response.json({ error: "Report not found" }, { status: 404 });
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

    const permissionMap = {
      save: "reports.edit",
      review: "reports.verify",
      approve: "reports.verify",
      release: "reports.release",
    };
    const permission = permissionMap[action];
    if (!permission) return Response.json({ error: "Invalid action" }, { status: 400 });

    const auth = requireTenantSession(req, permission);
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "reports.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { TestReport } = await getTenantModels(auth.tenantId);
    const report = await TestReport.findById(id);
    if (!report) return Response.json({ error: "Report not found" }, { status: 404 });

    if (action === "save") {
      if (report.status !== "draft") {
        return Response.json({ error: "Only draft reports can be edited" }, { status: 400 });
      }
      if (body.results) {
        if (typeof body.results !== "object" || Array.isArray(body.results)) {
          return Response.json({ error: "Results must be an object" }, { status: 400 });
        }
        for (const rawValue of Object.values(body.results)) {
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
      if (body.template !== undefined) report.template = body.template;
    } else {
      const transitions = {
        review: { from: "draft", to: "reviewed" },
        approve: { from: "reviewed", to: "approved" },
        release: { from: "approved", to: "released" },
      };

      const transition = transitions[action];
      if (!transition) return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });

      if (report.status !== transition.from) {
        return Response.json({
          error: `Report must be in '${transition.from}' status to ${action}`,
        }, { status: 400 });
      }

      if (action === "review" && (!report.results || report.results.length === 0)) {
        return Response.json({ error: "Results are required before review" }, { status: 400 });
      }

      // Create a version snapshot before status transition (except initial save)
      report.createNewVersion();

      report.status = transition.to;

      // Record the action timestamp and user
      const now = new Date();
      let displayName = "Unknown";
      if (auth.session.name) {
        displayName = auth.session.roleName
          ? `${auth.session.name} (${auth.session.roleName})`
          : auth.session.name;
      } else if (auth.session.email) {
        displayName = auth.session.email;
      }

      if (action === "review") {
        report.reviewedAt = now;
        report.reviewedBy = displayName;
      } else if (action === "approve") {
        report.approvedAt = now;
        report.approvedBy = displayName;
      } else if (action === "release") {
        report.releasedAt = now;
        report.releasedBy = displayName;

        try {
          const { BillingRecord, Doctor, Patient, Notification } = await getTenantModels(auth.tenantId);
          let refDoctorId = null;

          if (report.billingRecord) {
            const bill = await BillingRecord.findById(report.billingRecord).select("referralDoctor").lean();
            if (bill?.referralDoctor) refDoctorId = bill.referralDoctor;
          }

          if (!refDoctorId && report.patient) {
            const pat = await Patient.findById(report.patient).select("refDoctor refDoctorName").lean();
            if (pat?.refDoctor) {
              refDoctorId = pat.refDoctor;
            } else if (pat?.refDoctorName && Doctor) {
              const doc = await Doctor.findOne({ name: new RegExp(`^${pat.refDoctorName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") }).select("_id").lean();
              if (doc) refDoctorId = doc._id;
            }
          }

          if (refDoctorId && Notification) {
            const patName = report.patient?.name || "Patient";
            await Notification.create({
              tenantId: auth.tenantId,
              recipientType: "doctor",
              recipientId: refDoctorId,
              title: "📄 Diagnostic Report Released",
              message: `Diagnostic test report for patient ${patName} has been verified and released by the laboratory.`,
              type: "report_released",
              link: "/doctor/dashboard",
            }).catch(() => {});
          }
        } catch (e) {
          console.error("Error triggering doctor report notification:", e);
        }
      }
    }

    await report.save();
    await report.populate("patient", "name patientId age gender phone");

    const auditActionMap = {
      save: "reports.saved",
      review: "reports.reviewed",
      approve: "reports.approved",
      release: "reports.released",
    };

    await writeAuditLog(req, auth, {
      action: auditActionMap[action] || "reports.updated",
      resourceType: "TestReport",
      resourceId: report._id,
      metadata: { status: report.status, version: report.version },
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
