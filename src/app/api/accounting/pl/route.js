import { jsonError } from "@/app/lib/api-response";
import { getTenantModels } from "@/app/lib/tenant-db";
import { requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";
import { exportPl } from "@/app/lib/excel-export";
import { exportPlPdf, generateCsv } from "@/app/lib/pdf-export";

function dateValue(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function GET(req) {
  try {
    const auth = requireTenantSession(req, "accounts.view");
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "accounts.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { searchParams } = new URL(req.url);
    const from = dateValue(searchParams.get("from"));
    const to = dateValue(searchParams.get("to"));
    const exportFormat = searchParams.get("export");

    if (from && to && from > to) {
      return Response.json({ error: "From date must be before To date" }, { status: 400 });
    }

    const { JournalEntry, Account } = await getTenantModels(auth.tenantId);

    const matchStage = { tenantId: auth.tenantId, isReversed: false };
    if (from || to) {
      matchStage.date = {};
      if (from) matchStage.date.$gte = from;
      if (to) {
        const toEnd = new Date(to);
        toEnd.setHours(23, 59, 59, 999);
        matchStage.date.$lte = toEnd;
      }
    }

    const lines = await JournalEntry.aggregate([
      { $match: matchStage },
      { $unwind: "$lines" },
      {
        $group: {
          _id: "$lines.accountId",
          totalDebit: { $sum: "$lines.debit" },
          totalCredit: { $sum: "$lines.credit" },
        },
      },
    ]);

    const accountIds = lines.map((l) => l._id);
    const accounts = await Account.find({
      tenantId: auth.tenantId,
      _id: { $in: accountIds },
      type: { $in: ["revenue", "expense"] },
    })
      .select("_id code name type subtype")
      .lean();

    const accountMap = new Map(accounts.map((a) => [String(a._id), a]));

    const revenue = [];
    const expenses = [];

    for (const line of lines) {
      const account = accountMap.get(String(line._id));
      if (!account) continue;

      const balance =
        account.type === "revenue"
          ? Math.round((line.totalCredit - line.totalDebit) * 100) / 100
          : Math.round((line.totalDebit - line.totalCredit) * 100) / 100;

      const entry = {
        code: account.code,
        name: account.name,
        subtype: account.subtype,
        balance,
      };

      if (account.type === "revenue") revenue.push(entry);
      else expenses.push(entry);
    }

    revenue.sort((a, b) => a.code.localeCompare(b.code));
    expenses.sort((a, b) => a.code.localeCompare(b.code));

    const totalRevenue = Math.round(revenue.reduce((s, a) => s + a.balance, 0) * 100) / 100;
    const totalExpenses = Math.round(expenses.reduce((s, a) => s + a.balance, 0) * 100) / 100;
    const netProfit = Math.round((totalRevenue - totalExpenses) * 100) / 100;

    if (exportFormat === "xlsx") {
      const buffer = await exportPl(revenue, expenses, totalRevenue, totalExpenses, netProfit);
      return new Response(buffer, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="profit-and-loss.xlsx"`,
        },
      });
    }
    if (exportFormat === "pdf") {
      const buffer = await exportPlPdf(revenue, expenses, totalRevenue, totalExpenses, netProfit);
      return new Response(buffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="profit-and-loss.pdf"`,
        },
      });
    }
    if (exportFormat === "csv") {
      const headers = ["Code", "Name", "Balance"];
      const csvRows = [];
      csvRows.push(["--- Revenue ---", "", ""]);
      for (const r of revenue) csvRows.push([r.code, r.name, r.balance]);
      csvRows.push(["", "Total Revenue", totalRevenue]);
      csvRows.push(["--- Expenses ---", "", ""]);
      for (const e of expenses) csvRows.push([e.code, e.name, e.balance]);
      csvRows.push(["", "Total Expenses", totalExpenses]);
      csvRows.push(["", "Net Profit/Loss", netProfit]);
      const buffer = generateCsv(headers, csvRows);
      return new Response(buffer, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="profit-and-loss.csv"`,
        },
      });
    }

    return Response.json({ revenue, expenses, totalRevenue, totalExpenses, netProfit });
  } catch (error) {
    return jsonError("Unable to load P&L", error, 500);
  }
}
