import { getTenantModels } from "@/app/lib/tenant-db";
import { requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";

function clean(value) {
  return String(value || "").trim();
}

export async function GET(req) {
  try {
    const auth = requireTenantSession(req, "orders.view");
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "orders.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const query = {};
    if (status && status !== "all") query.status = status;

    const { LabOrder } = await getTenantModels(auth.tenantId);
    const orders = await LabOrder.find(query)
      .populate("patient", "name patientId age gender phone")
      .sort({ createdAt: -1 })
      .limit(100);

    return Response.json({ orders });
  } catch (error) {
    return Response.json({ error: "Unable to load orders", details: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const auth = requireTenantSession(req, "orders.create");
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "orders.view");
    if (moduleAuth.error) return moduleAuth.error;

    const body = await req.json();
    const patientId = clean(body.patient);
    const testIds = Array.isArray(body.tests) ? body.tests.map(clean).filter(Boolean) : [];

    if (!patientId) return Response.json({ error: "Patient is required" }, { status: 400 });
    if (testIds.length === 0) {
      return Response.json({ error: "At least one test is required" }, { status: 400 });
    }

    const { Patient, TestDefinition, LabOrder, Sample } = await getTenantModels(auth.tenantId);
    const patient = await Patient.findById(patientId);
    if (!patient) return Response.json({ error: "Patient not found" }, { status: 404 });

    const tests = await TestDefinition.find({ _id: { $in: testIds }, status: "active" }).populate("category", "name");
    if (tests.length !== testIds.length) {
      return Response.json({ error: "One or more selected tests are inactive or missing" }, { status: 400 });
    }

    const items = tests.map((test) => ({
      testDefinition: test._id,
      testSnapshot: {
        testId: test.testId,
        name: test.name,
        code: test.code,
        categoryName: test.category?.name,
        sampleType: test.sampleType,
        price: test.price,
      },
      status: "sample-pending",
    }));

    const order = await LabOrder.create({
      patient: patient._id,
      items,
      priority: body.priority === "urgent" ? "urgent" : "routine",
      notes: clean(body.notes),
      createdBy: auth.session.email,
    });

    const samples = await Sample.insertMany(
      order.items.map((item) => ({
        order: order._id,
        orderItemId: item._id,
        patient: patient._id,
        testDefinition: item.testDefinition,
        testSnapshot: item.testSnapshot,
      }))
    );

    await order.populate("patient", "name patientId age gender phone");

    return Response.json({ order, samples }, { status: 201 });
  } catch (error) {
    return Response.json({ error: "Unable to create order", details: error.message }, { status: 500 });
  }
}
