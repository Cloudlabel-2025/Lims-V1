import { jsonError } from "@/app/lib/api-response";
import { getTenantModels } from "@/app/lib/tenant-db";
import { requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";

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

    const { BillingRecord, TestReport, Sample, Doctor, Patient } = await getTenantModels(auth.tenantId);

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
      BillingRecord.aggregate([
        { $match: { createdAt: { $gte: since }, billingStatus: { $in: ["paid", "partial"] } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            revenue: { $sum: "$totalAmount" },
            bills: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Top tests by volume
      BillingRecord.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.testSnapshot.name",
            count: { $sum: 1 },
            revenue: { $sum: "$items.testSnapshot.price" },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),

      // Doctor referral stats
      BillingRecord.aggregate([
        { $match: { createdAt: { $gte: since }, referralDoctor: { $exists: true, $ne: null } } },
        {
          $group: {
            _id: "$referralDoctor",
            bills: { $sum: 1 },
            revenue: { $sum: "$totalAmount" },
            commission: { $sum: "$commissionAmount" },
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
            commission: 1,
          },
        },
      ]),

      // Report status breakdown
      TestReport.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),

      // Sample status breakdown
      Sample.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),

      // Total revenue in range
      BillingRecord.aggregate([
        { $match: { createdAt: { $gte: since }, billingStatus: { $in: ["paid", "partial"] } } },
        { $group: { _id: null, total: { $sum: "$totalAmount" }, count: { $sum: 1 } } },
      ]),

      BillingRecord.countDocuments({ createdAt: { $gte: since } }),
      Patient.countDocuments({}),
      Patient.countDocuments({ createdAt: { $gte: since } }),
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
