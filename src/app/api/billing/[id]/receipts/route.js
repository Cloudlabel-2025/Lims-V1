import { jsonError } from "@/app/lib/api-response";
import { getTenantModels } from "@/app/lib/tenant-db";
import { requireTenantSession } from "@/app/lib/auth";

export async function GET(req, { params }) {
  try {
    const auth = requireTenantSession(req, "billing.view");
    if (auth.error) return auth.error;

    const { id } = await params;
    const { PaymentReceipt, BillingRecord } = await getTenantModels(auth.tenantId);

    const billingRecord = await BillingRecord.findById(id)
      .select("billId patient totalAmount billingStatus items")
      .populate("patient", "name patientId")
      .lean();

    if (!billingRecord) {
      return Response.json({ error: "Billing record not found" }, { status: 404 });
    }

    const receipts = await PaymentReceipt.find({ invoiceId: id, tenantId: auth.tenantId })
      .populate("receivedBy", "name")
      .sort({ receivedAt: -1 })
      .lean();

    let runningTotal = 0;
    const receiptsWithTotals = receipts.map((receipt) => {
      runningTotal += Number(receipt.amount || 0);
      return {
        _id: receipt._id.toString(),
        amount: Number(receipt.amount || 0),
        method: receipt.method,
        receivedAt: receipt.receivedAt,
        receivedBy: receipt.receivedBy?.name || "—",
        isRefunded: receipt.isRefunded || false,
        runningTotal,
        remaining: Math.max(0, Number(billingRecord.totalAmount || 0) - runningTotal),
      };
    });

    return Response.json({
      receipts: receiptsWithTotals,
      billSummary: {
        billId: billingRecord.billId,
        patient: billingRecord.patient,
        totalAmount: billingRecord.totalAmount,
        billingStatus: billingRecord.billingStatus,
        investigationCount: billingRecord.items?.length || 0,
      },
    });
  } catch (error) {
    return jsonError("Unable to load receipts", error, 500);
  }
}