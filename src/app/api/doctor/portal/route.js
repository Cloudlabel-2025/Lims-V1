import { requireTenantSession } from "@/app/lib/auth";
import { getTenantModels } from "@/app/lib/tenant-db";
import { jsonError } from "@/app/lib/api-response";

function amountFromJournal(entry) {
  const line = (entry.lines || []).find((item) => Number(item.debit || 0) > 0) || entry.lines?.[0];
  return Number(line?.debit || line?.credit || 0);
}

export async function GET(req) {
  try {
    const auth = requireTenantSession(req, "reports.view");
    if (auth.error) return auth.error;
    if (!auth.session.doctorId) {
      return Response.json({ error: "No doctor profile is linked to this account" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = String(searchParams.get("search") || "").trim().toLowerCase();
    const { Doctor, BillingRecord, TestReport, JournalEntry } = await getTenantModels(auth.tenantId);
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

    const visibleBills = search
      ? bills.filter((bill) => [bill.billId, bill.patient?.name, bill.patient?.patientId, bill.patient?.phone]
          .some((value) => String(value || "").toLowerCase().includes(search)))
      : bills;
    const billIds = bills.map((bill) => bill._id);
    const reports = billIds.length
      ? await TestReport.find({ billingRecord: { $in: billIds }, status: "released" })
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

    return Response.json({
      doctor,
      summary: {
        referralCount: new Set(bills.map((bill) => String(bill.patient?._id || ""))).size,
        billCount: bills.length,
        releasedReportCount: reports.length,
        estimatedCommission: estimated,
        earnedCommission: earned,
        pendingPayout: Number(doctor.pendingPayout || 0),
        paidCommission: paid,
      },
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
