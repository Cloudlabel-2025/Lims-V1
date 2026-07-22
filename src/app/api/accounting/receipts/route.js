import { jsonError } from "@/app/lib/api-response";
import { getTenantModels } from "@/app/lib/tenant-db";
import { requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";
import { exportReceipts } from "@/app/lib/excel-export";
import { exportReceiptsPdf, generateCsv } from "@/app/lib/pdf-export";

export async function GET(req) {
  try {
    const auth = requireTenantSession(req, "billing.view");
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "billing");
    if (moduleAuth.error) return moduleAuth.error;

    const { searchParams } = new URL(req.url);
    const exportFormat = searchParams.get("export");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const method = searchParams.get("method");

    const filter = { tenantId: auth.tenantId };
    if (method && ["cash", "card", "upi", "cheque", "corporate-credit"].includes(method)) {
      filter.method = method;
    }

    const { PaymentReceipt } = await getTenantModels(auth.tenantId);

    let receipts;
    if (exportFormat) {
      receipts = await PaymentReceipt.find(filter)
        .sort({ receivedAt: -1 })
        .populate("patientId", "name patientId phone")
        .populate("invoiceId", "billId totalAmount")
        .lean();
    } else {
      receipts = await PaymentReceipt.find(filter)
        .sort({ receivedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("patientId", "name patientId phone")
        .populate("invoiceId", "billId totalAmount")
        .lean();
    }

    if (exportFormat === "xlsx") {
      const buffer = await exportReceipts(receipts);
      return new Response(buffer, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": 'attachment; filename="receipts.xlsx"',
        },
      });
    }
    if (exportFormat === "pdf") {
      const buffer = await exportReceiptsPdf(receipts);
      return new Response(buffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": 'attachment; filename="receipts.pdf"',
        },
      });
    }
    if (exportFormat === "csv") {
      const headers = ["Date", "Patient", "Invoice", "Amount", "Method", "Refunded", "Ref #"];
      const rows = receipts.map((r) => [
        r.receivedAt ? new Date(r.receivedAt).toLocaleDateString("en-IN") : "",
        r.patientId?.name || "-",
        r.invoiceId?.billId || "-",
        String(r.amount),
        r.method || "",
        r.isRefunded ? "Refunded" : "Clear",
        r.journalEntryId ? `JE-${String(r.journalEntryId).slice(-6)}` : "-",
      ]);
      const csv = generateCsv(headers, rows);
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="receipts.csv"',
        },
      });
    }

    const total = await PaymentReceipt.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    return Response.json({
      receipts,
      pagination: { page, limit, total, totalPages },
    });
  } catch (error) {
    return jsonError("Unable to fetch receipts", error, 500);
  }
}
