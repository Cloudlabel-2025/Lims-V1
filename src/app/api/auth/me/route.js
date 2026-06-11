import { nextJsonError } from "@/app/lib/api-response";
import { NextResponse } from "next/server";
import { requireAnySession } from "@/app/lib/auth";
import { getHostnameFromHeaders, normalizeRootDomain } from "@/app/lib/tenant-resolver";

function isPlatformHost(hostname) {
  const rootDomain = normalizeRootDomain(process.env.ROOT_DOMAIN);
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    (rootDomain && (hostname === rootDomain || hostname.endsWith(`.${rootDomain}`)))
  );
}

function debugRequestLog(message, details = {}) {
  if (process.env.NODE_ENV === "production" || process.env.DEBUG_REQUESTS === "false") return;
  const detailText = Object.entries(details)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key}=${value}`)
    .join(" ");
  console.log(`[request:auth-me] ${message}${detailText ? ` ${detailText}` : ""}`);
}

export async function GET(req) {
  try {
    debugRequestLog("start", {
      host: req.headers.get("host"),
    });
    const hostname = getHostnameFromHeaders(req.headers);
    const onCustomDomain = !isPlatformHost(hostname);

    const auth = requireAnySession(req);
    if (auth.error) {
      debugRequestLog("unauthenticated");
      return auth.error;
    }

    const { session } = auth;

    if (onCustomDomain && session.userType !== "tenant") {
      debugRequestLog("developer-session-rejected-on-custom-domain", { hostname });
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    debugRequestLog("ok", {
      userType: session.userType,
      tenantId: session.tenantId,
    });
    return NextResponse.json({
      session,
      user: {
        id: session.userId,
        userType: session.userType,
        tenantId: session.tenantId || null,
        email: session.email,
        roleName: session.roleName || (session.isSystemOwner ? "System Owner" : null),
        permissions: session.permissions || [],
      },
    });
  } catch (error) {
    return nextJsonError("Unable to read session", error, 500);
  }
}
