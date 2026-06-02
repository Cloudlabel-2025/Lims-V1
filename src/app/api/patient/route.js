import { jsonError } from "@/app/lib/api-response";
import { getAccountByCode, postJournalEntry, seedSystemChartOfAccounts } from "@/app/lib/accounting";
import { getTenantModels } from "@/app/lib/tenant-db";
import { requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";

function clean(value) {
  return String(value || "").trim();
}

function money(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function buildOrderItems({ selectedTests, TestDefinition, TestPackage, session }) {
  const orderItems = [];
  let subtotalAmount = 0;

  for (const itemKey of selectedTests || []) {
    if (itemKey.startsWith("test_")) {
      const test = await TestDefinition.findById(itemKey.replace("test_", ""))
        .populate("category")
        .session(session);
      if (!test) continue;

      const price = money(test.price);
      subtotalAmount = money(subtotalAmount + price);
      orderItems.push({
        testDefinition: test._id,
        testSnapshot: {
          testId: test.testId,
          name: test.name,
          code: test.code,
          categoryName: test.category?.name,
          sampleType: test.sampleType,
          price,
        },
        status: "sample-pending",
      });
      continue;
    }

    if (itemKey.startsWith("pkg_")) {
      const pkg = await TestPackage.findById(itemKey.replace("pkg_", ""))
        .populate({ path: "tests", populate: { path: "category" } })
        .session(session);
      if (!pkg) continue;

      subtotalAmount = money(subtotalAmount + money(pkg.price));
      for (const test of pkg.tests || []) {
        if (orderItems.some((item) => item.testDefinition.toString() === test._id.toString())) {
          continue;
        }

        orderItems.push({
          testDefinition: test._id,
          testSnapshot: {
            testId: test.testId,
            name: test.name,
            code: test.code,
            categoryName: test.category?.name,
            sampleType: test.sampleType,
            price: 0,
          },
          status: "sample-pending",
        });
      }
    }
  }

  return { orderItems, subtotalAmount };
}

export async function POST(req) {
  try {
    const auth = requireTenantSession(req, "patients.register");
    if (auth.error) return auth.error;

    const { tenantId } = auth;
    const moduleAuth = await requireEnabledTenantModule(tenantId, "patients.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { connection, Patient, BillingRecord, TestDefinition, TestPackage, Doctor, Sample } =
      await getTenantModels(tenantId);
    const body = await req.json();

    const { name, dob, age, gender, phone, receivedTime, address, selectedTests, force } = body;
    const missing = [];
    if (!clean(name)) missing.push("Full Name");
    if (!dob) missing.push("Date of Birth");
    if (age === undefined || age === null || age === "") missing.push("Age");
    if (!clean(gender)) missing.push("Gender");
    if (!clean(phone)) missing.push("Mobile Number");
    if (!clean(address)) missing.push("Address");
    if (!receivedTime) missing.push("Received Time");

    if (missing.length > 0) {
      return Response.json({ error: `Missing required fields: ${missing.join(", ")}` }, { status: 400 });
    }

    if (gender === "Other" && !body.genderIdentity) {
      return Response.json({ error: "Gender Identity is required when Gender is 'Other'" }, { status: 400 });
    }

    if (!/^\d{10}$/.test(String(phone))) {
      return Response.json({ error: "Mobile Number must be exactly 10 digits" }, { status: 400 });
    }

    if (body.uhId && !/^\d{14}$/.test(String(body.uhId))) {
      return Response.json({ error: "UH ID must be exactly 14 digits" }, { status: 400 });
    }

    if (body.collectionTime && new Date(body.receivedTime) < new Date(body.collectionTime)) {
      return Response.json({ error: "Received Time cannot be earlier than Collection Time" }, { status: 400 });
    }

    if (!force) {
      const existing = await Patient.findOne({ phone: String(phone) }).sort({ createdAt: 1 });
      if (existing) {
        return Response.json({ warning: "Mobile already exists", patient: existing }, { status: 200 });
      }
    }

    const result = await connection.transaction(async (session) => {
      const doctor = body.refDoctorName
        ? await Doctor.findOne({ name: body.refDoctorName }).session(session)
        : null;

      const [patient] = await Patient.create(
        [
          {
            ...body,
            phone: String(phone),
            refDoctorName: body.refDoctorName || undefined,
          },
        ],
        { session }
      );

      const response = { patient, billingRecord: null, samples: [] };
      if (!Array.isArray(selectedTests) || selectedTests.length === 0) return response;

      const { orderItems, subtotalAmount } = await buildOrderItems({
        selectedTests,
        TestDefinition,
        TestPackage,
        session,
      });
      if (orderItems.length === 0) return response;

      await seedSystemChartOfAccounts(connection, tenantId, { session });

      const commissionRate = doctor?.commission || 0;
      const commissionAmount = money((subtotalAmount * commissionRate) / 100);
      const [billingRecord] = await BillingRecord.create(
        [
          {
            patient: patient._id,
            items: orderItems,
            referralDoctor: doctor?._id,
            subtotalAmount,
            discountAmount: 0,
            taxAmount: 0,
            totalAmount: subtotalAmount,
            commissionAmount,
            tenantId,
            billingStatus: "unpaid",
            invoiceStatus: "confirmed",
            createdBy: auth.session?.email || "System",
            status: "open",
          },
        ],
        { session }
      );

      const samples = await Sample.create(
        billingRecord.items.map((item) => ({
          billingRecord: billingRecord._id,
          billingItemId: item._id,
          patient: patient._id,
          testDefinition: item.testDefinition,
          testSnapshot: item.testSnapshot,
        })),
        { session }
      );

      const receivableAccount = await getAccountByCode(connection, tenantId, "1100", { session });
      const revenueAccount = await getAccountByCode(connection, tenantId, "4001", { session });
      const invoiceJournalEntry = await postJournalEntry(
        connection,
        {
          tenantId,
          postedBy: auth.session.userId,
          sourceType: "billing",
          sourceId: billingRecord._id,
          description: `Invoice confirmed for ${billingRecord.billId}`,
          lines: [
            { accountId: receivableAccount._id, debit: subtotalAmount, credit: 0 },
            { accountId: revenueAccount._id, debit: 0, credit: subtotalAmount },
          ],
        },
        { session }
      );

      billingRecord.invoiceJournalEntryId = invoiceJournalEntry._id;
      await billingRecord.save({ session });

      response.billingRecord = billingRecord;
      response.samples = samples;
      return response;
    });

    const payload = result.patient.toObject();
    if (result.billingRecord) {
      payload.billingRecord = {
        _id: result.billingRecord._id,
        billId: result.billingRecord.billId,
        totalAmount: result.billingRecord.totalAmount,
      };
      payload.samplesCreated = result.samples.length;
    }

    return Response.json(payload, { status: 201 });
  } catch (err) {
    console.error("POST /api/patient error:", err);

    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map((e) => e.message);
      return Response.json({ error: messages.join("; ") }, { status: 400 });
    }

    if (err.name === "CastError") {
      return Response.json({ error: `Invalid value for field '${err.path}': ${err.value}` }, { status: 400 });
    }

    return jsonError("Unable to register patient", err, 500);
  }
}

export async function GET(req) {
  try {
    const auth = requireTenantSession(req, "patients.view");
    if (auth.error) return auth.error;

    const { tenantId } = auth;
    const moduleAuth = await requireEnabledTenantModule(tenantId, "patients.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { Patient } = await getTenantModels(tenantId);
    const { searchParams } = new URL(req.url);
    const search = clean(searchParams.get("search"));
    const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, Number.parseInt(searchParams.get("limit") || "50", 10)));

    let query = {};
    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      query = { $or: [{ name: regex }, { phone: regex }, { patientId: regex }, { barcode: regex }] };
    }

    const [patients, total] = await Promise.all([
      Patient.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Patient.countDocuments(query),
    ]);

    return Response.json({
      patients,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (err) {
    return jsonError("Fetch failed", err, 500);
  }
}
