import { jsonError } from "@/app/lib/api-response";
import { getTenantModels } from "@/app/lib/tenant-db";
import { requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";
import { exportMonthlyRevenue } from "@/app/lib/excel-export";

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

    const { JournalEntry } = await getTenantModels(auth.tenantId);

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

    const totalRevenue = monthly.reduce((s, m) => s + m.revenue, 0);
    const totalBills = monthly.reduce((s, m) => s + m.bills, 0);

    if (isExport) {
      const buffer = await exportMonthlyRevenue(monthly, totalRevenue, totalBills);
      return new Response(buffer, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="monthly-revenue-${from || "all"}-${to || "all"}.xlsx"`,
        },
      });
    }

    const total = monthly.length;
    const paginatedMonthly = monthly.slice((page - 1) * limit, page * limit);

    return Response.json({
      monthly: paginatedMonthly,
      totalRevenue,
      totalBills,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (error) {
    return jsonError("Unable to fetch monthly revenue report", error, 500);
  }
}
