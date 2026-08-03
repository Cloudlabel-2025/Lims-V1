import { jsonError } from "@/app/lib/api-response";
import { buildNotifications, resolveUnread } from "@/app/lib/notifications";
import { requireTenantSession } from "@/app/lib/auth";

export async function GET(req) {
  try {
    const auth = requireTenantSession(req, "dashboard.view");
    if (auth.error) return auth.error;

    const { notifications, activeTypes } = await buildNotifications(auth.tenantId, auth.session);
    const result = await resolveUnread(auth.tenantId, auth.session.userId, notifications, activeTypes);

    return Response.json(result);
  } catch (error) {
    return jsonError("Unable to fetch notifications", error, 500);
  }
}
