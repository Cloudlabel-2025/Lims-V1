import { getTenantModels } from "@/app/lib/tenant-db";

export async function writeAuditLog(req, auth, event) {
  if (!auth?.tenantId || !event?.action || !event?.resourceType) return;

  const { AuditLog } = await getTenantModels(auth.tenantId);
  await AuditLog.create({
    action: event.action,
    userId: auth.session?.userId,
    userRole: auth.session?.roleName || auth.session?.role || "",
    tenantId: auth.tenantId,
    resourceType: event.resourceType,
    resourceId: event.resourceId,
    metadata: event.metadata || {},
    ipAddress: req.headers.get("x-forwarded-for") || "",
  }).catch(() => {});
}
