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

function getFlag(parameter, rawValue) {
  if (rawValue === "" || rawValue === null || rawValue === undefined) return "not-entered";

  const value = Number(rawValue);
  if (!Number.isFinite(value)) return "normal";
  if (Number.isFinite(parameter.normalMin) && value < parameter.normalMin) return "low";
  if (Number.isFinite(parameter.normalMax) && value > parameter.normalMax) return "high";
  return "normal";
}

export async function GET(req) {
  try {
    const auth = requireTenantSession(req, "reports.view");
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "reports.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { searchParams } = new URL(req.url);
    const patientId = clean(searchParams.get("patientId"));
    const query = {};
    if (patientId) query.patient = patientId;

    // Doctor Regular: scope reports to patients referred by this doctor only
    if (auth.session.userType === "tenant" && auth.session.doctorId) {
      const { BillingRecord } = await getTenantModels(auth.tenantId);
      const referredPatientIds = await BillingRecord.distinct("patient", {
        referralDoctor: auth.session.doctorId,
      });
      query.patient = patientId
        ? { $in: referredPatientIds.map(String).includes(patientId) ? [patientId] : [] }
        : { $in: referredPatientIds };
    }

    const { TestReport } = await getTenantModels(auth.tenantId);
    const reports = await TestReport.find(query)
      .populate("patient", "name patientId age gender phone")
      .select("reportId patient testDefinition testSnapshot results remarks status enteredBy createdAt updatedAt")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return Response.json({ reports });
  } catch (error) {
    return jsonError("Unable to load reports", error, 500);
  }
}

export async function POST(req) {
  try {
    const auth = requireTenantSession(req, "reports.edit");
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "reports.view");
    if (moduleAuth.error) return moduleAuth.error;

    const body = await req.json();
    const sampleId = clean(body.sample);
    let patientId = clean(body.patient);
    let testDefinitionId = clean(body.testDefinition);

    const { Patient, TestDefinition, TestReport, Sample, BillingRecord, QcLog } = await getTenantModels(auth.tenantId);

    if (!sampleId) {
      return Response.json({ error: "Sample is required for result entry" }, { status: 400 });
    }

    const sample = await Sample.findById(sampleId);
    if (!sample) return Response.json({ error: "Sample not found" }, { status: 404 });
    if (!["collected", "processing"].includes(sample.status)) {
      return Response.json({ error: "Sample must be collected before result entry" }, { status: 400 });
    }
    patientId = String(sample.patient);
    testDefinitionId = String(sample.testDefinition);

    const qcPass = await QcLog.findOne({
      sample: sample._id,
      tenantId: auth.tenantId,
      result: "pass",
    }).sort({ createdAt: -1 });

    if (!qcPass) {
      return Response.json({ error: "QC approval is required before result entry" }, { status: 400 });
    }

    if (!patientId) return Response.json({ error: "Patient is required" }, { status: 400 });
    if (!testDefinitionId) return Response.json({ error: "Test is required" }, { status: 400 });

    const [patient, test] = await Promise.all([
      Patient.findById(patientId),
      TestDefinition.findById(testDefinitionId).populate("category", "name"),
    ]);

    if (!patient) return Response.json({ error: "Patient not found" }, { status: 404 });
    if (!test || test.status !== "active") {
      return Response.json({ error: "Active test definition not found" }, { status: 404 });
    }

    const values = body.results || {};

    for (const [key, rawValue] of Object.entries(values)) {
      const textValue = clean(rawValue);
      if (textValue === "") continue;
      if (isExponentialNotation(textValue)) {
        return Response.json({ error: `Exponential notation (${textValue}) is not allowed in result values` }, { status: 400 });
      }
      if (!Number.isFinite(Number(textValue))) {
        return Response.json({ error: `Invalid numeric value "${textValue}" for result field` }, { status: 400 });
      }
    }

    const missingRequired = [];
    const results = test.parameters
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((parameter) => {
        const rawValue = values[parameter.key];
        const textValue = clean(rawValue);
        const numericValue = textValue === "" ? undefined : Number(textValue);

        if (parameter.required && textValue === "") {
          missingRequired.push(parameter.name);
        }

        return {
          key: parameter.key,
          name: parameter.name,
          unit: parameter.unit,
          normalMin: parameter.normalMin,
          normalMax: parameter.normalMax,
          required: parameter.required,
          value: Number.isFinite(numericValue) ? numericValue : undefined,
          textValue,
          flag: getFlag(parameter, textValue),
        };
      });

    if (missingRequired.length > 0) {
      return Response.json(
        { error: `Missing required results: ${missingRequired.join(", ")}` },
        { status: 400 }
      );
    }

    const report = await TestReport.create({
      patient: patient._id,
      testDefinition: test._id,
      sample: sample._id,
      billingRecord: sample.billingRecord,
      testSnapshot: {
        testId: test.testId,
        name: test.name,
        code: test.code,
        categoryName: test.category?.name,
        sampleType: test.sampleType,
      },
      results,
      remarks: clean(body.remarks),
      status: "draft",
      enteredBy: auth.session.email,
    });

    sample.status = "reported";
    await sample.save();

    const billingRecord = await BillingRecord.findById(sample.billingRecord);
    if (billingRecord) {
      const item = billingRecord.items.id(sample.billingItemId);
      if (item) item.status = "reported";
      billingRecord.status = billingRecord.items.every((billingItem) => billingItem.status === "reported")
        ? "completed"
        : "in-progress";
      await billingRecord.save();
    }

    await report.populate("patient", "name patientId age gender phone");

    await writeAuditLog(req, auth, {
      action: "reports.draft_created",
      resourceType: "TestReport",
      resourceId: report._id,
      metadata: { sampleId: sample._id, billingRecordId: sample.billingRecord },
    });

    return Response.json({ report }, { status: 201 });
  } catch (error) {
    return jsonError("Unable to create report", error, 500);
  }
}
