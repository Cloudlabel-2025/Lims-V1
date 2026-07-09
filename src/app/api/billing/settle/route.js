import { getAccountByCode, postJournalEntry, seedSystemChartOfAccounts } from "@/app/lib/accounting";
import { jsonError } from "@/app/lib/api-response";
import { writeAuditLog } from "@/app/lib/audit";
import { getTenantModels } from "@/app/lib/tenant-db";
import { requireTenantSession } from "@/app/lib/auth";

function money(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function getPaymentParts(payment) {
  return [
    { key: "cash", method: "cash", accountCode: "1001", amount: money(payment?.cash) },
    { key: "card", method: "card", accountCode: "1002", amount: money(payment?.card) },
    { key: "online", method: "online", accountCode: "1002", amount: money(payment?.online) },
    { key: "corporate", method: "corporate", accountCode: "1200", amount: money(payment?.corporate) },
  ].filter((part) => part.amount > 0);
}

export async function POST(req) {
  try {
    const auth = requireTenantSession(req, "billing.collect");
    if (auth.error) return auth.error;

    const { tenantId } = auth;
    const { connection, BillingRecord, Doctor, PaymentReceipt, CorporateAccount } =
      await getTenantModels(tenantId);

    const { billingRecordId, payment, corporateAccountId } = await req.json();

    if (!billingRecordId) {
      return Response.json({ error: "Billing record ID is required" }, { status: 400 });
    }

    const billingRecord = await BillingRecord.findOne({ _id: billingRecordId, tenantId });
    if (!billingRecord) {
      return Response.json({ error: "Billing record not found" }, { status: 404 });
    }

    if (billingRecord.billingStatus === "paid") {
      return Response.json({ error: "Bill is already paid" }, { status: 400 });
    }

    const paymentParts = getPaymentParts(payment);
    const receivedAmount = money(paymentParts.reduce((sum, part) => sum + part.amount, 0));

    const maxAllowed = 9999999;
    if (payment && receivedAmount <= 0) {
      return Response.json({ error: "Payment amount must be greater than zero" }, { status: 400 });
    }
    if (payment && receivedAmount > maxAllowed) {
      return Response.json({ error: `Payment amount cannot exceed Rs ${maxAllowed.toLocaleString("en-IN")}` }, { status: 400 });
    }

    if (payment && (payment.cash < 0 || payment.card < 0 || payment.online < 0 || payment.corporate < 0)) {
      return Response.json({ error: "Negative payment values are not allowed" }, { status: 400 });
    }

    const result = await connection.transaction(async (session) => {
      const lockedBillingRecord = await BillingRecord.findOne({ _id: billingRecordId, tenantId }).session(session);
      if (!lockedBillingRecord) throw new Error("Billing record not found");
      if (lockedBillingRecord.billingStatus === "paid") throw new Error("Bill is already paid");

      await seedSystemChartOfAccounts(connection, tenantId, { session });

      const receivableAccount = await getAccountByCode(connection, tenantId, "1100", { session });

      if (!lockedBillingRecord.invoiceJournalEntryId) {
        const revenueAccount = await getAccountByCode(connection, tenantId, "4001", { session });
        const subtotalAmount = money(lockedBillingRecord.subtotalAmount || lockedBillingRecord.totalAmount);
        const discountAmount = money(lockedBillingRecord.discountAmount);
        const taxAmount = money(lockedBillingRecord.taxAmount);
        const invoiceLines = [
          { accountId: receivableAccount._id, debit: lockedBillingRecord.totalAmount, credit: 0 },
          { accountId: revenueAccount._id, debit: 0, credit: subtotalAmount },
        ];

        if (discountAmount > 0) {
          const discountAccount = await getAccountByCode(connection, tenantId, "4003", { session });
          invoiceLines.push({ accountId: discountAccount._id, debit: discountAmount, credit: 0 });
        }

        if (taxAmount > 0) {
          const taxPayableAccount = await getAccountByCode(connection, tenantId, "2100", { session });
          invoiceLines.push({ accountId: taxPayableAccount._id, debit: 0, credit: taxAmount });
        }

        const invoiceJournalEntry = await postJournalEntry(
          connection,
          {
            tenantId,
            postedBy: auth.session.userId,
            sourceType: "billing",
            sourceId: lockedBillingRecord._id,
            description: `Invoice confirmed for ${lockedBillingRecord.billId}`,
            lines: invoiceLines,
          },
          { session }
        );
        lockedBillingRecord.invoiceJournalEntryId = invoiceJournalEntry._id;
        lockedBillingRecord.invoiceStatus = "confirmed";
      }

      const receipts = [];

      for (const part of paymentParts) {
        const paymentAccount = await getAccountByCode(connection, tenantId, part.accountCode, { session });
        const [receipt] = await PaymentReceipt.create(
          [
            {
              invoiceId: lockedBillingRecord._id,
              patientId: lockedBillingRecord.patient,
              amount: part.amount,
              method: part.method,
              receivedAt: new Date(),
              receivedBy: auth.session.userId,
              tenantId,
            },
          ],
          { session }
        );

        const journalEntry = await postJournalEntry(
          connection,
          {
            tenantId,
            postedBy: auth.session.userId,
            sourceType: "payment",
            sourceId: receipt._id,
            description: `Payment receipt for ${lockedBillingRecord.billId}`,
            lines: [
              { accountId: paymentAccount._id, debit: part.amount, credit: 0 },
              { accountId: receivableAccount._id, debit: 0, credit: part.amount },
            ],
          },
          { session }
        );

        receipt.journalEntryId = journalEntry._id;
        await receipt.save({ session });
        receipts.push(receipt);
        lockedBillingRecord.paymentReceiptIds.push(receipt._id);
      }

      const corporateAmount = paymentParts.find((part) => part.key === "corporate")?.amount || 0;

      if (corporateAmount > 0) {
        if (!corporateAccountId) throw new Error("Corporate account ID is required for corporate payment");
        const corporateAccount = await CorporateAccount.findById(corporateAccountId).session(session);
        if (!corporateAccount) throw new Error("Corporate account not found");
        const newBalance = money(corporateAccount.outstandingBalance + corporateAmount);
        if (corporateAccount.creditLimit > 0 && newBalance > corporateAccount.creditLimit) {
          throw new Error("Corporate payment exceeds credit limit");
        }
        corporateAccount.outstandingBalance = newBalance;
        await corporateAccount.save({ session });
      }

      const alreadyPaid = money(
        (lockedBillingRecord.paymentBreakdown?.cash || 0) +
          (lockedBillingRecord.paymentBreakdown?.card || 0) +
          (lockedBillingRecord.paymentBreakdown?.online || 0) +
          (lockedBillingRecord.paymentBreakdown?.corporate || 0)
      );
      const remainingDue = money(lockedBillingRecord.totalAmount - alreadyPaid);
      if (receivedAmount > remainingDue) {
        throw new Error("Payment amount cannot exceed bill balance");
      }

      lockedBillingRecord.paymentBreakdown = {
        cash: money((lockedBillingRecord.paymentBreakdown?.cash || 0) + (paymentParts.find((part) => part.key === "cash")?.amount || 0)),
        card: money((lockedBillingRecord.paymentBreakdown?.card || 0) + (paymentParts.find((part) => part.key === "card")?.amount || 0)),
        online: money((lockedBillingRecord.paymentBreakdown?.online || 0) + (paymentParts.find((part) => part.key === "online")?.amount || 0)),
        corporate: money((lockedBillingRecord.paymentBreakdown?.corporate || 0) + corporateAmount),
      };

      const totalPaid = money(alreadyPaid + receivedAmount);
      const isFullyPaid = totalPaid >= money(lockedBillingRecord.totalAmount);

      lockedBillingRecord.billingStatus = isFullyPaid ? "paid" : "partial";
      lockedBillingRecord.invoiceStatus = isFullyPaid ? "paid" : "partial";
      lockedBillingRecord.status = isFullyPaid ? "completed" : "in-progress";

      if (
        isFullyPaid &&
        lockedBillingRecord.referralDoctor &&
        lockedBillingRecord.commissionAmount > 0 &&
        !lockedBillingRecord.commissionJournalEntryId
      ) {
        const commissionExpenseAccount = await getAccountByCode(connection, tenantId, "5005", { session });
        const referralPayableAccount = await getAccountByCode(connection, tenantId, "2001", { session });
        const commissionJournalEntry = await postJournalEntry(
          connection,
          {
            tenantId,
            postedBy: auth.session.userId,
            sourceType: "commission",
            sourceId: lockedBillingRecord._id,
            description: `Referral commission approved for ${lockedBillingRecord.billId}`,
            lines: [
              { accountId: commissionExpenseAccount._id, debit: lockedBillingRecord.commissionAmount, credit: 0 },
              { accountId: referralPayableAccount._id, debit: 0, credit: lockedBillingRecord.commissionAmount },
            ],
          },
          { session }
        );

        lockedBillingRecord.commissionJournalEntryId = commissionJournalEntry._id;
        await Doctor.findByIdAndUpdate(
          lockedBillingRecord.referralDoctor,
          { $inc: { pendingPayout: lockedBillingRecord.commissionAmount } },
          { session }
        );
      }

      await lockedBillingRecord.save({ session });

      return {
        billId: lockedBillingRecord.billId,
        billingStatus: lockedBillingRecord.billingStatus,
        invoiceStatus: lockedBillingRecord.invoiceStatus,
        paidAmount: totalPaid,
        receivedAmount,
        receiptIds: receipts.map((receipt) => receipt._id),
      };
    });

    await writeAuditLog(req, auth, {
      action: "billing.payment_recorded",
      resourceType: "BillingRecord",
      resourceId: billingRecordId,
      metadata: {
        billingStatus: result.billingStatus,
        invoiceStatus: result.invoiceStatus,
        receivedAmount: result.receivedAmount,
      },
    });

    return Response.json({
      message: result.billingStatus === "paid" ? "Bill closed successfully" : "Payment recorded successfully",
      ...result,
    });

  } catch (error) {
    if (["Billing record not found", "Bill is already paid", "Payment amount cannot exceed bill balance", "Corporate payment exceeds credit limit"].includes(error.message)) {
      return Response.json(
        { error: error.message },
        { status: error.message === "Billing record not found" ? 404 : 400 }
      );
    }

    return jsonError("Unable to settle bill", error, 500);
  }
}
