import { getAccountByCode, postJournalEntry } from "@/app/lib/accounting";
import { jsonError } from "@/app/lib/api-response";
import { getTenantModels } from "@/app/lib/tenant-db";
import { requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";

export async function POST(req) {
  try {
    const auth = requireTenantSession(req, "accounts.manage");
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "accounts.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { tenantId } = auth;
    const { connection, Doctor } = await getTenantModels(tenantId);
    
    const { doctorId, paymentMethod } = await req.json();

    if (!doctorId) {
      return Response.json({ error: "Doctor ID is required" }, { status: 400 });
    }

    const result = await connection.transaction(async (session) => {
      const doctor = await Doctor.findById(doctorId).session(session);
      if (!doctor) throw new Error("Doctor not found");

      const amountCleared = Number(doctor.pendingPayout || 0);
      if (amountCleared <= 0) throw new Error("No pending payout to clear");

      const payableAccount = await getAccountByCode(connection, tenantId, "2001", { session });
      const cashOrBankAccount = await getAccountByCode(
        connection,
        tenantId,
        paymentMethod === "bank" ? "1002" : "1001",
        { session }
      );

      const journalEntry = await postJournalEntry(
        connection,
        {
          tenantId,
          postedBy: auth.session.userId,
          sourceType: "commission",
          sourceId: doctor._id,
          description: `Referral doctor payout cleared for ${doctor.name}`,
          lines: [
            { accountId: payableAccount._id, debit: amountCleared, credit: 0 },
            { accountId: cashOrBankAccount._id, debit: 0, credit: amountCleared },
          ],
        },
        { session }
      );

      doctor.pendingPayout = 0;
      await doctor.save({ session });

      return { amountCleared, journalEntry };
    });

    return Response.json({ 
      message: "Payout cleared successfully", 
      amountCleared: result.amountCleared,
      journalEntryId: result.journalEntry._id,
      currentBalance: 0
    });

  } catch (error) {
    if (["Doctor not found", "No pending payout to clear"].includes(error.message)) {
      return Response.json({ error: error.message }, { status: error.message === "Doctor not found" ? 404 : 400 });
    }

    return jsonError("Unable to clear payout", error, 500);
  }
}
