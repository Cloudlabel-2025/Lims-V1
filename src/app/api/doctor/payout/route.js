import { getAccountByCode, postJournalEntry, seedSystemChartOfAccounts } from "@/app/lib/accounting";
import { jsonError } from "@/app/lib/api-response";
import { getTenantModels } from "@/app/lib/tenant-db";
import { requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";

export async function GET(req) {
  try {
    const auth = requireTenantSession(req, "accounts.view");
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "doctors.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, Number.parseInt(searchParams.get("limit") || "50", 10)));
    const doctorId = searchParams.get("doctorId") || "";
    const { connection, Doctor } = await getTenantModels(auth.tenantId);

    const JournalEntry = connection.models.JournalEntry;
    if (!JournalEntry) return Response.json({ payouts: [], pagination: { page, limit, total: 0, totalPages: 1 } });

    const query = { tenantId: auth.tenantId, sourceType: "commission" };
    if (doctorId) query.sourceId = doctorId;

    const [payouts, total] = await Promise.all([
      JournalEntry.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      JournalEntry.countDocuments(query),
    ]);

    const payoutList = await Promise.all(
      payouts.map(async (entry) => {
        let doctor = null;
        if (entry.sourceId) {
          doctor = await Doctor.findById(entry.sourceId).select("name doctorId").lean();
        }
        const line = entry.lines?.[0];
        return {
          _id: entry._id,
          entryNumber: entry.entryNumber,
          date: entry.date || entry.createdAt,
          description: entry.description,
          doctor: doctor ? { name: doctor.name, doctorId: doctor.doctorId } : null,
          amount: line ? Math.abs(Number(line.debit || 0) - Number(line.credit || 0)) : 0,
        };
      })
    );

    return Response.json({
      payouts: payoutList,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (error) {
    return jsonError("Unable to load payout history", error, 500);
  }
}

export async function POST(req) {
  try {
    const auth = requireTenantSession(req, "billing.collect");
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "doctors.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { tenantId } = auth;
    const { connection, Doctor } = await getTenantModels(tenantId);

    const { doctorId, paymentMethod } = await req.json();
    if (!doctorId) {
      return Response.json({ error: "Doctor ID is required" }, { status: 400 });
    }

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) return Response.json({ error: "Doctor not found" }, { status: 404 });

    const amountCleared = Number(doctor.pendingPayout || 0);
    if (amountCleared <= 0) {
      return Response.json({ error: "No pending payout to clear" }, { status: 400 });
    }

    // Ensure chart of accounts is seeded (handles tenants created before seeding was added)
    await seedSystemChartOfAccounts(connection, tenantId);

    const payableAccount = await getAccountByCode(connection, tenantId, "2001");
    const cashOrBankAccount = await getAccountByCode(
      connection,
      tenantId,
      paymentMethod === "bank" ? "1002" : "1001"
    );

    const journalEntry = await postJournalEntry(connection, {
      tenantId,
      postedBy: auth.session.userId,
      sourceType: "commission",
      sourceId: doctor._id,
      description: `Doctor payout released for ${doctor.name}`,
      lines: [
        { accountId: payableAccount._id, debit: amountCleared, credit: 0 },
        { accountId: cashOrBankAccount._id, debit: 0, credit: amountCleared },
      ],
    });

    await Doctor.updateOne({ _id: doctor._id }, { $set: { pendingPayout: 0 } });

    return Response.json({
      message: "Payout released successfully",
      amountCleared,
      journalEntryId: journalEntry._id,
      currentBalance: 0,
    });
  } catch (error) {
    return jsonError("Unable to release payout", error, 500);
  }
}
