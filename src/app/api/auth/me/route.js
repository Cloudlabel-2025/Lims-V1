import { nextJsonError } from "@/app/lib/api-response";
import { NextResponse } from "next/server";
import { requireAnySession } from "@/app/lib/auth";

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
    const auth = requireAnySession(req);
    if (auth.error) {
      debugRequestLog("unauthenticated");
      return auth.error;
    }

    const { session } = auth;
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
