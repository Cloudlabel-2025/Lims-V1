import { nextJsonError } from "@/app/lib/api-response";
import { NextResponse } from "next/server";
import connectMasterDB from "@/app/lib/master-db";
import { createSessionToken, setSessionCookie } from "@/app/lib/session";
import { buildTenantUrl } from "@/app/lib/subdomain";
import { writeAuditLog } from "@/app/lib/audit";
import { connectTenantDB } from "@/app/lib/tenant-db";
import {
  getTenantIdFromRequest,
  normalizeTenantId,
} from "@/app/lib/tenant-resolver";
import { verifyPassword } from "@/app/lib/password";
import { getDeveloperUserModel } from "@/app/models/master/DeveloperUser";
import { getRoleModel } from "@/app/models/tenant/Role";
import { getUserModel } from "@/app/models/tenant/User";
import { checkRateLimit, resetRateLimit, getClientIp } from "@/app/lib/rate-limit";

function resolveTenantId(req, bodyTenantId) {
  let requestTenantId = null;
  let normalizedBodyTenantId = null;

  try {
    requestTenantId = getTenantIdFromRequest(req);
  } catch {
    requestTenantId = null;
  }

  if (bodyTenantId) {
    normalizedBodyTenantId = normalizeTenantId(bodyTenantId);
  }

  if (requestTenantId && normalizedBodyTenantId && requestTenantId !== normalizedBodyTenantId) {
    throw new Error("Tenant mismatch");
  }

  return requestTenantId || normalizedBodyTenantId;
}

export async function POST(req) {
  try {
    const body = await req.json();
    const loginId = String(body.email || "").trim();
    const email = loginId.toLowerCase();
    const password = String(body.password || "");
    const userType = body.userType === "developer" ? "developer" : "tenant";

    if (!loginId || !password) {
      return NextResponse.json({ error: "User ID and password are required" }, { status: 400 });
    }

    if (userType === "developer") {
      return loginDeveloper({ req, email, password, rememberMe: Boolean(body.rememberMe) });
    }

    const tenantId = resolveTenantId(req, body.tenantId);
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant is required" }, { status: 400 });
    }

    return loginTenant({
      req,
      tenantId,
      loginId,
      password,
      rememberMe: Boolean(body.rememberMe),
    });
  } catch (error) {
    if (error.message === "Tenant mismatch") {
      return NextResponse.json({ error: "Tenant mismatch" }, { status: 403 });
    }

    return nextJsonError("Login failed", error, 500);
  }
}

async function loginDeveloper({ req, email, password, rememberMe }) {
  const ip = getClientIp(req);

  const rateCheck = await checkRateLimit({
    namespace: "login:developer",
    identifier: `${email}:${ip}`,
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000,
  });

  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: `Too many login attempts. Try again in ${rateCheck.retryAfter} seconds.` },
      { status: 429 }
    );
  }

  const masterConnection = await connectMasterDB();
  const DeveloperUser = getDeveloperUserModel(masterConnection);
  const user = await DeveloperUser.findOne({ email, status: { $in: ["active", "locked"] } })
    .select("_id developerUserId firstName lastName email isSystemOwner +passwordHash failedLoginAttempts lockedUntil")
    .lean();

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    if (user) {
      await DeveloperUser.updateOne(
        { _id: user._id },
        {
          $inc: { failedLoginAttempts: 1 },
          $set: user.failedLoginAttempts + 1 >= 5
            ? { lockedUntil: new Date(Date.now() + 15 * 60 * 1000), status: "locked" }
            : {},
        }
      );
    }

    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return NextResponse.json({ error: "Account is temporarily locked. Try again later." }, { status: 423 });
  }

  await DeveloperUser.updateOne(
    { _id: user._id },
    { $set: { lastLogin: new Date(), failedLoginAttempts: 0, lockedUntil: null } }
  );

  const token = createSessionToken({
    userType: "developer",
    userId: String(user._id),
    developerUserId: user.developerUserId,
    email: user.email,
    isSystemOwner: user.isSystemOwner,
  });

  const response = NextResponse.json({
    userType: "developer",
    user: {
      id: user._id,
      developerUserId: user.developerUserId,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      isSystemOwner: user.isSystemOwner,
    },
  });

  setSessionCookie(response, token, rememberMe, req);
  return response;
}

async function loginTenant({ req, tenantId, loginId, password, rememberMe }) {
  const ip = getClientIp(req);

  const rateCheck = await checkRateLimit({
    namespace: `login:tenant:${tenantId}`,
    identifier: `${loginId}:${ip}`,
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000,
  });

  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: `Too many login attempts. Try again in ${rateCheck.retryAfter} seconds.` },
      { status: 429 }
    );
  }

  const tenantConnection = await connectTenantDB(tenantId);
  const User = getUserModel(tenantConnection);
  const Role = getRoleModel(tenantConnection);
  const normalizedLoginId = String(loginId || "").trim();
  const userQuery = normalizedLoginId.includes("@")
    ? { email: normalizedLoginId.toLowerCase(), status: { $in: ["active", "locked"] } }
    : { userId: normalizedLoginId.toUpperCase(), status: { $in: ["active", "locked"] } };
  const user = await User.findOne(userQuery)
    .select("_id userId firstName lastName email role +passwordHash failedLoginAttempts lockedUntil")
    .lean();

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    if (user) {
      await User.updateOne(
        { _id: user._id },
        {
          $inc: { failedLoginAttempts: 1 },
          $set: user.failedLoginAttempts + 1 >= 5
            ? { lockedUntil: new Date(Date.now() + 15 * 60 * 1000), status: "locked" }
            : {},
        }
      );
    }

    writeAuditLog(req, { tenantId, session: { userId: user?._id || "unknown" } }, {
      action: "login.failed",
      resourceType: "user",
      resourceId: user?._id?.toString() || loginId,
      metadata: { loginId, reason: "invalid_credentials" },
    });

    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return NextResponse.json({ error: "Account is temporarily locked. Try again later." }, { status: 423 });
  }

  const role = user.role
    ? await Role.findOne({ _id: user.role, status: "active" })
        .select("_id name permissions")
        .lean()
    : null;

  if (!role) {
    return NextResponse.json(
      { error: "Your assigned role is no longer available. Contact your lab admin." },
      { status: 403 }
    );
  }

  await User.updateOne(
    { _id: user._id },
    { $set: { lastLogin: new Date(), failedLoginAttempts: 0, lockedUntil: null } }
  );

  const permissions = role?.permissions || [];
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  const token = createSessionToken({
    userType: "tenant",
    tenantId,
    userId: String(user._id),
    userCode: user.userId,
    email: user.email,
    name: fullName,
    roleId: role ? String(role._id) : null,
    roleName: role?.name || null,
    permissions,
  });

  writeAuditLog(req, { tenantId, session: { userId: String(user._id) } }, {
    action: "login.success",
    resourceType: "user",
    resourceId: String(user._id),
    metadata: { loginId },
  });

  const response = NextResponse.json({
    userType: "tenant",
    tenantId,
    redirectUrl: buildTenantUrl(tenantId, req.url, "/dashboard"),
    loginUrl: buildTenantUrl(tenantId, req.url),
    user: {
      id: user._id,
      userId: user.userId,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: role
        ? {
            id: role._id,
            name: role.name,
            permissions,
          }
        : null,
    },
  });

  setSessionCookie(response, token, rememberMe, req);
  return response;
}
