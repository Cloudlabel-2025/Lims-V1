import { getTenantModels } from "@/app/lib/tenant-db";
import { requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";

function clean(value) {
  return String(value || "").trim();
}

export async function GET(req) {
  try {
    const auth = requireTenantSession(req, "billing.view");
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "billing.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const query = {};
    if (status && status !== "all") query.status = status;

    const { BillingRecord } = await getTenantModels(auth.tenantId);
    const billingRecords = await BillingRecord.find(query)
      .populate("patient", "name patientId age gender phone")
      .populate("referralDoctor", "name doctorId commission pendingPayout")
      .sort({ createdAt: -1 })
      .limit(100);

    return Response.json({ billingRecords });
  } catch (error) {
    return Response.json({ error: "Unable to load billing records", details: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  let billingRecord = null;
  let BillingRecordModel = null;
  let SampleModel = null;

  try {
    const auth = requireTenantSession(req, "billing.create");
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "billing.view");
    if (moduleAuth.error) return moduleAuth.error;

    const body = await req.json();
    const patientId = clean(body.patient);
    const testIds = Array.isArray(body.tests) ? body.tests.map(clean).filter(Boolean) : [];

    if (!patientId) return Response.json({ error: "Patient is required" }, { status: 400 });
    if (testIds.length === 0) {
      return Response.json({ error: "At least one test is required" }, { status: 400 });
    }

    const { Patient, TestDefinition, BillingRecord, Sample, Doctor, TestPackage } = await getTenantModels(auth.tenantId);
    BillingRecordModel = BillingRecord;
    SampleModel = Sample;
    const patient = await Patient.findById(patientId);
    if (!patient) return Response.json({ error: "Patient not found" }, { status: 404 });

    const doctor = patient.refDoctorName ? await Doctor.findOne({ name: patient.refDoctorName }) : null;

    const billingItems = [];
    let totalAmount = 0;

    for (const itemKey of testIds) {
      if (itemKey.startsWith("test_")) {
        const testId = itemKey.replace("test_", "");
        const test = await TestDefinition.findById(testId).populate("category");
        if (test) {
          const price = Number(test.price) || 0;
          totalAmount += price;
          billingItems.push({
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
              if (!billingItems.find(item => item.testDefinition.toString() === test._id.toString())) {
                billingItems.push({
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

    if (billingItems.length === 0) {
      return Response.json({ error: "No valid tests selected" }, { status: 400 });
    }

    const commissionRate = doctor?.commission || 0;
    const commissionAmount = (totalAmount * commissionRate) / 100;

    billingRecord = await BillingRecord.create({
      patient: patient._id,
      items: billingItems,
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
      billingRecord.items.map((item) =>
        Sample.create({
          billingRecord: billingRecord._id,
          billingItemId: item._id,
          patient: patient._id,
          testDefinition: item.testDefinition,
          testSnapshot: item.testSnapshot,
        })
      )
    );

    await billingRecord.populate("patient", "name patientId age gender phone");

    return Response.json({ billingRecord, samples }, { status: 201 });
  } catch (error) {
    if (billingRecord?._id) {
      await Promise.all([
        BillingRecordModel?.deleteOne({ _id: billingRecord._id }).catch(() => {}),
        SampleModel?.deleteMany({ billingRecord: billingRecord._id }).catch(() => {}),
      ]);
    }

    return Response.json({ error: "Unable to create billing record", details: error.message }, { status: 500 });
  }
}
