import { jsonError } from "@/app/lib/api-response";
import { requireTenantSession } from "@/app/lib/auth";
import { getTenantModels } from "@/app/lib/tenant-db";
import { hashPassword, validatePasswordPolicy } from "@/app/lib/password";

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

    const body = await req.json();
    const email = clean(body.email).toLowerCase();
    const password = String(body.password || "");
    const confirmPassword = String(body.confirmPassword || body.passwordConfirm || "");
    const roleId = clean(body.roleId);
    const { firstName, lastName } = splitName(body.name);

    if (!firstName || firstName.length < 2) {
      return Response.json({ error: "User name is required" }, { status: 400 });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
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

    return Response.json({ user: serializeUser(user) }, { status: 201 });
  } catch (error) {
    if (error.code === 11000) {
      return Response.json({ error: "A user with this login email already exists" }, { status: 409 });
    }

    return jsonError("Unable to create user", error, 500);
  }
}
