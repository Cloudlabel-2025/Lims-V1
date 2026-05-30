import { jsonError } from "@/app/lib/api-response";
import { getAccountByCode, postJournalEntry } from "@/app/lib/accounting";
import { getTenantModels } from "@/app/lib/tenant-db";
import { requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";

function clean(value) {
  return String(value || "").trim();
}

function money(value) {
  return Math.max(0, Math.round((Number(value) || 0) * 100) / 100);
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
      .select("billId patient items priority status notes referralDoctor subtotalAmount discountAmount taxAmount totalAmount commissionAmount paymentBreakdown billingStatus invoiceStatus invoiceJournalEntryId paymentReceiptIds commissionJournalEntryId createdBy createdAt updatedAt")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return Response.json({ billingRecords });
  } catch (error) {
    return jsonError("Unable to load billing records", error, 500);
  }
}

export async function POST(req) {
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

    const { connection, Patient, TestDefinition, BillingRecord, Sample, Doctor, TestPackage } =
      await getTenantModels(auth.tenantId);
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

    const subtotalAmount = money(totalAmount);
    const discountAmount = Math.min(money(body.discountAmount), subtotalAmount);
    const taxAmount = money(body.taxAmount);
    const invoiceAmount = money(subtotalAmount - discountAmount + taxAmount);
    const commissionRate = doctor?.commission || 0;
    const commissionAmount = (invoiceAmount * commissionRate) / 100;

    const [billingRecord, samples] = await connection.transaction(async (session) => {
      const [createdBillingRecord] = await BillingRecord.create(
        [
          {
            patient: patient._id,
            items: billingItems,
            referralDoctor: doctor?._id,
            tenantId: auth.tenantId,
            subtotalAmount,
            discountAmount,
            taxAmount,
            totalAmount: invoiceAmount,
            commissionAmount,
            billingStatus: "unpaid",
            invoiceStatus: "confirmed",
            priority: body.priority === "urgent" ? "urgent" : "routine",
            notes: clean(body.notes),
            createdBy: auth.session.email,
            status: "open",
          },
        ],
        { session }
      );

      const createdSamples = await Sample.create(
        createdBillingRecord.items.map((item) => ({
          billingRecord: createdBillingRecord._id,
          billingItemId: item._id,
          patient: patient._id,
          testDefinition: item.testDefinition,
          testSnapshot: item.testSnapshot,
        })),
        { session }
      );

      const receivableAccount = await getAccountByCode(connection, auth.tenantId, "1100", { session });
      const revenueAccount = await getAccountByCode(connection, auth.tenantId, "4001", { session });
      const invoiceLines = [
        { accountId: receivableAccount._id, debit: invoiceAmount, credit: 0 },
        { accountId: revenueAccount._id, debit: 0, credit: subtotalAmount },
      ];

      if (discountAmount > 0) {
        const discountAccount = await getAccountByCode(connection, auth.tenantId, "4003", { session });
        invoiceLines.push({ accountId: discountAccount._id, debit: discountAmount, credit: 0 });
      }

      if (taxAmount > 0) {
        const taxPayableAccount = await getAccountByCode(connection, auth.tenantId, "2100", { session });
        invoiceLines.push({ accountId: taxPayableAccount._id, debit: 0, credit: taxAmount });
      }

      const invoiceJournalEntry = await postJournalEntry(
        connection,
        {
          tenantId: auth.tenantId,
          postedBy: auth.session.userId,
          sourceType: "billing",
          sourceId: createdBillingRecord._id,
          description: `Invoice confirmed for ${createdBillingRecord.billId}`,
          lines: invoiceLines,
        },
        { session }
      );

      createdBillingRecord.invoiceJournalEntryId = invoiceJournalEntry._id;
      await createdBillingRecord.save({ session });

      return [createdBillingRecord, createdSamples];
    });

    await billingRecord.populate("patient", "name patientId age gender phone");

    const { AuditLog } = await getTenantModels(auth.tenantId);
    AuditLog.create({ action: "billing.create", userId: auth.session.userId, tenantId: auth.tenantId, resourceType: "BillingRecord", resourceId: billingRecord._id, ipAddress: req.headers.get("x-forwarded-for") || "" }).catch(() => {});

    return Response.json({ billingRecord, samples }, { status: 201 });
  } catch (error) {
    return jsonError("Unable to create billing record", error, 500);
  }
}
