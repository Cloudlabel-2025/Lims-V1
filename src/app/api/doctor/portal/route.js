import { requireTenantSession } from "@/app/lib/auth";
import { getTenantModels } from "@/app/lib/tenant-db";
import { jsonError } from "@/app/lib/api-response";
import { writeAuditLog } from "@/app/lib/audit";

function amountFromJournal(entry) {
  const line = (entry.lines || []).find((item) => Number(item.debit || 0) > 0) || entry.lines?.[0];
  return Number(line?.debit || line?.credit || 0);
}

import { getLabSubscriptionEntitlements } from "@/app/lib/subscription-service";
import { hasDoctorPortalEntitlement } from "@/app/lib/portal-policy";

export async function GET(req) {
  try {
    const auth = requireTenantSession(req, "reports.view");
    if (auth.error) return auth.error;

    const subscription = await getLabSubscriptionEntitlements(auth.tenantId);
    if (!hasDoctorPortalEntitlement(subscription)) {
      return Response.json({
        error: "Doctor Portal access is not included in your active subscription package. Contact support to enable doctor portal access.",
      }, { status: 403 });
    }

    if (!auth.session.doctorId) {
      return Response.json({ error: "No doctor profile is linked to this account" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = String(searchParams.get("search") || "").trim().toLowerCase();
    const { Doctor, Patient, TestRequest, BillingRecord, TestReport, JournalEntry } = await getTenantModels(auth.tenantId);
    const doctor = await Doctor.findById(auth.session.doctorId)
      .select("name doctorId speciality clinicName status commission pendingPayout")
      .lean();
    if (!doctor || doctor.status !== "Active") {
      return Response.json({ error: "Doctor profile is not active" }, { status: 403 });
    }

    const bills = await BillingRecord.find({
      tenantId: auth.tenantId,
      referralDoctor: doctor._id,
      status: { $ne: "cancelled" },
    })
      .populate("patient", "name patientId age gender phone email")
      .select("billId patient items status billingStatus totalAmount commissionAmount commissionJournalEntryId createdAt updatedAt")
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    const registeredPatients = await Patient.find({
      $or: [
        { refDoctorName: doctor.name },
        { _id: { $in: bills.map((b) => b.patient?._id).filter(Boolean) } },
      ],
    })
      .select("patientId name age dob gender phone email address createdAt")
      .sort({ createdAt: -1 })
      .lean();

    const doctorRequests = await TestRequest.find({
      doctor: doctor._id,
    })
      .populate("patient", "name patientId phone age gender")
      .sort({ createdAt: -1 })
      .lean();

    // Payment-Gated Report Visibility: Reports visible ONLY if patient completed payment (paid/settled)
    const paidBills = bills.filter((bill) => bill.billingStatus === "paid" || bill.billingStatus === "settled");
    const paidBillIds = paidBills.map((bill) => bill._id);
    const reports = paidBillIds.length
      ? await TestReport.find({ billingRecord: { $in: paidBillIds }, status: "released" })
          .populate("patient", "name patientId age gender")
          .select("reportId billingRecord patient testSnapshot results remarks status releasedAt createdAt")
          .sort({ releasedAt: -1, createdAt: -1 })
          .limit(500)
          .lean()
      : [];

    const payoutEntries = await JournalEntry.find({
      tenantId: auth.tenantId,
      sourceType: "commission",
      sourceId: doctor._id,
      description: /^Doctor payout released/,
      isReversed: false,
    }).select("entryNumber date description lines createdAt").sort({ date: -1 }).lean();

    const earned = bills
      .filter((bill) => bill.commissionJournalEntryId)
      .reduce((sum, bill) => sum + Number(bill.commissionAmount || 0), 0);
    const estimated = bills
      .filter((bill) => !bill.commissionJournalEntryId)
      .reduce((sum, bill) => sum + Number(bill.commissionAmount || 0), 0);
    const paid = payoutEntries.reduce((sum, entry) => sum + amountFromJournal(entry), 0);

    const visibleBills = search
      ? bills.filter(
          (bill) =>
            bill.billId?.toLowerCase().includes(search) ||
            bill.patient?.name?.toLowerCase().includes(search) ||
            bill.patient?.patientId?.toLowerCase().includes(search)
        )
      : bills;

    return Response.json({
      doctor,
      summary: {
        referralCount: new Set(bills.map((bill) => String(bill.patient?._id || ""))).size,
        patientCount: registeredPatients.length,
        testRequestCount: doctorRequests.length,
        billCount: bills.length,
        releasedReportCount: reports.length,
        estimatedCommission: estimated,
        earnedCommission: earned,
        pendingPayout: Number(doctor.pendingPayout || 0),
        paidCommission: paid,
      },
      registeredPatients,
      testRequests: doctorRequests,
      referrals: visibleBills.map((bill) => ({
        _id: bill._id,
        billId: bill.billId,
        patient: bill.patient,
        tests: (bill.items || []).map((item) => item.testSnapshot?.name).filter(Boolean),
        billingStatus: bill.billingStatus,
        status: bill.status,
        totalAmount: bill.totalAmount,
        commissionAmount: bill.commissionAmount,
        commissionStatus: bill.commissionJournalEntryId ? "earned" : "estimated",
        referredAt: bill.createdAt,
      })),
      reports,
      payouts: payoutEntries.map((entry) => ({
        _id: entry._id,
        entryNumber: entry.entryNumber,
        date: entry.date || entry.createdAt,
        amount: amountFromJournal(entry),
        description: entry.description,
      })),
    });
  } catch (error) {
    return jsonError("Unable to load doctor portal", error, 500);
  }
}

// ── POST: Doctor Portal Actions (Add Patient, Submit Test Request, Fetch Packages) ──
export async function POST(req) {
  try {
    const auth = requireTenantSession(req);
    if (auth.error) return auth.error;

    const subscription = await getLabSubscriptionEntitlements(auth.tenantId);
    if (!hasDoctorPortalEntitlement(subscription)) {
      return Response.json({
        error: "Doctor Portal access is not included in your active subscription package. Contact support to enable doctor portal access.",
      }, { status: 403 });
    }

    if (!auth.session.doctorId) {
      return Response.json({ error: "No doctor profile is linked to this account" }, { status: 403 });
    }

    const { Patient, TestPackage, TestDefinition, TestRequest, Doctor, AuditLog } = await getTenantModels(auth.tenantId);
    const doctor = await Doctor.findById(auth.session.doctorId).lean();
    if (!doctor || doctor.status !== "Active") {
      return Response.json({ error: "Doctor profile is not active" }, { status: 403 });
    }

    const body = await req.json();
    const { action } = body;

    // 1. Doctor Registers New Patient
    if (action === "register_patient") {
      const { name, phone, age, dob, gender, genderIdentity, address, email } = body;
      if (!name || !phone) {
        return Response.json({ error: "Patient name and phone number are required" }, { status: 400 });
      }

      const rawPhone = String(phone).replace(/\D/g, "");
      if (rawPhone.length !== 10) {
        return Response.json({ error: "Phone number must be exactly 10 digits" }, { status: 400 });
      }

      const parsedAge = Math.max(0, Math.min(150, Math.floor(Number(age) || 30)));
      const computedDob = dob ? new Date(dob) : new Date(new Date().setFullYear(new Date().getFullYear() - parsedAge));
      const validGender = ["Male", "Female", "Other"].includes(gender) ? gender : "Male";
      const validGenderIdentity = validGender === "Other" && ["Transwomen", "Transman"].includes(genderIdentity) ? genderIdentity : undefined;
      const validAddress = String(address || "").trim() || "N/A";

      const patient = await Patient.create({
        name: String(name).trim(),
        phone: rawPhone,
        age: parsedAge,
        dob: computedDob,
        gender: validGender,
        genderIdentity: validGenderIdentity,
        address: validAddress,
        email: email ? String(email).trim().toLowerCase() : "",
        refDoctorName: doctor.name,
      });

      return Response.json({ message: "Patient registered successfully", patient }, { status: 201 });
    }

    // 2. Fetch Available Test Packages & Definitions for Doctor
    if (action === "fetch_packages") {
      const [packages, tests] = await Promise.all([
        TestPackage.find({ status: "active" }).select("name price code description items").lean(),
        TestDefinition.find({ status: "active" }).select("name price code category department").lean(),
      ]);
      return Response.json({ packages, tests });
    }

    // 3. Doctor Submits Test Request to Lab
    if (action === "submit_test_request") {
      const { patientId, testPackages, tests, vitals, notes } = body;
      if (!patientId) {
        return Response.json({ error: "Patient selection is required" }, { status: 400 });
      }
      if ((!testPackages || !testPackages.length) && (!tests || !tests.length)) {
        return Response.json({ error: "Please select at least one test package or individual test" }, { status: 400 });
      }

      const patient = await Patient.findById(patientId).select("name patientId phone").lean();
      if (!patient) return Response.json({ error: "Selected patient not found" }, { status: 404 });

      const testRequest = await TestRequest.create({
        tenantId: auth.tenantId,
        doctor: doctor._id,
        patient: patient._id,
        testPackages: testPackages || [],
        tests: tests || [],
        vitals: vitals || {},
        notes: notes ? String(notes).trim() : "",
        status: "pending",
      });

      // Audit Log
      await writeAuditLog(req, auth, {
        action: "doctor.test_request_submitted",
        resourceType: "TestRequest",
        resourceId: testRequest._id,
        metadata: { doctorName: doctor.name, patientName: patient.name },
      });

      return Response.json({
        message: "Test request submitted directly to the Lab Admin successfully",
        testRequest,
      }, { status: 201 });
    }

    return Response.json({ error: "Invalid doctor portal action" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/doctor/portal error:", error);
    return jsonError("Doctor portal operation failed", error, 500);
  }
}
