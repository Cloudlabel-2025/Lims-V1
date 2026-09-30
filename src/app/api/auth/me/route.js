import { nextJsonError } from "@/app/lib/api-response";
import { NextResponse } from "next/server";
import { requireAnySession } from "@/app/lib/auth";
import { clearSessionCookie, createSessionToken, setSessionCookie } from "@/app/lib/session";
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
    let persistedUser = null;
    let livePermissions = session.permissions || [];
    let liveRoleName = session.roleName;

    if (session.userType === "tenant") {
      const tenantConnection = await connectTenantDB(session.tenantId);
      const Role = getRoleModel(tenantConnection);
      const activeRole = session.roleId
        ? await Role.findOne({ _id: session.roleId, status: "active" }).select("permissions name").lean()
        : null;

      if (!activeRole) {
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

      livePermissions = activeRole.permissions || [];
      liveRoleName = activeRole.name || session.roleName;

      const User = getUserModel(tenantConnection);
      const currentUser = await User.findById(session.userId)
        .select("firstName lastName passwordChangedAt status")
        .lean();
      persistedUser = currentUser;

      if (!currentUser || currentUser.status !== "active") {
        debugRequestLog("user-inactive", { userId: session.userId, status: currentUser?.status });
        const response = NextResponse.json(
          { error: "Your account is no longer active. Contact your lab admin." },
          { status: 403 }
        );
        clearSessionCookie(response, req);
        return response;
      }

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
        .select("firstName lastName passwordChangedAt status")
        .lean();
      persistedUser = devUser;

      if (!devUser || devUser.status !== "active") {
        debugRequestLog("user-inactive", { userId: session.userId, status: devUser?.status });
        const response = NextResponse.json(
          { error: "Your account is no longer active." },
          { status: 403 }
        );
        clearSessionCookie(response, req);
        return response;
      }

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
    const firstName = persistedUser?.firstName || null;
    const lastName = persistedUser?.lastName || null;
    const persistedFullName = [firstName, lastName].filter(Boolean).join(" ").trim();

    const permissionsChanged =
      session.userType === "tenant" &&
      JSON.stringify(session.permissions || []) !== JSON.stringify(livePermissions);

    const response = NextResponse.json({
      session: {
        ...session,
        permissions: livePermissions,
        roleName: liveRoleName,
      },
      user: {
        id: session.userId,
        userType: session.userType,
        tenantId: session.tenantId || null,
        userCode: session.userCode || null,
        firstName,
        lastName,
        name: persistedFullName || session.name || null,
        email: session.email,
        roleId: session.roleId || null,
        roleName: liveRoleName || (session.isSystemOwner ? "System Owner" : null),
        permissions: livePermissions,
        doctorId: session.doctorId || null,
      },
    });

    if (permissionsChanged) {
      const newToken = createSessionToken({
        ...session,
        permissions: livePermissions,
        roleName: liveRoleName,
      });
      setSessionCookie(response, newToken, false, req);
    }

    return response;
  } catch (error) {
    return nextJsonError("Unable to read session", error, 500);
  }
}
