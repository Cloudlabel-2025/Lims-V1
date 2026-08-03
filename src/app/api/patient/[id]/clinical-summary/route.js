import mongoose from "mongoose";
import { jsonError } from "@/app/lib/api-response";
import { getTenantModels } from "@/app/lib/tenant-db";
import { requireTenantSession } from "@/app/lib/auth";

const VERIFIED_REPORT_STATUSES = ["approved", "released"];

function normalizeMetricName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function hasResultValue(result) {
  return result?.textValue !== "" && result?.textValue !== undefined && result?.textValue !== null
    ? true
    : Number.isFinite(result?.value);
}

function getResultValue(result) {
  if (result?.textValue !== "" && result?.textValue !== undefined && result?.textValue !== null) {
    return String(result.textValue);
  }
  return Number.isFinite(result?.value) ? String(result.value) : null;
}

function metricFromResult(report, result, overrides = {}) {
  return {
    label: overrides.label || result.name,
    value: overrides.value || getResultValue(result),
    unit: overrides.unit ?? result.unit ?? "",
    flag: overrides.flag || result.flag || "normal",
    recordedAt: report.releasedAt || report.approvedAt || report.updatedAt || report.createdAt,
    reportId: report.reportId,
    testName: report.testSnapshot?.name || "Laboratory report",
  };
}

function metricNames(result) {
  return [normalizeMetricName(result?.key), normalizeMetricName(result?.name)].filter(Boolean);
}

function isSystolic(result) {
  return metricNames(result).some((name) => name.includes("systolic") || name === "sys" || name === "sbp");
}

function isDiastolic(result) {
  return metricNames(result).some((name) => name.includes("diastolic") || name === "dia" || name === "dbp");
}

function isCombinedBloodPressure(result) {
  return metricNames(result).some((name) => name.includes("bloodpressure") || name === "bp");
}

function isBloodSugar(result) {
  return metricNames(result).some((name) => (
    [
      "bloodsugar",
      "bloodglucose",
      "fastingbloodsugar",
      "fastingglucose",
      "postprandialbloodsugar",
      "postprandialglucose",
    ].some((alias) => name.includes(alias)) || ["glucose", "fbs", "ppbs", "rbs", "hba1c"].includes(name)
  ));
}

function findLatestHealthMetrics(reports) {
  let bloodPressure = null;
  let bloodSugar = null;

  for (const report of reports) {
    const results = (report.results || []).filter(hasResultValue);

    if (!bloodPressure) {
      const systolic = results.find(isSystolic);
      const diastolic = results.find(isDiastolic);
      const combined = results.find(isCombinedBloodPressure);

      if (systolic && diastolic) {
        bloodPressure = metricFromResult(report, systolic, {
          label: "Blood pressure",
          value: `${getResultValue(systolic)}/${getResultValue(diastolic)}`,
          unit: systolic.unit || diastolic.unit || "mmHg",
          flag: systolic.flag !== "normal" ? systolic.flag : diastolic.flag,
        });
      } else if (combined) {
        bloodPressure = metricFromResult(report, combined, { label: "Blood pressure" });
      }
    }

    if (!bloodSugar) {
      const sugar = results.find(isBloodSugar);
      if (sugar) bloodSugar = metricFromResult(report, sugar, { label: sugar.name || "Blood sugar" });
    }

    if (bloodPressure && bloodSugar) break;
  }

  return { bloodPressure, bloodSugar };
}

export async function GET(req, { params }) {
  try {
    const auth = requireTenantSession(req, "patients.view");
    if (auth.error) return auth.error;

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return Response.json({ error: "Patient not found" }, { status: 404 });
    }

    const { Patient, BillingRecord, TestReport } = await getTenantModels(auth.tenantId);
    const patient = await Patient.findById(id).select("_id").lean();
    if (!patient) return Response.json({ error: "Patient not found" }, { status: 404 });

    const visitQuery = { patient: id, status: { $ne: "cancelled" } };
    if (auth.session.doctorId) {
      visitQuery.tenantId = auth.tenantId;
      visitQuery.referralDoctor = auth.session.doctorId;
      const ownsReferral = await BillingRecord.exists(visitQuery);
      if (!ownsReferral) return Response.json({ error: "Patient not found" }, { status: 404 });
    }

    const [visitCount, lastVisit, reports] = await Promise.all([
      BillingRecord.countDocuments(visitQuery),
      BillingRecord.findOne(visitQuery)
        .select("billId status createdAt")
        .sort({ createdAt: -1 })
        .lean(),
      TestReport.find({ patient: id, status: { $in: VERIFIED_REPORT_STATUSES } })
        .select("reportId testSnapshot results status approvedAt releasedAt createdAt updatedAt")
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
    ]);

    return Response.json({
      visitCount,
      lastVisit: lastVisit
        ? { billId: lastVisit.billId, status: lastVisit.status, date: lastVisit.createdAt }
        : null,
      healthMetrics: findLatestHealthMetrics(reports),
    });
  } catch (error) {
    return jsonError("Unable to load patient clinical summary", error, 500);
  }
}
