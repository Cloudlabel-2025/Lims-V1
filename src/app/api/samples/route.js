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
    const query = {};
    if (status && status !== "all") query.status = status;

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

export async function POST(req) {
  try {
    const auth = requireTenantSession(req, "samples.create");
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "samples.view");
    if (moduleAuth.error) return moduleAuth.error;

    const body = await req.json();
    const { Patient, TestDefinition, Sample } = await getTenantModels(auth.tenantId);

    const patientId = body.patient;
    const testDefinitionId = body.testDefinition;
    const sampleType = String(body.sampleType || "").trim();
    const batchId = String(body.batchId || "").trim();

    if (!patientId) {
      return Response.json({ error: "Patient is required" }, { status: 400 });
    }
    if (!testDefinitionId) {
      return Response.json({ error: "Test definition is required" }, { status: 400 });
    }

    const [patient, test] = await Promise.all([
      Patient.findById(patientId),
      TestDefinition.findById(testDefinitionId),
    ]);

    if (!patient) return Response.json({ error: "Patient not found" }, { status: 404 });
    if (!test || test.status !== "active") {
      return Response.json({ error: "Active test definition not found" }, { status: 404 });
    }

    const sample = await Sample.create({
      patient: patient._id,
      sampleType: sampleType || test.sampleType || undefined,
      batchId: batchId || undefined,
      receivedAt: new Date(),
      receivedBy: auth.session.email,
      testDefinition: test._id,
      testSnapshot: {
        testId: test.testId,
        name: test.name,
        code: test.code,
        categoryName: test.category?.name,
        sampleType: test.sampleType,
      },
      status: "registered",
    });

    sample.addCustodyEntry("status:created -> registered", auth.session.email, "Sample registered");
    await sample.save();

    await sample.populate("patient", "name patientId age gender phone");

    return Response.json({ sample }, { status: 201 });
  } catch (error) {
    return jsonError("Unable to register sample", error, 500);
  }
}
