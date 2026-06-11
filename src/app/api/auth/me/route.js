import { nextJsonError } from "@/app/lib/api-response";
import { NextResponse } from "next/server";
import { requireAnySession } from "@/app/lib/auth";
import { clearSessionCookie } from "@/app/lib/session";
import { connectTenantDB } from "@/app/lib/tenant-db";
import { getRoleModel } from "@/app/models/tenant/Role";

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
    if (session.userType === "tenant") {
      const tenantConnection = await connectTenantDB(session.tenantId);
      const Role = getRoleModel(tenantConnection);
      const roleExists = session.roleId
        ? await Role.exists({ _id: session.roleId, status: "active" })
        : null;

      if (!roleExists) {
        debugRequestLog("role-missing", {
          tenantId: session.tenantId,
          roleId: session.roleId,
        });
        const response = NextResponse.json(
          { error: "Your assigned role is no longer available. Contact your lab admin." },
          { status: 403 }
        );
        clearSessionCookie(response);
        return response;
      }
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
        userCode: session.userCode || null,
        name: session.name || null,
        email: session.email,
        roleId: session.roleId || null,
        roleName: session.roleName || (session.isSystemOwner ? "System Owner" : null),
        permissions: session.permissions || [],
      },
    });
  } catch (error) {
    return nextJsonError("Unable to read session", error, 500);
  }
}
