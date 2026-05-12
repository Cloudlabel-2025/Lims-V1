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
      .populate("referralDoctor", "name doctorId commission pendingPayout")
      .sort({ createdAt: -1 })
      .limit(100);

    return Response.json({ orders });
  } catch (error) {
    return Response.json({ error: "Unable to load orders", details: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  let order = null;
  let LabOrderModel = null;
  let SampleModel = null;

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

    const { Patient, TestDefinition, LabOrder, Sample, Doctor, TestPackage } = await getTenantModels(auth.tenantId);
    LabOrderModel = LabOrder;
    SampleModel = Sample;
    const patient = await Patient.findById(patientId);
    if (!patient) return Response.json({ error: "Patient not found" }, { status: 404 });

    const doctor = patient.refDoctorName ? await Doctor.findOne({ name: patient.refDoctorName }) : null;

    const orderItems = [];
    let totalAmount = 0;

    for (const itemKey of testIds) {
      if (itemKey.startsWith("test_")) {
        const testId = itemKey.replace("test_", "");
        const test = await TestDefinition.findById(testId).populate("category");
        if (test) {
          const price = Number(test.price) || 0;
          totalAmount += price;
          orderItems.push({
            testDefinition: test._id,
            testSnapshot: {
              testId: test.testId,
              name: test.name,
              code: test.code,
              categoryName: test.category?.name,
              sampleType: test.sampleType,
              price: price
            },
            status: "sample-pending"
          });
        }
      } else if (itemKey.startsWith("pkg_")) {
        const pkgId = itemKey.replace("pkg_", "");
        const pkg = await TestPackage.findById(pkgId).populate({
          path: "tests",
          populate: { path: "category" }
        });
        
        if (pkg) {
          const price = Number(pkg.price) || 0;
          totalAmount += price;
          if (pkg.tests) {
            for (const test of pkg.tests) {
              if (!orderItems.find(item => item.testDefinition.toString() === test._id.toString())) {
                orderItems.push({
                  testDefinition: test._id,
                  testSnapshot: {
                    testId: test.testId,
                    name: test.name,
                    code: test.code,
                    categoryName: test.category?.name,
                    sampleType: test.sampleType,
                    price: 0
                  },
                  status: "sample-pending"
                });
              }
            }
          }
        }
      }
    }

    if (orderItems.length === 0) {
      return Response.json({ error: "No valid tests selected" }, { status: 400 });
    }

    const commissionRate = doctor?.commission || 0;
    const commissionAmount = (totalAmount * commissionRate) / 100;

    order = await LabOrder.create({
      patient: patient._id,
      items: orderItems,
      referralDoctor: doctor?._id,
      totalAmount,
      commissionAmount,
      billingStatus: "unpaid",
      priority: body.priority === "urgent" ? "urgent" : "routine",
      notes: clean(body.notes),
      createdBy: auth.session.email,
      status: "open"
    });

    const samples = await Promise.all(
      order.items.map((item) =>
        Sample.create({
          order: order._id,
          orderItemId: item._id,
          patient: patient._id,
          testDefinition: item.testDefinition,
          testSnapshot: item.testSnapshot,
        })
      )
    );

    await order.populate("patient", "name patientId age gender phone");

    return Response.json({ order, samples }, { status: 201 });
  } catch (error) {
    if (order?._id) {
      await Promise.all([
        LabOrderModel?.deleteOne({ _id: order._id }).catch(() => {}),
        SampleModel?.deleteMany({ order: order._id }).catch(() => {}),
      ]);
    }

    return Response.json({ error: "Unable to create order", details: error.message }, { status: 500 });
  }
}
