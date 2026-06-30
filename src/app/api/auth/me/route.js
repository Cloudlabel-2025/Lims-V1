import { nextJsonError } from "@/app/lib/api-response";
import { NextResponse } from "next/server";
import { requireAnySession } from "@/app/lib/auth";
import { clearSessionCookie } from "@/app/lib/session";
import connectMasterDB from "@/app/lib/master-db";
import { connectTenantDB } from "@/app/lib/tenant-db";
import { getRoleModel } from "@/app/models/tenant/Role";
import { getUserModel } from "@/app/models/tenant/User";
import { getDeveloperUserModel } from "@/app/models/master/DeveloperUser";

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
        clearSessionCookie(response, req);
        return response;
      }

      const User = getUserModel(tenantConnection);
      const currentUser = await User.findById(session.userId)
        .select("passwordChangedAt")
        .lean();

      if (currentUser?.passwordChangedAt) {
        const sessionIat = session.iat ? new Date(session.iat * 1000) : null;
        if (sessionIat && currentUser.passwordChangedAt > sessionIat) {
          debugRequestLog("password-changed", { userId: session.userId });
          const response = NextResponse.json(
            { error: "Session expired. Please log in again." },
            { status: 401 }
          );
          clearSessionCookie(response, req);
          return response;
        }
      }
    } else if (session.userType === "developer") {
      const masterConnection = await connectMasterDB();
      const DeveloperUser = getDeveloperUserModel(masterConnection);
      const devUser = await DeveloperUser.findById(session.userId)
        .select("passwordChangedAt")
        .lean();

      if (devUser?.passwordChangedAt) {
        const sessionIat = session.iat ? new Date(session.iat * 1000) : null;
        if (sessionIat && devUser.passwordChangedAt > sessionIat) {
          debugRequestLog("password-changed", { userId: session.userId });
          const response = NextResponse.json(
            { error: "Session expired. Please log in again." },
            { status: 401 }
          );
          clearSessionCookie(response, req);
          return response;
        }
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
        doctorId: session.doctorId || null,
      },
    });
  } catch (error) {
    return nextJsonError("Unable to read session", error, 500);
  }
}
