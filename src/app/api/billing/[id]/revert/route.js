import { reverseJournalEntry } from "@/app/lib/accounting";
import { jsonError } from "@/app/lib/api-response";
import { writeAuditLog } from "@/app/lib/audit";
import { getTenantModels } from "@/app/lib/tenant-db";
import { requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";

const REVERT_ERRORS = [
  "Billing record not found",
  "Bill is already cancelled",
  "Bill has no payments to revert — use Cancel for unpaid bills",
  "Cannot revert: no payment receipts found for this bill",
  "Cannot revert: a receipt is already refunded",
  "Original payment journal entry not found",
  "Original commission journal entry not found",
  "Original invoice journal entry not found",
];

export async function POST(req, { params }) {
  try {
    const auth = requireTenantSession(req, "billing.refund");
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "billing.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { id } = await params;
    const body = await req.json();
    const reason = String(body.reason || "").trim().slice(0, 150);

    const { connection, BillingRecord, Doctor, JournalEntry, PaymentReceipt, Sample } =
      await getTenantModels(auth.tenantId);

    const refundedReceipts = await connection.transaction(async (session) => {
      const bill = await BillingRecord.findOne({ _id: id, tenantId: auth.tenantId }).session(session);
      if (!bill) throw new Error("Billing record not found");
      if (bill.billingStatus === "cancelled") throw new Error("Bill is already cancelled");
      if (bill.billingStatus === "unpaid") {
        throw new Error("Bill has no payments to revert — use Cancel for unpaid bills");
      }

      const receipts = await PaymentReceipt.find({ invoiceId: bill._id, tenantId: auth.tenantId }).session(session);
      if (!receipts.length) throw new Error("Cannot revert: no payment receipts found for this bill");

      if (receipts.some((r) => r.isRefunded)) {
        throw new Error("Cannot revert: a receipt is already refunded");
      }
      const nonCash = receipts.find((r) => r.method !== "cash");
      if (nonCash) {
        throw new Error(
          `Cannot revert: this bill was paid with ${nonCash.method}. Revert is only allowed for hand (cash) payments.`
        );
      }

      const samples = await Sample.find({ billingRecord: bill._id }).session(session);
      const startedSample = samples.find((s) => s.status !== "registered");
      if (startedSample) {
        throw new Error(`Cannot revert: work has already started on sample ${startedSample.sampleId || startedSample._id}`);
      }

      for (const receipt of receipts) {
        const entry = await JournalEntry.findOne({ _id: receipt.journalEntryId, tenantId: auth.tenantId }).session(session);
        if (!entry) throw new Error("Original payment journal entry not found");

        const reversal = await reverseJournalEntry(
          connection,
          entry,
          {
            postedBy: auth.session.userId,
            sourceType: "refund",
            sourceId: receipt._id,
            description: `Reversal for reverted bill ${bill.billId}`,
          },
          { session }
        );

        receipt.isRefunded = true;
        receipt.refundJournalEntryId = reversal._id;
        receipt.refundedAt = new Date();
        receipt.refundedBy = auth.session.userId;
        await receipt.save({ session });
      }

      if (bill.commissionJournalEntryId) {
        const commissionEntry = await JournalEntry.findOne({ _id: bill.commissionJournalEntryId, tenantId: auth.tenantId }).session(session);
        if (!commissionEntry) throw new Error("Original commission journal entry not found");
        if (!commissionEntry.isReversed) {
          await reverseJournalEntry(
            connection,
            commissionEntry,
            {
              postedBy: auth.session.userId,
              sourceType: "refund",
              sourceId: bill._id,
              description: `Commission reversal for reverted bill ${bill.billId}`,
            },
            { session }
          );
          if (bill.referralDoctor && bill.commissionAmount > 0) {
            await Doctor.findByIdAndUpdate(
              bill.referralDoctor,
              { $inc: { pendingPayout: -(bill.commissionAmount) } },
              { session }
            );
          }
        }
      }

      if (bill.invoiceJournalEntryId) {
        const invoiceEntry = await JournalEntry.findOne({ _id: bill.invoiceJournalEntryId, tenantId: auth.tenantId }).session(session);
        if (!invoiceEntry) throw new Error("Original invoice journal entry not found");
        if (!invoiceEntry.isReversed) {
          await reverseJournalEntry(
            connection,
            invoiceEntry,
            {
              postedBy: auth.session.userId,
              sourceType: "refund",
              sourceId: bill._id,
              description: `Reversal of invoice for reverted bill ${bill.billId}`,
            },
            { session }
          );
        }
      }

      bill.paymentBreakdown = { cash: 0, card: 0, online: 0, corporate: 0 };
      bill.billingStatus = "cancelled";
      bill.invoiceStatus = "cancelled";
      bill.status = "cancelled";
      bill.cancelledAt = new Date();
      bill.cancelledBy = auth.session.userId;
      bill.cancellationReason = `REVERTED — ${reason || "Accidental bill reverted by user"}`.slice(0, 150);
      bill.items.forEach((item) => {
        item.status = "cancelled";
      });
      await bill.save({ session });

      for (const sample of samples) {
        sample.status = "rejected";
        sample.rejectionReason = "Bill reverted";
        sample.custodyLog.push({
          action: "status:registered -> rejected",
          handledBy: String(auth.session.userId),
          notes: "Bill reverted",
          timestamp: new Date(),
        });
        await sample.save({ session });
      }

      return { bill, count: receipts.length };
    });

    await writeAuditLog(req, auth, {
      action: "billing.reverted",
      resourceType: "BillingRecord",
      resourceId: id,
      metadata: {
        reason: refundedReceipts.bill.cancellationReason,
        refundedReceipts: refundedReceipts.count,
      },
    });

    return Response.json({ message: "Bill reverted successfully", billingRecord: refundedReceipts.bill });
  } catch (error) {
    const message = String(error.message || "");
    if (REVERT_ERRORS.includes(message)) {
      return Response.json({ error: message }, { status: 400 });
    }
    if (
      message.startsWith("Cannot revert: this bill was paid with ") ||
      message.startsWith("Cannot revert: work has already started on sample ")
    ) {
      return Response.json({ error: message }, { status: 400 });
    }
    return jsonError("Unable to revert billing record", error, 500);
  }
}
