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

    const { BillingRecord, TestReport, Sample, Patient } = await getTenantModels(auth.tenantId);

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

      // Doctor referral stats — commission amounts only for users with accounts.view
      safeMetric("doctor-referrals", BillingRecord.aggregate([
        { $match: { createdAt: { $gte: since }, referralDoctor: { $exists: true, $ne: null } } },
        {
          $group: {
            _id: "$referralDoctor",
            bills: { $sum: 1 },
            revenue: { $sum: { $ifNull: ["$totalAmount", 0] } },
            commission: { $sum: { $ifNull: ["$commissionAmount", 0] } },
          },
        },
        { $sort: { bills: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: "doctors",
            localField: "_id",
            foreignField: "_id",
            as: "doctor",
          },
        },
        { $unwind: { path: "$doctor", preserveNullAndEmpty: true } },
        {
          $project: {
            name: "$doctor.name",
            doctorId: "$doctor.doctorId",
            bills: 1,
            revenue: 1,
            ...(hasPermission(auth.session, "accounts.view") ? { commission: 1 } : {}),
          },
        },
      ]), []),

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
    });
  } catch (error) {
    return jsonError("Unable to load analytics", error, 500);
  }
}
