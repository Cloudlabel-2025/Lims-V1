import { getTenantModels } from "@/app/lib/tenant-db";
import { requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";

function clean(value) {
  return String(value || "").trim();
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

    const { TestReport } = await getTenantModels(auth.tenantId);
    const reports = await TestReport.find(query)
      .populate("patient", "name patientId age gender phone")
      .sort({ createdAt: -1 })
      .limit(100);

    return Response.json({ reports });
  } catch (error) {
    return Response.json({ error: "Unable to load reports", details: error.message }, { status: 500 });
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

    const { Patient, TestDefinition, TestReport, Sample, LabOrder } = await getTenantModels(auth.tenantId);
    let sample = null;

    if (sampleId) {
      sample = await Sample.findById(sampleId);
      if (!sample) return Response.json({ error: "Sample not found" }, { status: 404 });
      if (!["collected", "processing"].includes(sample.status)) {
        return Response.json({ error: "Sample must be collected before result entry" }, { status: 400 });
      }
      patientId = String(sample.patient);
      testDefinitionId = String(sample.testDefinition);
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
      testSnapshot: {
        testId: test.testId,
        name: test.name,
        code: test.code,
        categoryName: test.category?.name,
        sampleType: test.sampleType,
      },
      results,
      remarks: clean(body.remarks),
      status: body.status || "completed",
      enteredBy: auth.session.email,
    });

    if (sample) {
      sample.status = "reported";
      await sample.save();

      const order = await LabOrder.findById(sample.order);
      if (order) {
        const item = order.items.id(sample.orderItemId);
        if (item) item.status = "reported";
        order.status = order.items.every((orderItem) => orderItem.status === "reported")
          ? "completed"
          : "in-progress";
        await order.save();
      }
    }

    await report.populate("patient", "name patientId age gender phone");

    return Response.json({ report }, { status: 201 });
  } catch (error) {
    return Response.json({ error: "Unable to create report", details: error.message }, { status: 500 });
  }
}
