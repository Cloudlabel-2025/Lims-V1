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
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(parseInt(searchParams.get("limit") || "15", 10), 200);
    const skip = (page - 1) * limit;

    const { AuditLog } = await getTenantModels(auth.tenantId);
    const query = { tenantId: auth.tenantId };
    if (resourceType) query.resourceType = resourceType;

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .populate("userId", "name email userId")
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(query),
    ]);

    return Response.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    return jsonError("Unable to load audit logs", error, 500);
  }
}
