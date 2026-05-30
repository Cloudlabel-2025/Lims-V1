import { reverseJournalEntry } from "@/app/lib/accounting";
import { jsonError } from "@/app/lib/api-response";
import { getTenantModels } from "@/app/lib/tenant-db";
import { requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";

function money(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export async function POST(req) {
  try {
    const auth = requireTenantSession(req, "billing.refund");
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "billing.view");
    if (moduleAuth.error) return moduleAuth.error;

    const body = await req.json();
    const receiptId = String(body.receiptId || "").trim();

    if (!receiptId) {
      return Response.json({ error: "Payment receipt ID is required" }, { status: 400 });
    }

    const { connection, BillingRecord, JournalEntry, PaymentReceipt } = await getTenantModels(auth.tenantId);
    const result = await connection.transaction(async (session) => {
      const receipt = await PaymentReceipt.findOne({ _id: receiptId, tenantId: auth.tenantId }).session(session);
      if (!receipt) throw new Error("Payment receipt not found");
      if (receipt.isRefunded) throw new Error("Payment receipt is already refunded");

      const originalJournalEntry = await JournalEntry.findOne({
        _id: receipt.journalEntryId,
        tenantId: auth.tenantId,
      }).session(session);
      if (!originalJournalEntry) throw new Error("Original payment journal entry not found");

      const reversal = await reverseJournalEntry(
        connection,
        originalJournalEntry,
        {
          postedBy: auth.session.userId,
          sourceType: "refund",
          sourceId: receipt._id,
          description: `Refund reversal for ${receipt._id}`,
        },
        { session }
      );

      receipt.isRefunded = true;
      receipt.refundJournalEntryId = reversal._id;
      receipt.refundedAt = new Date();
      receipt.refundedBy = auth.session.userId;
      await receipt.save({ session });

      const billingRecord = await BillingRecord.findOne({
        _id: receipt.invoiceId,
        tenantId: auth.tenantId,
      }).session(session);

      if (billingRecord) {
        const paymentKey = receipt.method === "upi" ? "online" : receipt.method;
        if (["cash", "card", "online"].includes(paymentKey)) {
          billingRecord.paymentBreakdown[paymentKey] = Math.max(
            0,
            money((billingRecord.paymentBreakdown[paymentKey] || 0) - receipt.amount)
          );
        }

        const totalPaid = money(
          billingRecord.paymentBreakdown.cash +
            billingRecord.paymentBreakdown.card +
            billingRecord.paymentBreakdown.online
        );
        billingRecord.billingStatus = totalPaid <= 0 ? "unpaid" : totalPaid >= billingRecord.totalAmount ? "paid" : "partial";
        billingRecord.invoiceStatus = totalPaid <= 0 ? "confirmed" : totalPaid >= billingRecord.totalAmount ? "paid" : "partial";
        billingRecord.status = billingRecord.billingStatus === "paid" ? "completed" : "in-progress";
        await billingRecord.save({ session });
      }

      return { receipt, reversal };
    });

    return Response.json({
      message: "Payment refund posted",
      receipt: result.receipt,
      reversalJournalEntry: result.reversal,
    });
  } catch (error) {
    if (
      [
        "Payment receipt not found",
        "Payment receipt is already refunded",
        "Original payment journal entry not found",
      ].includes(error.message)
    ) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return jsonError("Unable to refund payment", error, 500);
  }
}
