import { requireTenantSession } from "@/app/lib/auth";
import { getTenantConfig } from "@/app/lib/tenant-cache";
import { getTenantModels } from "@/app/lib/tenant-db";
import rbacConfig from "@/app/lib/rbac-config.json";
import { defaultLabModules } from "@/app/lib/modules";

function clean(value) {
  return String(value || "").trim();
}

function getAllowedPermissionKeys(session, enabledModules) {
  const enabledModuleSet = new Set(enabledModules);
  const sessionPermissionSet = new Set(session.permissions || []);
  const hasAllPermissions = sessionPermissionSet.has("*");

  return new Set(
    rbacConfig.permissions
      .filter(
        (permission) =>
          permission.scope !== "developer" &&
          permission.key !== "settings.branding" &&
          (enabledModuleSet.has(permission.module) ||
            permission.module === "users" ||
            permission.module === "settings") &&
          (hasAllPermissions || sessionPermissionSet.has(permission.key))
      )
      .map((permission) => permission.key)
  );
}

function normalizePermissions(permissions, allowedPermissionKeys) {
  return [...new Set(Array.isArray(permissions) ? permissions : [])].filter((key) =>
    allowedPermissionKeys.has(key)
  );
}

function serializeRole(role) {
  return {
    id: String(role._id),
    roleId: role.roleId,
    name: role.name,
    description: role.description || "",
    permissions: role.permissions || [],
    isDefaultAdmin: Boolean(role.isDefaultAdmin),
    isSystemRole: Boolean(role.isSystemRole),
    status: role.status,
  };
}

function dedupeRolesByName(roles) {
  const seen = new Set();
  const uniqueRoles = [];

  for (const role of roles) {
    const key = clean(role.name).toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    uniqueRoles.push(role);
  }

  return uniqueRoles;
}

async function getAllowedPermissionsForTenant(auth) {
  const lab = await getTenantConfig(auth.tenantId);
  const enabledModules = lab?.enabledModules?.length ? lab.enabledModules : defaultLabModules;
  return getAllowedPermissionKeys(auth.session, enabledModules);
}

export async function GET(req) {
  try {
    const auth = requireTenantSession(req, "settings.manage");
    if (auth.error) return auth.error;

    const allowedPermissionKeys = await getAllowedPermissionsForTenant(auth);
    const { Role } = await getTenantModels(auth.tenantId);
    const roles = await Role.find({ status: "active", isSystemRole: { $ne: true } }).sort({
      name: 1,
    });
    const uniqueRoles = dedupeRolesByName(roles);

    return Response.json({
      roles: uniqueRoles.map((role) => ({
        ...serializeRole(role),
        permissions: role.permissions?.includes("*")
          ? [...allowedPermissionKeys]
          : normalizePermissions(role.permissions, allowedPermissionKeys),
      })),
    });
  } catch (error) {
    return Response.json(
      { error: "Unable to load roles", details: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(req) {
  try {
    const auth = requireTenantSession(req, "settings.manage");
    if (auth.error) return auth.error;

    const body = await req.json();
    const incomingRoles = dedupeRolesByName(Array.isArray(body.roles) ? body.roles : []);
    const allowedPermissionKeys = await getAllowedPermissionsForTenant(auth);
    const { Role } = await getTenantModels(auth.tenantId);
    const savedRoles = [];

    for (const item of incomingRoles) {
      const name = clean(item.name).slice(0, 80);
      if (!name || name.length < 2) continue;

      const permissions = normalizePermissions(item.permissions, allowedPermissionKeys);
      const description = clean(item.description || "Custom lab role.").slice(0, 500);
      const existingRole =
        (item.id ? await Role.findOne({ _id: item.id, isSystemRole: { $ne: true } }) : null) ||
        (await Role.findOne({
          name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
          isSystemRole: { $ne: true },
        }));

      if (existingRole) {
        existingRole.name = name;
        existingRole.description = description;
        existingRole.permissions = permissions;
        existingRole.status = "active";
        await existingRole.save();
        savedRoles.push(existingRole);
      } else {
        const role = await Role.create({
          name,
          description,
          permissions,
          status: "active",
          isSystemRole: false,
          createdBy: auth.session.userId,
        });
        savedRoles.push(role);
      }
    }

    const roles = await Role.find({ status: "active", isSystemRole: { $ne: true } }).sort({
      name: 1,
    });
    return Response.json({ roles: dedupeRolesByName(roles).map(serializeRole) });
  } catch (error) {
    if (error.code === 11000) {
      return Response.json({ error: "Role name already exists" }, { status: 409 });
    }

    return Response.json(
      { error: "Unable to save roles", details: error.message },
      { status: 500 }
    );
  }
}
