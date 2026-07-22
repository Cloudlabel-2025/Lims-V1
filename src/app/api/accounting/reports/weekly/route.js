import { jsonError } from "@/app/lib/api-response";
import { getTenantModels } from "@/app/lib/tenant-db";
import { requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";
import { exportWeeklyCollection } from "@/app/lib/excel-export";
import { exportWeeklyCollectionPdf, generateCsv } from "@/app/lib/pdf-export";

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
            year: { $isoWeekYear: "$date" },
            week: { $isoWeek: "$date" },
            code: "$account.code",
          },
          amount: { $sum: "$lines.debit" },
        },
      },
      { $sort: { "_id.year": -1, "_id.week": -1 } },
    ];

    const grouped = await JournalEntry.aggregate(pipeline);

    const weekMap = {};
    for (const g of grouped) {
      const key = `${g._id.year}-W${String(g._id.week).padStart(2, "0")}`;
      const code = g._id.code;
      if (!weekMap[key]) weekMap[key] = { week: key, cash: 0, card: 0, other: 0, total: 0 };
      if (code === "1001") weekMap[key].cash += g.amount;
      else if (code === "1002") weekMap[key].card += g.amount;
      else weekMap[key].other += g.amount;
      weekMap[key].total += g.amount;
    }

    const weekly = Object.values(weekMap).sort((a, b) => b.week.localeCompare(a.week));

    const totalCollection = weekly.reduce((s, w) => s + w.total, 0);
    const breakdown = weekly.reduce(
      (b, w) => ({ cash: b.cash + w.cash, card: b.card + w.card, other: b.other + w.other }),
      { cash: 0, card: 0, other: 0 }
    );

    if (exportFormat === "xlsx") {
      const buffer = await exportWeeklyCollection(weekly, totalCollection, breakdown);
      return new Response(buffer, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="weekly-collection-${from || "all"}-${to || "all"}.xlsx"`,
        },
      });
    }
    if (exportFormat === "pdf") {
      const buffer = await exportWeeklyCollectionPdf(weekly, totalCollection, breakdown);
      return new Response(buffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="weekly-collection-${from || "all"}-${to || "all"}.pdf"`,
        },
      });
    }
    if (exportFormat === "csv") {
      const headers = ["Week", "Cash", "Card", "Other", "Total"];
      const csvRows = weekly.map((w) => [w.week, w.cash, w.card, w.other, w.total]);
      csvRows.push(["Total", "", "", "", totalCollection]);
      const buffer = generateCsv(headers, csvRows);
      return new Response(buffer, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="weekly-collection-${from || "all"}-${to || "all"}.csv"`,
        },
      });
    }

    const total = weekly.length;
    const paginatedWeekly = weekly.slice((page - 1) * limit, page * limit);

    return Response.json({
      weekly: paginatedWeekly,
      totalCollection,
      breakdown,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (error) {
    return jsonError("Unable to fetch weekly collection report", error, 500);
  }
}
