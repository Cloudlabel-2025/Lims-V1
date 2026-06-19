import { jsonError } from "@/app/lib/api-response";
import { getTenantModels } from "@/app/lib/tenant-db";
import { hasPermission, requireTenantSession } from "@/app/lib/auth";

export async function GET(req) {
  try {
    const auth = requireTenantSession(req);
    if (auth.error) return auth.error;

    if (!hasPermission(auth.session, "audit.view") && !hasPermission(auth.session, "settings.manage")) {
      return Response.json({ error: "Permission denied" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const resourceType = searchParams.get("resourceType") || "";
    const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 200);

    const { AuditLog } = await getTenantModels(auth.tenantId);
    const query = { tenantId: auth.tenantId };
    if (resourceType) query.resourceType = resourceType;

    const logs = await AuditLog.find(query)
      .populate("userId", "name email userId")
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    return Response.json({ logs });
  } catch (error) {
    return jsonError("Unable to load audit logs", error, 500);
  }
}
