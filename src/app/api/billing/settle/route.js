import { getAccountByCode, postJournalEntry, seedSystemChartOfAccounts } from "@/app/lib/accounting";
import { jsonError } from "@/app/lib/api-response";
import { getTenantModels } from "@/app/lib/tenant-db";
import { requireTenantSession } from "@/app/lib/auth";

function money(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function getPaymentParts(payment) {
  return [
    { key: "cash", method: "cash", accountCode: "1001", amount: money(payment?.cash) },
    { key: "card", method: "card", accountCode: "1002", amount: money(payment?.card) },
    { key: "online", method: "upi", accountCode: "1002", amount: money(payment?.online) },
  ].filter((part) => part.amount > 0);
}

export async function POST(req) {
  try {
    const auth = requireTenantSession(req, "billing.collect");
    if (auth.error) return auth.error;

    const { tenantId } = auth;
    const { connection, BillingRecord, Doctor, PaymentReceipt, TestReport, TestDefinition } =
      await getTenantModels(tenantId);
    
    const { billingRecordId, payment, results } = await req.json();

    if (!billingRecordId) {
      return Response.json({ error: "Billing record ID is required" }, { status: 400 });
    }

    const billingRecord = await BillingRecord.findById(billingRecordId);
    if (!billingRecord) {
      return Response.json({ error: "Billing record not found" }, { status: 404 });
    }

    if (billingRecord.billingStatus === "paid") {
      return Response.json({ error: "Bill is already paid" }, { status: 400 });
    }

    const paymentParts = getPaymentParts(payment);
    const receivedAmount = money(paymentParts.reduce((sum, part) => sum + part.amount, 0));

    if (payment && receivedAmount <= 0) {
      return Response.json({ error: "Payment amount must be greater than zero" }, { status: 400 });
    }

    const result = await connection.transaction(async (session) => {
      const lockedBillingRecord = await BillingRecord.findById(billingRecordId).session(session);
      if (!lockedBillingRecord) throw new Error("Billing record not found");
      if (lockedBillingRecord.billingStatus === "paid") throw new Error("Bill is already paid");

      if (!lockedBillingRecord.tenantId) {
        lockedBillingRecord.tenantId = tenantId;
      }

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

      lockedBillingRecord.paymentBreakdown = {
        cash: money((lockedBillingRecord.paymentBreakdown?.cash || 0) + (paymentParts.find((part) => part.key === "cash")?.amount || 0)),
        card: money((lockedBillingRecord.paymentBreakdown?.card || 0) + (paymentParts.find((part) => part.key === "card")?.amount || 0)),
        online: money((lockedBillingRecord.paymentBreakdown?.online || 0) + (paymentParts.find((part) => part.key === "online")?.amount || 0)),
      };

      const totalPaid = money(
        lockedBillingRecord.paymentBreakdown.cash +
          lockedBillingRecord.paymentBreakdown.card +
          lockedBillingRecord.paymentBreakdown.online
      );
      const isFullyPaid = totalPaid >= money(lockedBillingRecord.totalAmount);

      lockedBillingRecord.billingStatus = isFullyPaid ? "paid" : "partial";
      lockedBillingRecord.invoiceStatus = isFullyPaid ? "paid" : "partial";
      lockedBillingRecord.status = isFullyPaid ? "completed" : "in-progress";

      if (results) {
        for (const item of lockedBillingRecord.items) {
          const itemResults = results[item._id];
          if (itemResults && Object.keys(itemResults).length > 0) {
            const testDef = await TestDefinition.findById(item.testDefinition).session(session);
            if (testDef) {
              const reportResults = testDef.parameters.map((param) => {
                const val = itemResults[param.key];
                let flag = "normal";
                const numVal = parseFloat(val);

                if (!Number.isNaN(numVal)) {
                  if (param.normalMin !== undefined && numVal < param.normalMin) flag = "low";
                  else if (param.normalMax !== undefined && numVal > param.normalMax) flag = "high";
                }

                return {
                  key: param.key,
                  name: param.name,
                  unit: param.unit,
                  normalMin: param.normalMin,
                  normalMax: param.normalMax,
                  value: Number.isNaN(numVal) ? undefined : numVal,
                  textValue: val,
                  flag,
                };
              });

              await TestReport.create(
                [
                  {
                    patient: lockedBillingRecord.patient,
                    testDefinition: testDef._id,
                    testSnapshot: item.testSnapshot,
                    results: reportResults,
                    status: "completed",
                    enteredBy: auth.session?.email || "System",
                  },
                ],
                { session }
              );

              item.status = "reported";
            }
          }
        }
      }

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

    const { AuditLog } = await getTenantModels(tenantId);
    AuditLog.create({ action: "billing.settle", userId: auth.session.userId, tenantId, resourceType: "BillingRecord", resourceId: billingRecordId, ipAddress: req.headers.get("x-forwarded-for") || "" }).catch(() => {});

    return Response.json({
      message: result.billingStatus === "paid" ? "Bill closed successfully" : "Payment recorded successfully",
      ...result,
    });

  } catch (error) {
    if (["Billing record not found", "Bill is already paid"].includes(error.message)) {
      return Response.json(
        { error: error.message },
        { status: error.message === "Billing record not found" ? 404 : 400 }
      );
    }

    return jsonError("Unable to settle bill", error, 500);
  }
}
