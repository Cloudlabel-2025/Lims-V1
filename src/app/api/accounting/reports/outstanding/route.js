import { jsonError } from "@/app/lib/api-response";
import { getTenantModels } from "@/app/lib/tenant-db";
import { requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";
import { exportOutstanding } from "@/app/lib/excel-export";
import { exportOutstandingPdf, generateCsv } from "@/app/lib/pdf-export";

export async function GET(req) {
  try {
    const auth = requireTenantSession(req, "accounts.view");
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "accounts.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { searchParams } = new URL(req.url);
    const fullView = searchParams.get("fullView") === "true";
    const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10));
    const limit = fullView ? 9999 : Math.min(100, Math.max(1, Number.parseInt(searchParams.get("limit") || "20", 10)));
    const exportFormat = searchParams.get("export");

    const { JournalEntry } = await getTenantModels(auth.tenantId);

    // Total billed from billing journal entries (sum of all debit lines)
    const [billingTotals] = await JournalEntry.aggregate([
      { $match: { tenantId: auth.tenantId, sourceType: "billing", isReversed: { $ne: true } } },
      { $unwind: "$lines" },
      {
        $group: {
          _id: null,
          totalBilled: { $sum: "$lines.debit" },
        },
      },
    ]);

    // Total collected from payment journal entries (sum of all debit lines = amounts received)
    const [paymentTotals] = await JournalEntry.aggregate([
      { $match: { tenantId: auth.tenantId, sourceType: "payment" } },
      { $unwind: "$lines" },
      { $match: { "lines.debit": { $gt: 0 } } },
      {
        $group: {
          _id: null,
          totalCollected: { $sum: "$lines.debit" },
        },
      },
    ]);

    const totalBilled = billingTotals?.totalBilled || 0;
    const totalCollected = paymentTotals?.totalCollected || 0;
    const totalOutstanding = Math.max(0, Math.round((totalBilled - totalCollected) * 100) / 100);

    // List individual billing entries that are not reversed
    const billingEntries = await JournalEntry.find({
      tenantId: auth.tenantId,
      sourceType: "billing",
      isReversed: { $ne: true },
    })
      .populate("postedBy", "firstName lastName")
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const rows = billingEntries.map((entry) => {
      const amount = entry.lines.reduce((s, l) => s + (l.debit || 0), 0);
      // Extract billId from description or use entryNumber
      const billMatch = entry.description?.match(/BILL-\d+/);
      const billId = billMatch ? billMatch[0] : entry.entryNumber;
      return {
        _id: entry._id,
        entryNumber: entry.entryNumber,
        billId,
        description: entry.description,
        date: entry.date || entry.createdAt,
        amount: Math.round(amount * 100) / 100,
      };
    });

    const total = await JournalEntry.countDocuments({
      tenantId: auth.tenantId,
      sourceType: "billing",
      isReversed: { $ne: true },
    });

    if (exportFormat === "xlsx") {
      const buffer = await exportOutstanding(rows, totalOutstanding, totalBilled, totalCollected);
      return new Response(buffer, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="outstanding-dues.xlsx"`,
        },
      });
    }
    if (exportFormat === "pdf") {
      const buffer = await exportOutstandingPdf(rows, totalOutstanding, totalBilled, totalCollected);
      return new Response(buffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="outstanding-dues.pdf"`,
        },
      });
    }
    if (exportFormat === "csv") {
      const headers = ["Entry", "Bill ID", "Description", "Amount", "Date"];
      const csvRows = rows.map((r) => [r.entryNumber || "", r.billId || "", r.description || "", r.amount, r.date ? new Date(r.date).toLocaleDateString("en-IN") : ""]);
      csvRows.push(["Total Outstanding", "", "", totalOutstanding, ""]);
      csvRows.push(["Total Billed", "", "", totalBilled, ""]);
      csvRows.push(["Total Collected", "", "", totalCollected, ""]);
      const buffer = generateCsv(headers, csvRows);
      return new Response(buffer, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="outstanding-dues.csv"`,
        },
      });
    }

    return Response.json({
      rows,
      totalOutstanding,
      totalBilled: Math.round(totalBilled * 100) / 100,
      totalCollected: Math.round(totalCollected * 100) / 100,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (error) {
    return jsonError("Unable to fetch outstanding dues report", error, 500);
  }
}
