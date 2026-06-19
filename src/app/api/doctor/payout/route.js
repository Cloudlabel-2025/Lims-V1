import { getAccountByCode, postJournalEntry, seedSystemChartOfAccounts } from "@/app/lib/accounting";
import { jsonError } from "@/app/lib/api-response";
import { getTenantModels } from "@/app/lib/tenant-db";
import { requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";

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
