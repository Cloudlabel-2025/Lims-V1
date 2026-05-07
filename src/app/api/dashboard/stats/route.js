import { getTenantModels } from "@/app/lib/tenant-db";
import { requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";

export async function GET(req) {
  try {
    const auth = requireTenantSession(req, "dashboard.view");
    if (auth.error) return auth.error;

    const { tenantId } = auth;
    const moduleAuth = await requireEnabledTenantModule(tenantId, "dashboard.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { Patient, Doctor, TestReport } = await getTenantModels(tenantId);

    // 1. Total Counts
    const totalPatients = await Patient.countDocuments({});
    const totalDoctors = await Doctor.countDocuments({});

    // 2. Today's Registrations
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayPatients = await Patient.countDocuments({
      createdAt: { $gte: startOfToday }
    });

    // 3. Reports & Tests
    const reportsReady = await TestReport.countDocuments({ status: { $in: ["completed", "verified", "released"] } });
    const pendingReports = await TestReport.countDocuments({ status: "draft" });

    // 4. Recent Patients (Last 5)
    const recentPatients = await Patient.find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .select("name patientId age gender createdAt");

    return Response.json({
      totalPatients,
      totalDoctors,
      todayPatients,
      reportsReady,
      pendingReports,
      recentPatients
    });

  } catch (err) {
    console.error("Dashboard Stats API Error:", err);
    return Response.json({ error: "Failed to fetch dashboard stats" }, { status: 500 });
  }
}
