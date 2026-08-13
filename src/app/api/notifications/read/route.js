import { jsonError } from "@/app/lib/api-response";
import { buildNotifications } from "@/app/lib/notifications";
import { getTenantModels } from "@/app/lib/tenant-db";
import { requireTenantSession } from "@/app/lib/auth";

export async function POST(req) {
  try {
    const auth = requireTenantSession(req, "dashboard.view");
    if (auth.error) return auth.error;

    const body = await req.json();
    const { activeTypes } = await buildNotifications(auth.tenantId, auth.session);

    const requestedTypes = Array.isArray(body?.types) ? body.types.map((type) => String(type)) : [];
    const targetTypes = body?.all === true
      ? activeTypes
      : requestedTypes.filter((type) => activeTypes.includes(type));

    const { NotificationRead } = await getTenantModels(auth.tenantId);
    if (targetTypes.length > 0) {
      await NotificationRead.bulkWrite(
        targetTypes.map((type) => ({
          updateOne: {
            filter: { tenantId: auth.tenantId, userId: auth.session.userId, type },
            update: {
              $set: { readAt: new Date() },
              $setOnInsert: { tenantId: auth.tenantId, userId: auth.session.userId, type },
            },
            upsert: true,
          },
        }))
      );
    }

    return Response.json({ ok: true, marked: targetTypes });
  } catch (error) {
    return jsonError("Unable to update notifications", error, 500);
  }
}
