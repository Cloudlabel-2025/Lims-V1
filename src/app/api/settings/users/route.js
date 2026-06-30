import { jsonError } from "@/app/lib/api-response";
import { requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";
import { getTenantModels } from "@/app/lib/tenant-db";
import { hashPassword, validatePasswordPolicy } from "@/app/lib/password";

const URL_RE = /https?:\/\//;
const SAFE_NAME = /^[A-Za-z0-9 .&'\/,()@_-]+$/;

function clean(value) {
  return String(value || "").trim();
}

function splitName(name) {
  const parts = clean(name).split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "User" };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function serializeUser(user) {
  return {
    id: String(user._id),
    userId: user.userId,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    status: user.status,
    role: user.role
      ? {
          id: String(user.role._id || user.role),
          name: user.role.name,
        }
      : null,
  };
}

export async function GET(req) {
  try {
    const auth = requireTenantSession(req, "users.manage");
    if (auth.error) return auth.error;
    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "users.manage");
    if (moduleAuth.error) return moduleAuth.error;

    const { User } = await getTenantModels(auth.tenantId);
    const users = await User.find({}).populate("role", "name").sort({ createdAt: -1 }).limit(50);

    return Response.json({ users: users.map(serializeUser) });
  } catch (error) {
    return jsonError("Unable to load users", error, 500);
  }
}

export async function POST(req) {
  try {
    const auth = requireTenantSession(req, "users.manage");
    if (auth.error) return auth.error;
    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "users.manage");
    if (moduleAuth.error) return moduleAuth.error;

    const body = await req.json();
    const email = clean(body.email).toLowerCase();
    const password = String(body.password || "");
    const confirmPassword = String(body.confirmPassword || body.passwordConfirm || "");
    const roleId = clean(body.roleId);
    const { firstName, lastName } = splitName(body.name);

    if (!firstName || firstName.length < 2) {
      return Response.json({ error: "User name is required" }, { status: 400 });
    }

    if (URL_RE.test(firstName) || URL_RE.test(lastName)) {
      return Response.json({ error: "URLs are not allowed in user name" }, { status: 400 });
    }

    if (!SAFE_NAME.test(firstName) || !SAFE_NAME.test(lastName)) {
      return Response.json({ error: "User name contains invalid characters" }, { status: 400 });
    }

    if (URL_RE.test(email)) {
      return Response.json({ error: "URLs are not allowed in email" }, { status: 400 });
    }

    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email)) {
      return Response.json({ error: "Valid login email is required" }, { status: 400 });
    }

    const passwordPolicy = validatePasswordPolicy(password);
    if (!passwordPolicy.valid) {
      return Response.json(
        { error: passwordPolicy.errors.join("; ") },
        { status: 400 }
      );
    }

    if (!confirmPassword || password !== confirmPassword) {
      return Response.json(
        { error: "Password and confirm password must match" },
        { status: 400 }
      );
    }

    const { Role, User } = await getTenantModels(auth.tenantId);
    const role = await Role.findOne({ _id: roleId, status: "active" });

    if (!role) {
      return Response.json({ error: "Selected role not found" }, { status: 404 });
    }

    const user = await User.create({
      firstName,
      lastName,
      email,
      passwordHash: await hashPassword(password),
      role: role._id,
      status: "active",
      createdBy: auth.session.userId,
    });
    await user.populate("role", "name");

    const { AuditLog } = await getTenantModels(auth.tenantId);
    AuditLog.create({ action: "users.create", userId: auth.session.userId, tenantId: auth.tenantId, resourceType: "User", resourceId: user._id, ipAddress: req.headers.get("x-forwarded-for") || "" }).catch(() => {});

    return Response.json({ user: serializeUser(user) }, { status: 201 });
  } catch (error) {
    if (error.code === 11000) {
      return Response.json({ error: "A user with this login email already exists" }, { status: 409 });
    }

    return jsonError("Unable to create user", error, 500);
  }
}

export async function PATCH(req) {
  try {
    const auth = requireTenantSession(req, "users.manage");
    if (auth.error) return auth.error;
    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "users.manage");
    if (moduleAuth.error) return moduleAuth.error;

    const body = await req.json();
    const userId = clean(body.id || body.userId);
    const email = clean(body.email).toLowerCase();
    const roleId = clean(body.roleId);
    const status = clean(body.status) || "active";
    const password = String(body.password || "");
    const confirmPassword = String(body.confirmPassword || body.passwordConfirm || "");
    const { firstName, lastName } = splitName(body.name);

    if (!userId) {
      return Response.json({ error: "User ID is required" }, { status: 400 });
    }

    if (!firstName || firstName.length < 2) {
      return Response.json({ error: "User name is required" }, { status: 400 });
    }

    if (URL_RE.test(firstName) || URL_RE.test(lastName)) {
      return Response.json({ error: "URLs are not allowed in user name" }, { status: 400 });
    }

    if (!SAFE_NAME.test(firstName) || !SAFE_NAME.test(lastName)) {
      return Response.json({ error: "User name contains invalid characters" }, { status: 400 });
    }

    if (URL_RE.test(email)) {
      return Response.json({ error: "URLs are not allowed in email" }, { status: 400 });
    }

    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email)) {
      return Response.json({ error: "Valid login email is required" }, { status: 400 });
    }

    if (!["active", "inactive", "locked"].includes(status)) {
      return Response.json({ error: "Invalid user status" }, { status: 400 });
    }

    if (password) {
      const passwordPolicy = validatePasswordPolicy(password);
      if (!passwordPolicy.valid) {
        return Response.json({ error: passwordPolicy.errors.join("; ") }, { status: 400 });
      }

      if (!confirmPassword || password !== confirmPassword) {
        return Response.json({ error: "Password and confirm password must match" }, { status: 400 });
      }
    }

    const { Role, User } = await getTenantModels(auth.tenantId);
    const [role, user] = await Promise.all([
      Role.findOne({ _id: roleId, status: "active" }),
      User.findById(userId).select("+passwordHash"),
    ]);

    if (!role) {
      return Response.json({ error: "Selected role not found" }, { status: 404 });
    }

    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    user.set({
      firstName,
      lastName,
      email,
      role: role._id,
      status,
    });

    if (password) {
      user.passwordHash = await hashPassword(password);
      user.passwordResetTokenHash = undefined;
      user.passwordResetExpiresAt = undefined;
    }

    await user.save();
    await user.populate("role", "name");

    const { AuditLog } = await getTenantModels(auth.tenantId);
    AuditLog.create({ action: "users.update", userId: auth.session.userId, tenantId: auth.tenantId, resourceType: "User", resourceId: user._id, ipAddress: req.headers.get("x-forwarded-for") || "" }).catch(() => {});

    return Response.json({ user: serializeUser(user) });
  } catch (error) {
    if (error.code === 11000) {
      return Response.json({ error: "A user with this login email already exists" }, { status: 409 });
    }

    return jsonError("Unable to update user", error, 500);
  }
}

export async function DELETE(req) {
  try {
    const auth = requireTenantSession(req, "users.manage");
    if (auth.error) return auth.error;
    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "users.manage");
    if (moduleAuth.error) return moduleAuth.error;

    const { searchParams } = new URL(req.url);
    const userId = clean(searchParams.get("id"));

    if (!userId) {
      return Response.json({ error: "User ID is required" }, { status: 400 });
    }

    if (userId === auth.session.userId) {
      return Response.json({ error: "You cannot delete your own user account" }, { status: 400 });
    }

    const { User } = await getTenantModels(auth.tenantId);
    const deleted = await User.findByIdAndDelete(userId);

    if (!deleted) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const { AuditLog } = await getTenantModels(auth.tenantId);
    AuditLog.create({ action: "users.delete", userId: auth.session.userId, tenantId: auth.tenantId, resourceType: "User", resourceId: deleted._id, ipAddress: req.headers.get("x-forwarded-for") || "" }).catch(() => {});

    return Response.json({ ok: true, deletedUserId: userId });
  } catch (error) {
    return jsonError("Unable to delete user", error, 500);
  }
}
