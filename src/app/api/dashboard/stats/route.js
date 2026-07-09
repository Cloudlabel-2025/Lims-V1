import { getTenantModels } from "@/app/lib/tenant-db";
import { hasPermission, requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";

function debugRequestLog(message, details = {}) {
  if (process.env.NODE_ENV === "production" || process.env.DEBUG_REQUESTS === "false") return;
  const detailText = Object.entries(details)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key}=${value}`)
    .join(" ");
  console.log(`[request:dashboard-stats] ${message}${detailText ? ` ${detailText}` : ""}`);
}

export async function GET(req) {
  try {
    debugRequestLog("start", {
      host: req.headers.get("host"),
    });
    const auth = requireTenantSession(req, "dashboard.view");
    if (auth.error) return auth.error;

    const { tenantId } = auth;
    debugRequestLog("tenant-auth-ok", { tenantId });
    const moduleAuth = await requireEnabledTenantModule(tenantId, "dashboard.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { Patient, Sample, TestReport } = await getTenantModels(tenantId);
    const canViewPatients = hasPermission(auth.session, "patients.view");
    const canViewSamples = hasPermission(auth.session, "samples.view");
    const canViewReports = hasPermission(auth.session, "reports.view");
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const [
      samplesToday,
      pendingSamples,
      todayPatients,
      pendingReports,
      recentPatients,
    ] = await Promise.all([
      canViewSamples
        ? Sample.countDocuments({ createdAt: { $gte: startOfToday } })
        : Promise.resolve(null),
      canViewSamples
        ? Sample.countDocuments({ status: { $in: ["registered", "collected"] } })
        : Promise.resolve(null),
      canViewPatients
        ? Patient.countDocuments({ createdAt: { $gte: startOfToday } })
        : Promise.resolve(null),
      canViewReports ? TestReport.countDocuments({ status: "draft" }) : Promise.resolve(null),
      canViewPatients
        ? Patient.find({}).sort({ createdAt: -1 }).limit(5).select("name patientId age gender createdAt")
            .lean()
        : Promise.resolve([]),
    ]);

    debugRequestLog("ok", {
      tenantId,
      canViewPatients,
      canViewSamples,
      canViewReports,
    });
    return Response.json({
      samplesToday,
      pendingSamples,
      todayPatients,
      pendingReports,
      recentPatients,
      permissions: {
        patients: canViewPatients,
        samples: canViewSamples,
        reports: canViewReports,
      },
    });

  } catch (err) {
    console.error("Dashboard Stats API Error:", err);
    return Response.json({ error: "Failed to fetch dashboard stats" }, { status: 500 });
  }
}
