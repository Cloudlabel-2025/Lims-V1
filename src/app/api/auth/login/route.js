import { NextResponse } from "next/server";
import connectMasterDB from "@/app/lib/master-db";
import { createSessionToken, setSessionCookie } from "@/app/lib/session";
import { getTenantModels } from "@/app/lib/tenant-db";
import { getTenantIdFromRequest, normalizeTenantId } from "@/app/lib/tenant-resolver";
import { verifyPassword } from "@/app/lib/password";
import { getDeveloperUserModel } from "@/app/models/master/DeveloperUser";

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
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const userType = body.userType === "developer" ? "developer" : "tenant";

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    if (userType === "developer") {
      return loginDeveloper({ email, password, rememberMe: Boolean(body.rememberMe) });
    }

    const tenantId = resolveTenantId(req, body.tenantId);
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant is required" }, { status: 400 });
    }

    return loginTenant({
      tenantId,
      email,
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
  const user = await DeveloperUser.findOne({ email, status: "active" }).select("+passwordHash");

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  user.lastLogin = new Date();
  await user.save();

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

async function loginTenant({ tenantId, email, password, rememberMe }) {
  const { User } = await getTenantModels(tenantId);
  const user = await User.findOne({ email, status: "active" })
    .select("+passwordHash")
    .populate("role");

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  user.lastLogin = new Date();
  await user.save();

  const permissions = user.role?.permissions || [];
  const token = createSessionToken({
    userType: "tenant",
    tenantId,
    userId: String(user._id),
    userCode: user.userId,
    email: user.email,
    roleId: user.role ? String(user.role._id) : null,
    roleName: user.role?.name || null,
    permissions,
  });

  const response = NextResponse.json({
    userType: "tenant",
    tenantId,
    user: {
      id: user._id,
      userId: user.userId,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role
        ? {
            id: user.role._id,
            name: user.role.name,
            permissions,
          }
        : null,
    },
  });

  setSessionCookie(response, token, rememberMe);
  return response;
}
