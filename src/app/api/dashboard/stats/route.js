import { getTenantModels } from "@/app/lib/tenant-db";
import { hasPermission, requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";

export async function GET(req) {
  try {
    const auth = requireTenantSession(req, "dashboard.view");
    if (auth.error) return auth.error;

    const { tenantId } = auth;
    const moduleAuth = await requireEnabledTenantModule(tenantId, "dashboard.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { Patient, Doctor, TestReport } = await getTenantModels(tenantId);
    const canViewPatients = hasPermission(auth.session, "patients.view");
    const canViewDoctors = hasPermission(auth.session, "doctors.view");
    const canViewReports = hasPermission(auth.session, "reports.view");

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const [
      totalPatients,
      todayPatients,
      recentPatients,
      totalDoctors,
      reportsReady,
      pendingReports,
    ] = await Promise.all([
      canViewPatients ? Patient.countDocuments({}) : Promise.resolve(null),
      canViewPatients
        ? Patient.countDocuments({ createdAt: { $gte: startOfToday } })
        : Promise.resolve(null),
      canViewPatients
        ? Patient.find({}).sort({ createdAt: -1 }).limit(5).select("name patientId age gender createdAt")
        : Promise.resolve([]),
      canViewDoctors ? Doctor.countDocuments({}) : Promise.resolve(null),
      canViewReports
        ? TestReport.countDocuments({ status: { $in: ["completed", "verified", "released"] } })
        : Promise.resolve(null),
      canViewReports ? TestReport.countDocuments({ status: "draft" }) : Promise.resolve(null),
    ]);

    return Response.json({
      totalPatients,
      totalDoctors,
      todayPatients,
      reportsReady,
      pendingReports,
      recentPatients,
      permissions: {
        patients: canViewPatients,
        doctors: canViewDoctors,
        reports: canViewReports,
      },
    });

  } catch (err) {
    console.error("Dashboard Stats API Error:", err);
    return Response.json({ error: "Failed to fetch dashboard stats" }, { status: 500 });
  }
}
