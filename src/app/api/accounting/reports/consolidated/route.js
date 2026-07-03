import { jsonError } from "@/app/lib/api-response";
import { getTenantModels } from "@/app/lib/tenant-db";
import { requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";
import { exportConsolidated } from "@/app/lib/excel-export";

export async function GET(req) {
  try {
    const auth = requireTenantSession(req, "accounts.view");
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "accounts.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const dateFilter = {};
    if (from) dateFilter.$gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setDate(end.getDate() + 1);
      dateFilter.$lt = end;
    }

    const { JournalEntry, Account } = await getTenantModels(auth.tenantId);

    // --- Daily Collection ---
    const dailyMatch = { tenantId: auth.tenantId, sourceType: "payment" };
    if (Object.keys(dateFilter).length) dailyMatch.date = dateFilter;

    const dailyGrouped = await JournalEntry.aggregate([
      { $match: dailyMatch },
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
    ]);

    const dailyMap = {};
    for (const g of dailyGrouped) {
      const date = g._id.date;
      const code = g._id.code;
      if (!dailyMap[date]) dailyMap[date] = { date, cash: 0, card: 0, upi: 0, other: 0, total: 0 };
      if (code === "1001") dailyMap[date].cash += g.amount;
      else if (code === "1002") dailyMap[date].card += g.amount;
      else dailyMap[date].other += g.amount;
      dailyMap[date].total += g.amount;
    }
    const daily = Object.values(dailyMap).sort((a, b) => b.date.localeCompare(a.date));

    // --- Weekly Collection ---
    const weeklyGrouped = await JournalEntry.aggregate([
      { $match: dailyMatch },
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
            year: { $isoWeekYear: "$date" },
            week: { $isoWeek: "$date" },
            code: "$account.code",
          },
          amount: { $sum: "$lines.debit" },
        },
      },
      { $sort: { "_id.year": -1, "_id.week": -1 } },
    ]);

    const weekMap = {};
    for (const g of weeklyGrouped) {
      const key = `${g._id.year}-W${String(g._id.week).padStart(2, "0")}`;
      const code = g._id.code;
      if (!weekMap[key]) weekMap[key] = { week: key, cash: 0, card: 0, other: 0, total: 0 };
      if (code === "1001") weekMap[key].cash += g.amount;
      else if (code === "1002") weekMap[key].card += g.amount;
      else weekMap[key].other += g.amount;
      weekMap[key].total += g.amount;
    }
    const weekly = Object.values(weekMap).sort((a, b) => b.week.localeCompare(a.week));

    // --- Monthly Revenue ---
    const billingMatch = { tenantId: auth.tenantId, sourceType: "billing" };
    if (Object.keys(dateFilter).length) billingMatch.date = dateFilter;

    const paymentMatch = { tenantId: auth.tenantId, sourceType: "payment" };
    if (Object.keys(dateFilter).length) paymentMatch.date = dateFilter;

    const [billMonthly, paymentMonthly] = await Promise.all([
      JournalEntry.aggregate([
        { $match: billingMatch },
        { $unwind: "$lines" },
        {
          $group: {
            _id: { month: { $dateToString: { format: "%Y-%m", date: "$date" } }, entryId: "$_id" },
            revenue: { $sum: "$lines.debit" },
          },
        },
        {
          $group: {
            _id: "$_id.month",
            revenue: { $sum: "$revenue" },
            bills: { $sum: 1 },
          },
        },
        { $sort: { _id: -1 } },
      ]),
      JournalEntry.aggregate([
        { $match: paymentMatch },
        { $unwind: "$lines" },
        { $match: { "lines.debit": { $gt: 0 } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$date" } },
            collection: { $sum: "$lines.debit" },
          },
        },
        { $sort: { _id: -1 } },
      ]),
    ]);

    const paymentMap = {};
    for (const r of paymentMonthly) {
      paymentMap[r._id] = r.collection;
    }

    const monthly = billMonthly.map((m) => ({
      month: m._id,
      bills: m.bills,
      revenue: Math.round(m.revenue * 100) / 100,
      collection: Math.round((paymentMap[m._id] || 0) * 100) / 100,
      outstanding: Math.round(Math.max(0, m.revenue - (paymentMap[m._id] || 0)) * 100) / 100,
    }));

    const buffer = await exportConsolidated({ daily, weekly, monthly });
    return new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="consolidated-report-${from || "all"}-${to || "all"}.xlsx"`,
      },
    });
  } catch (error) {
    return jsonError("Unable to generate consolidated report", error, 500);
  }
}
