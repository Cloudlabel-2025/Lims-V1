import { normalizeTenantId } from "@/app/lib/tenant-resolver";
import { getLabSubscriptionEntitlements } from "@/app/lib/subscription-service";
import { hasPatientPortalEntitlement } from "@/app/lib/portal-policy";

export async function POST(req) {
  try {
    const body = await req.json();
    const tenantId = normalizeTenantId(body?.tenantId);
    const subscription = await getLabSubscriptionEntitlements(tenantId);
    if (!hasPatientPortalEntitlement(subscription)) {
      return Response.json({ error: "Access disabled" }, { status: 403 });
    }
    return Response.json({ error: "OTP verification is deprecated. Please login using your Mobile Number and Date of Birth." }, { status: 410 });
  } catch {
    return Response.json({ error: "Deprecated" }, { status: 410 });
  }
}
