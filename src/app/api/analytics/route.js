import { jsonError } from "@/app/lib/api-response";
import { getTenantModels } from "@/app/lib/tenant-db";
import { hasPermission, requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";

async function safeMetric(label, task, fallback) {
  try {
    return await task;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error(`[analytics] ${label} failed`, error);
    }
    return fallback;
  }
}

export async function GET(req) {
  try {
    const auth = requireTenantSession(req, "analytics.view");
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "analytics.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { searchParams } = new URL(req.url);
    const range = searchParams.get("range") || "30";
    const days = Math.min(Math.max(parseInt(range, 10) || 30, 7), 365);

    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const { BillingRecord, TestReport, Sample, Patient, Doctor, ExpenseEntry, InventoryItem, InventoryCategory } = await getTenantModels(auth.tenantId);

    const [
      revenueSeries,
      testVolume,
      doctorReferrals,
      reportStatusCounts,
      sampleStatusCounts,
      totalRevenue,
      totalBills,
      totalPatients,
      newPatients,
      expenseBreakdown,
      inventoryValuation,
    ] = await Promise.all([
      // Daily revenue for chart
      safeMetric("revenue-series", BillingRecord.aggregate([
        { $match: { createdAt: { $gte: since }, billingStatus: { $in: ["paid", "partial"] } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            revenue: { $sum: { $ifNull: ["$totalAmount", 0] } },
            bills: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]), []),

      // Top tests by volume
      safeMetric("test-volume", BillingRecord.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $unwind: "$items" },
        {
          $group: {
            _id: { $ifNull: ["$items.testSnapshot.name", "Unknown test"] },
            count: { $sum: 1 },
            revenue: { $sum: { $ifNull: ["$items.testSnapshot.price", 0] } },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]), []),

      // Doctor referral stats — uses Mongoose queries instead of aggregation for reliability
      safeMetric("doctor-referrals", (async () => {
        const canViewCommission = hasPermission(auth.session, "accounts.view");

        const [recordsWithRef, allDoctors, recordsWithoutRef] = await Promise.all([
          BillingRecord.find({ createdAt: { $gte: since }, referralDoctor: { $ne: null, $exists: true } })
            .select("referralDoctor totalAmount commissionAmount")
            .lean(),
          Doctor.find({}).select("name doctorId").lean(),
          BillingRecord.find({ createdAt: { $gte: since }, $or: [{ referralDoctor: { $exists: false } }, { referralDoctor: null }] })
            .populate("patient", "refDoctorName")
            .select("referralDoctor totalAmount commissionAmount patient")
            .lean(),
        ]);

        const doctorById = new Map(allDoctors.map(d => [String(d._id), d]));

        // Group by doctor from records with referralDoctor set
        const stats = new Map();
        for (const r of recordsWithRef) {
          if (!r.referralDoctor) continue;
          const key = String(r.referralDoctor);
          const entry = stats.get(key) || { _id: r.referralDoctor, bills: 0, revenue: 0, commission: 0 };
          entry.bills += 1;
          entry.revenue += r.totalAmount || 0;
          entry.commission += r.commissionAmount || 0;
          stats.set(key, entry);
        }

        // Fallback: match records without referralDoctor via patient's refDoctorName
        for (const r of recordsWithoutRef) {
          const refName = r.patient?.refDoctorName?.trim();
          if (!refName) continue;

          let matched = allDoctors.find(d => d.name.toLowerCase() === refName.toLowerCase());
          if (!matched && refName.includes(" ")) {
            const lastName = refName.split(" ").pop().toLowerCase();
            matched = allDoctors.find(d => d.name.toLowerCase().includes(lastName));
          }
          if (!matched) continue;

          const key = String(matched._id);
          const entry = stats.get(key) || { _id: matched._id, bills: 0, revenue: 0, commission: 0 };
          entry.bills += 1;
          entry.revenue += r.totalAmount || 0;
          entry.commission += r.commissionAmount || 0;
          stats.set(key, entry);
        }

        const sorted = [...stats.values()].sort((a, b) => b.bills - a.bills).slice(0, 10);

        return sorted.map(d => ({
          name: doctorById.get(String(d._id))?.name || null,
          doctorId: doctorById.get(String(d._id))?.doctorId || null,
          bills: d.bills,
          revenue: d.revenue,
          ...(canViewCommission ? { commission: d.commission } : {}),
        }));
      })(), []),

      // Report status breakdown
      safeMetric("report-status-counts", TestReport.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: { $ifNull: ["$status", "unknown"] }, count: { $sum: 1 } } },
      ]), []),

      // Sample status breakdown
      safeMetric("sample-status-counts", Sample.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: { $ifNull: ["$status", "unknown"] }, count: { $sum: 1 } } },
      ]), []),

      // Total revenue in range
      safeMetric("total-revenue", BillingRecord.aggregate([
        { $match: { createdAt: { $gte: since }, billingStatus: { $in: ["paid", "partial"] } } },
        { $group: { _id: null, total: { $sum: { $ifNull: ["$totalAmount", 0] } }, count: { $sum: 1 } } },
      ]), []),

      safeMetric("total-bills", BillingRecord.countDocuments({ createdAt: { $gte: since } }), 0),
      safeMetric("total-patients", Patient.countDocuments({}), 0),
      safeMetric("new-patients", Patient.countDocuments({ createdAt: { $gte: since } }), 0),

      // Expense breakdown by category
      safeMetric("expense-breakdown", ExpenseEntry.aggregate([
        { $match: { date: { $gte: since } } },
        {
          $group: {
            _id: "$category",
            amount: { $sum: { $add: ["$amount", { $ifNull: ["$taxAmount", 0] }] } },
            count: { $sum: 1 },
          },
        },
        { $sort: { amount: -1 } },
      ]), []),

      // Inventory valuation — total stock value by category
      safeMetric("inventory-valuation", InventoryItem.aggregate([
        { $match: { status: "active" } },
        {
          $lookup: {
            from: "inventorycategories",
            localField: "category",
            foreignField: "_id",
            as: "cat",
          },
        },
        { $unwind: { path: "$cat", preserveNullAndEmptyArrays: true } },
        { $unwind: { path: "$batches", preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: { $ifNull: ["$cat.name", "Uncategorized"] },
            items: { $addToSet: "$_id" },
            totalStock: { $sum: { $ifNull: ["$stockOnHandBase", 0] } },
            totalValue: {
              $sum: {
                $multiply: [
                  { $ifNull: ["$batches.quantityBase", 0] },
                  { $ifNull: ["$batches.costPerBaseUnit", 0] },
                ],
              },
            },
          },
        },
        {
          $project: {
            _id: 1,
            items: { $size: "$items" },
            totalStock: 1,
            totalValue: 1,
          },
        },
        { $sort: { totalValue: -1 } },
      ]), []),
    ]);

    return Response.json({
      range: days,
      since: since.toISOString(),
      summary: {
        totalRevenue: totalRevenue[0]?.total || 0,
        paidBills: totalRevenue[0]?.count || 0,
        totalBills,
        totalPatients,
        newPatients,
      },
      revenueSeries,
      testVolume,
      doctorReferrals,
      reportStatusCounts,
      sampleStatusCounts,
      expenseBreakdown,
      inventoryValuation,
    });
  } catch (error) {
    return jsonError("Unable to load analytics", error, 500);
  }
}
