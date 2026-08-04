import { NextResponse } from "next/server";
import { requireTenantSession } from "@/app/lib/auth";
import { getTenantModels } from "@/app/lib/tenant-db";
import { jsonError } from "@/app/lib/api-response";
import { getAccountByCode, postJournalEntry, seedSystemChartOfAccounts } from "@/app/lib/accounting";
import { writeAuditLog } from "@/app/lib/audit";

function money(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export async function GET(req) {
  try {
    const auth = requireTenantSession(req, "billing.collect");
    if (auth.error) return auth.error;

    const { tenantId } = auth;
    const { searchParams } = new URL(req.url);
    const qrCodeId = searchParams.get("qrCodeId"); // Payment Link ID
    const billingRecordId = searchParams.get("billingRecordId");

    if (!qrCodeId || !billingRecordId) {
      return NextResponse.json({ error: "Missing qrCodeId or billingRecordId" }, { status: 400 });
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return NextResponse.json({ error: "Razorpay integration is not configured" }, { status: 500 });
    }

    const { connection, BillingRecord, Doctor, PaymentReceipt } = await getTenantModels(tenantId);

    const billingRecord = await BillingRecord.findOne({ _id: billingRecordId, tenantId });
    if (!billingRecord) {
      return NextResponse.json({ error: "Billing record not found" }, { status: 404 });
    }

    // Call Razorpay API to check payment link status
    const authHeader = "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const rzpResponse = await fetch(`https://api.razorpay.com/v1/payment_links/${qrCodeId}`, {
      method: "GET",
      headers: {
        "Authorization": authHeader,
      },
    });

    const data = await rzpResponse.json();

    if (!rzpResponse.ok) {
      console.error("Razorpay fetch payment link failed:", data);
      return NextResponse.json(
        { error: data.error?.description || "Failed to fetch payment status from Razorpay" },
        { status: rzpResponse.status }
      );
    }

    const isPaid = data.status === "paid" || data.status === "partially_paid";

    if (!isPaid || data.amount_paid <= 0) {
      return NextResponse.json({ paid: false });
    }

    const receivedAmount = money(data.amount_paid / 100); // convert from paise to rupees
    const paymentId = (data.payments && data.payments[0]?.payment_id) || `plink_${qrCodeId}`;

    // Proceed with LIMS billing settlement transaction (same as settle route)
    const result = await connection.transaction(async (session) => {
      const lockedBillingRecord = await BillingRecord.findOne({ _id: billingRecordId, tenantId }).session(session);
      if (!lockedBillingRecord) throw new Error("Billing record not found");
      
      // If the bill has already been marked as paid by a concurrent process, check if we need to skip
      if (lockedBillingRecord.billingStatus === "paid") {
        return {
          billId: lockedBillingRecord.billId,
          billingStatus: lockedBillingRecord.billingStatus,
          invoiceStatus: lockedBillingRecord.invoiceStatus,
          alreadySetted: true,
        };
      }

      await seedSystemChartOfAccounts(connection, tenantId, { session });
      const receivableAccount = await getAccountByCode(connection, tenantId, "1100", { session });

      // Confirm invoice if not done
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

      // Check if this particular payment transaction has already been registered in LIMS
      const existingReceipt = await PaymentReceipt.findOne({
        invoiceId: lockedBillingRecord._id,
        amount: receivedAmount,
        method: "upi",
        tenantId,
        notes: `rzp_pay_id:${paymentId}`,
      }).session(session);

      if (existingReceipt) {
        return {
          billId: lockedBillingRecord.billId,
          billingStatus: lockedBillingRecord.billingStatus,
          invoiceStatus: lockedBillingRecord.invoiceStatus,
          alreadySetted: true,
        };
      }

      // Record UPI payment receipt
      const paymentAccount = await getAccountByCode(connection, tenantId, "1002", { session }); // online bank account
      const [receipt] = await PaymentReceipt.create(
        [
          {
            invoiceId: lockedBillingRecord._id,
            patientId: lockedBillingRecord.patient,
            amount: receivedAmount,
            method: "upi",
            receivedAt: new Date(),
            receivedBy: auth.session.userId,
            tenantId,
            notes: `rzp_pay_id:${paymentId}`,
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
          description: `Payment receipt for ${lockedBillingRecord.billId} via Razorpay Link`,
          lines: [
            { accountId: paymentAccount._id, debit: receivedAmount, credit: 0 },
            { accountId: receivableAccount._id, debit: 0, credit: receivedAmount },
          ],
        },
        { session }
      );

      receipt.journalEntryId = journalEntry._id;
      await receipt.save({ session });
      lockedBillingRecord.paymentReceiptIds.push(receipt._id);

      const alreadyPaid = money(
        (lockedBillingRecord.paymentBreakdown?.cash || 0) +
          (lockedBillingRecord.paymentBreakdown?.card || 0) +
          (lockedBillingRecord.paymentBreakdown?.online || 0) +
          (lockedBillingRecord.paymentBreakdown?.corporate || 0)
      );

      lockedBillingRecord.paymentBreakdown = {
        cash: lockedBillingRecord.paymentBreakdown?.cash || 0,
        card: lockedBillingRecord.paymentBreakdown?.card || 0,
        online: money((lockedBillingRecord.paymentBreakdown?.online || 0) + receivedAmount),
        corporate: lockedBillingRecord.paymentBreakdown?.corporate || 0,
      };

      const totalPaid = money(alreadyPaid + receivedAmount);
      const isFullyPaid = totalPaid >= money(lockedBillingRecord.totalAmount);

      lockedBillingRecord.billingStatus = isFullyPaid ? "paid" : "partial";
      lockedBillingRecord.invoiceStatus = isFullyPaid ? "paid" : "partial";
      lockedBillingRecord.status = isFullyPaid ? "completed" : "in-progress";

      if (!lockedBillingRecord.firstPaymentDate) {
        lockedBillingRecord.firstPaymentDate = new Date();
      }

      lockedBillingRecord.lastPaymentDate = new Date();
      lockedBillingRecord.lastPaymentAmount = receivedAmount;
      lockedBillingRecord.lastPaymentMethod = "upi";
      lockedBillingRecord.lastPaymentModes = ["upi"];

      // Doctor referral commission
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
        source: "razorpay_payment_link_auto_settle",
      },
    });

    return NextResponse.json({ paid: true, result });
  } catch (err) {
    console.error("GET /api/billing/razorpay/status error:", err);
    return jsonError("Unable to fetch status", err, 500);
  }
}
