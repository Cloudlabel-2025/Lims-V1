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
      .select("billId patient items priority status notes referralDoctor totalAmount commissionAmount paymentBreakdown billingStatus createdBy createdAt updatedAt")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

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
    const patient = await Patient.findById(patientId).select("name patientId age gender phone refDoctorName").lean();
    if (!patient) return Response.json({ error: "Patient not found" }, { status: 404 });

    const doctor = patient.refDoctorName
      ? await Doctor.findOne({ name: patient.refDoctorName }).select("_id commission").lean()
      : null;

    const billingItems = [];
    let totalAmount = 0;
    const testObjectIds = testIds
      .filter((itemKey) => itemKey.startsWith("test_"))
      .map((itemKey) => itemKey.replace("test_", ""));
    const packageObjectIds = testIds
      .filter((itemKey) => itemKey.startsWith("pkg_"))
      .map((itemKey) => itemKey.replace("pkg_", ""));
    const [selectedTests, selectedPackages] = await Promise.all([
      testObjectIds.length
        ? TestDefinition.find({ _id: { $in: testObjectIds } })
            .populate("category", "name")
            .select("testId name code category sampleType price")
            .lean()
        : Promise.resolve([]),
      packageObjectIds.length
        ? TestPackage.find({ _id: { $in: packageObjectIds } })
            .populate({
              path: "tests",
              select: "testId name code category sampleType price",
              populate: { path: "category", select: "name" },
            })
            .select("price tests")
            .lean()
        : Promise.resolve([]),
    ]);
    const selectedTestMap = new Map(selectedTests.map((test) => [String(test._id), test]));
    const selectedPackageMap = new Map(selectedPackages.map((pkg) => [String(pkg._id), pkg]));
    const addedTestIds = new Set();

    for (const itemKey of testIds) {
      if (itemKey.startsWith("test_")) {
        const testId = itemKey.replace("test_", "");
        const test = selectedTestMap.get(testId);
        if (test) {
          const price = Number(test.price) || 0;
          totalAmount += price;
          addedTestIds.add(String(test._id));
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
        const pkg = selectedPackageMap.get(pkgId);
        
        if (pkg) {
          const price = Number(pkg.price) || 0;
          totalAmount += price;
          if (pkg.tests) {
            for (const test of pkg.tests) {
              const testId = String(test._id);
              if (!addedTestIds.has(testId)) {
                addedTestIds.add(testId);
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
