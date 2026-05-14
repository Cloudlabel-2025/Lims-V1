import { NextResponse } from "next/server";
import connectMasterDB from "@/app/lib/master-db";
import { createSessionToken, setSessionCookie } from "@/app/lib/session";
import { buildTenantUrl } from "@/app/lib/subdomain";
import { connectTenantDB } from "@/app/lib/tenant-db";
import { getTenantIdFromRequest, normalizeTenantId } from "@/app/lib/tenant-resolver";
import { verifyPassword } from "@/app/lib/password";
import { getDeveloperUserModel } from "@/app/models/master/DeveloperUser";
import { getRoleModel } from "@/app/models/tenant/Role";
import { getUserModel } from "@/app/models/tenant/User";

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
      return loginDeveloper({ email, password, rememberMe: Boolean(body.rememberMe) });
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

    return NextResponse.json(
      { error: "Login failed", details: error.message },
      { status: 500 }
    );
  }
}

async function loginDeveloper({ email, password, rememberMe }) {
  const masterConnection = await connectMasterDB();
  const DeveloperUser = getDeveloperUserModel(masterConnection);
  const user = await DeveloperUser.findOne({ email, status: "active" })
    .select("_id developerUserId firstName lastName email isSystemOwner +passwordHash")
    .lean();

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  await DeveloperUser.updateOne({ _id: user._id }, { $set: { lastLogin: new Date() } });

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

  setSessionCookie(response, token, rememberMe);
  return response;
}

async function loginTenant({ req, tenantId, loginId, password, rememberMe }) {
  const tenantConnection = await connectTenantDB(tenantId);
  const User = getUserModel(tenantConnection);
  const Role = getRoleModel(tenantConnection);
  const normalizedLoginId = String(loginId || "").trim();
  const userQuery = normalizedLoginId.includes("@")
    ? { email: normalizedLoginId.toLowerCase(), status: "active" }
    : { userId: normalizedLoginId.toUpperCase(), status: "active" };
  const user = await User.findOne(userQuery)
    .select("_id userId firstName lastName email role +passwordHash")
    .lean();

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const [role] = await Promise.all([
    user.role
      ? Role.findById(user.role).select("_id name permissions").lean()
      : Promise.resolve(null),
    User.updateOne({ _id: user._id }, { $set: { lastLogin: new Date() } }),
  ]);

  const permissions = role?.permissions || [];
  const token = createSessionToken({
    userType: "tenant",
    tenantId,
    userId: String(user._id),
    userCode: user.userId,
    email: user.email,
    roleId: role ? String(role._id) : null,
    roleName: role?.name || null,
    permissions,
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

  setSessionCookie(response, token, rememberMe);
  return response;
}
