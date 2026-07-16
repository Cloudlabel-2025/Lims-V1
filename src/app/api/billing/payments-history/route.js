import { jsonError } from "@/app/lib/api-response";
import { getTenantModels } from "@/app/lib/tenant-db";
import { hasPermission, requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";

function money(value) {
  return Math.max(0, Math.round((Number(value) || 0) * 100) / 100);
}

export async function GET(req) {
  try {
    const auth = requireTenantSession(req, "billing.view");
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "billing.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, Number.parseInt(searchParams.get("limit") || "20", 10)));
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "all";
    const method = searchParams.get("method") || "all";
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    const { PaymentReceipt, BillingRecord, Patient, User } = await getTenantModels(auth.tenantId);

    const query = { tenantId: auth.tenantId };
    if (status !== "all") query.billingStatus = status;
    if (method !== "all") query.method = method;
    if (dateFrom || dateTo) {
      query.receivedAt = {};
      if (dateFrom) query.receivedAt.$gte = new Date(dateFrom);
      if (dateTo) query.receivedAt.$lte = new Date(dateTo);
    }

    // Doctor Regular: scope to receipts for patients they referred
    if (auth.session.doctorId) {
      const billingIds = await BillingRecord.find({ referralDoctor: auth.session.doctorId, tenantId: auth.tenantId }).select("_id").lean();
      query.invoiceId = { $in: billingIds.map((b) => b._id) };
    }

    const receipts = await PaymentReceipt.find(query)
      .populate("patientId", "name patientId")
      .populate("invoiceId", "billId totalAmount billingStatus items")
      .populate("receivedBy", "name")
      .sort({ receivedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Collect invoice IDs from current page receipts
    const invoiceIds = [...new Set(receipts.map((r) => r.invoiceId?._id?.toString() || r.invoiceId?.toString()).filter(Boolean))];

    // For each invoice, fetch ALL its receipts (oldest first) and compute running remaining at each payment
    const runningRemainingByReceiptId = new Map();
    const runningCumulativeByReceiptId = new Map();

    if (invoiceIds.length > 0) {
      const allReceiptsForInvoices = await PaymentReceipt.find({ tenantId: auth.tenantId, invoiceId: { $in: invoiceIds } })
        .select("invoiceId amount receivedAt")
        .sort({ receivedAt: 1 }) // ASC = oldest first
        .lean();

      // Group by invoiceId
      const receiptsByInvoice = new Map();
      for (const r of allReceiptsForInvoices) {
        const id = r.invoiceId?.toString();
        if (!id) continue;
        if (!receiptsByInvoice.has(id)) receiptsByInvoice.set(id, []);
        receiptsByInvoice.get(id).push(r);
      }

      // Get bill totals for these invoices (from the populated receipts on current page)
      const billTotals = new Map();
      for (const r of receipts) {
        const id = r.invoiceId?._id?.toString() || r.invoiceId?.toString();
        if (id && !billTotals.has(id)) {
          billTotals.set(id, money(r.invoiceId?.totalAmount || 0));
        }
      }

      // Compute running remaining for each invoice's receipts
      for (const [invoiceId, invReceipts] of receiptsByInvoice.entries()) {
        const billTotal = billTotals.get(invoiceId) || 0;
        let runningPaid = 0;
        for (const r of invReceipts) {
          runningPaid = money(runningPaid + r.amount);
          const remaining = Math.max(0, billTotal - runningPaid);
          runningCumulativeByReceiptId.set(r._id.toString(), runningPaid);
          runningRemainingByReceiptId.set(r._id.toString(), remaining);
        }
      }
    }

    // Enrich current page receipts with running values
    const enrichedReceipts = [];

    for (const receipt of receipts) {
      const invoiceId = receipt.invoiceId?._id?.toString() || receipt.invoiceId?.toString();
      if (!invoiceId) continue;

      const receiptId = receipt._id.toString();
      const invoiceTotalAmount = money(receipt.invoiceId?.totalAmount || 0);
      const cumulativePaid = runningCumulativeByReceiptId.get(receiptId) || 0;
      const remaining = runningRemainingByReceiptId.get(receiptId) ?? Math.max(0, invoiceTotalAmount - cumulativePaid);

      enrichedReceipts.push({
        _id: receiptId,
        billId: receipt.invoiceId?.billId || "—",
        invoiceId: invoiceId,
        patientName: receipt.patientId?.name || "Unknown",
        patientId: receipt.patientId?.patientId || "—",
        amount: money(receipt.amount),
        method: receipt.method,
        receivedAt: receipt.receivedAt,
        receivedBy: receipt.receivedBy?.name || "—",
        isRefunded: receipt.isRefunded || false,
        cumulativePaid: cumulativePaid,
        remaining: remaining,
        invoiceTotalAmount: invoiceTotalAmount,
        billingStatus: receipt.invoiceId?.billingStatus || "unpaid",
        investigationCount: receipt.invoiceId?.items?.length || 0,
      });
    }

    // Apply search filter
    let filtered = enrichedReceipts;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = enrichedReceipts.filter((t) => {
        if (t.billId?.toLowerCase().includes(q)) return true;
        if (t.patientName?.toLowerCase().includes(q)) return true;
        if (t.patientId?.toLowerCase().includes(q)) return true;
        return false;
      });
    }

    // Get total count for pagination
    const total = await PaymentReceipt.countDocuments(query);

    return Response.json({
      paymentTransactions: filtered,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    return jsonError("Unable to load payment history", error, 500);
  }
}