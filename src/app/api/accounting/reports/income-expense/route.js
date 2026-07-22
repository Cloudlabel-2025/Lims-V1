import { jsonError } from "@/app/lib/api-response";
import { getTenantModels } from "@/app/lib/tenant-db";
import { requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";
import { exportIncomeExpense } from "@/app/lib/excel-export";
import { exportIncomeExpensePdf, generateCsv } from "@/app/lib/pdf-export";

export async function GET(req) {
  try {
    const auth = requireTenantSession(req, "accounts.view");
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "accounts.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const exportFormat = searchParams.get("export");
    const fullView = searchParams.get("fullView") === "true";
    const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10));
    const limit = fullView ? 9999 : Math.min(100, Math.max(1, Number.parseInt(searchParams.get("limit") || "20", 10)));

    const dateFilter = {};
    if (from) dateFilter.$gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setDate(end.getDate() + 1);
      dateFilter.$lt = end;
    }

    const { JournalEntry, Account } = await getTenantModels(auth.tenantId);

    const match = { tenantId: auth.tenantId };
    if (Object.keys(dateFilter).length) match.date = dateFilter;

    const pipeline = [
      { $match: match },
      { $unwind: "$lines" },
      {
        $lookup: {
          from: Account.collection.name,
          localField: "lines.accountId",
          foreignField: "_id",
          as: "account",
        },
      },
      { $unwind: "$account" },
      {
        $group: {
          _id: {
            month: { $dateToString: { format: "%Y-%m", date: "$date" } },
            type: "$account.type",
            code: "$account.code",
            side: {
              $cond: [{ $gt: ["$lines.debit", 0] }, "debit", "credit"],
            },
          },
          amount: { $sum: { $max: ["$lines.debit", "$lines.credit"] } },
        },
      },
      { $sort: { "_id.month": -1 } },
    ];

    const grouped = await JournalEntry.aggregate(pipeline);

    // Aggregate by month -> { revenue, expenses, discounts }
    const monthMap = {};
    const revenueCodes = ["4001", "4002"];
    const discountCode = "4003";
    const expenseCodes = ["5001", "5002", "5003", "5004", "5005"];

    for (const g of grouped) {
      const month = g._id.month;
      if (!monthMap[month]) monthMap[month] = { month, revenue: 0, discounts: 0, expenses: 0 };

      const code = g._id.code;
      const side = g._id.side;
      const amount = g.amount;

      if (revenueCodes.includes(code) && side === "credit") {
        monthMap[month].revenue += amount;
      } else if (discountCode === code && side === "debit") {
        monthMap[month].discounts += amount;
      } else if (expenseCodes.includes(code) && side === "debit") {
        monthMap[month].expenses += amount;
      }
    }

    const monthly = Object.values(monthMap)
      .map((m) => ({
        ...m,
        netRevenue: Math.round((m.revenue - m.discounts) * 100) / 100,
        netIncome: Math.round((m.revenue - m.discounts - m.expenses) * 100) / 100,
      }))
      .sort((a, b) => b.month.localeCompare(a.month));

    const totals = monthly.reduce(
      (s, m) => ({
        revenue: s.revenue + m.revenue,
        discounts: s.discounts + m.discounts,
        expenses: s.expenses + m.expenses,
        netRevenue: s.netRevenue + m.netRevenue,
        netIncome: s.netIncome + m.netIncome,
      }),
      { revenue: 0, discounts: 0, expenses: 0, netRevenue: 0, netIncome: 0 }
    );

    Object.keys(totals).forEach((k) => { totals[k] = Math.round(totals[k] * 100) / 100; });

    if (exportFormat === "xlsx") {
      const buffer = await exportIncomeExpense(monthly, totals);
      return new Response(buffer, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="income-expense-${from || "all"}-${to || "all"}.xlsx"`,
        },
      });
    }
    if (exportFormat === "pdf") {
      const buffer = await exportIncomeExpensePdf(monthly, totals);
      return new Response(buffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="income-expense-${from || "all"}-${to || "all"}.pdf"`,
        },
      });
    }
    if (exportFormat === "csv") {
      const headers = ["Month", "Revenue", "Discounts", "Net Revenue", "Expenses", "Net Income"];
      const csvRows = monthly.map((m) => [m.month, m.revenue, m.discounts, m.netRevenue, m.expenses, m.netIncome]);
      csvRows.push(["Total", totals.revenue, totals.discounts, totals.netRevenue, totals.expenses, totals.netIncome]);
      const buffer = generateCsv(headers, csvRows);
      return new Response(buffer, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="income-expense-${from || "all"}-${to || "all"}.csv"`,
        },
      });
    }

    const total = monthly.length;
    const paginatedMonthly = monthly.slice((page - 1) * limit, page * limit);

    return Response.json({
      monthly: paginatedMonthly,
      totals,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (error) {
    return jsonError("Unable to fetch income/expense report", error, 500);
  }
}
