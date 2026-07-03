import { jsonError } from "@/app/lib/api-response";
import { getTenantModels } from "@/app/lib/tenant-db";
import { requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";
import { exportDailyCollection } from "@/app/lib/excel-export";

export async function GET(req) {
  try {
    const auth = requireTenantSession(req, "billing.view");
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "billing");
    if (moduleAuth.error) return moduleAuth.error;

    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const isExport = searchParams.get("export") === "xlsx";
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

    const match = { tenantId: auth.tenantId, sourceType: "payment" };
    if (Object.keys(dateFilter).length) match.date = dateFilter;

    const pipeline = [
      { $match: match },
      { $unwind: "$lines" },
      { $match: { "lines.debit": { $gt: 0 } } },
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
            date: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
            code: "$account.code",
          },
          amount: { $sum: "$lines.debit" },
        },
      },
      { $sort: { "_id.date": -1 } },
    ];

    const grouped = await JournalEntry.aggregate(pipeline);

    const dailyMap = {};
    for (const g of grouped) {
      const date = g._id.date;
      const code = g._id.code;
      if (!dailyMap[date]) dailyMap[date] = { date, cash: 0, card: 0, upi: 0, other: 0, total: 0 };
      if (code === "1001") dailyMap[date].cash += g.amount;
      else if (code === "1002") dailyMap[date].card += g.amount;
      else dailyMap[date].other += g.amount;
      dailyMap[date].total += g.amount;
    }

    const daily = Object.values(dailyMap).sort((a, b) => b.date.localeCompare(a.date));

    const totalCollection = daily.reduce((s, d) => s + d.total, 0);
    const breakdown = daily.reduce(
      (b, d) => ({
        cash: b.cash + d.cash,
        card: b.card + d.card,
        upi: 0,
        other: b.other + d.other,
      }),
      { cash: 0, card: 0, upi: 0, other: 0 }
    );

    if (isExport) {
      const buffer = await exportDailyCollection(daily, totalCollection, breakdown);
      return new Response(buffer, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="daily-collection-${from || "all"}-${to || "all"}.xlsx"`,
        },
      });
    }

    const total = daily.length;
    const paginatedDaily = daily.slice((page - 1) * limit, page * limit);

    return Response.json({
      daily: paginatedDaily,
      totalCollection,
      breakdown,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (error) {
    return jsonError("Unable to fetch daily collection report", error, 500);
  }
}
