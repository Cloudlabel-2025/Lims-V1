import { jsonError } from "@/app/lib/api-response";
import { hasPermission, requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";
import { getTenantConfig } from "@/app/lib/tenant-cache";
import { getTenantModels } from "@/app/lib/tenant-db";
import {
  getEnabledModules,
  getPermissionCatalogForEnabledModules,
  normalizeRolePermissions,
} from "@/app/lib/rbac";

function clean(value) {
  return String(value || "").trim();
}

function getAllowedPermissionKeys(session, enabledModules) {
  const sessionPermissionSet = new Set(session.permissions || []);
  const hasAllPermissions = sessionPermissionSet.has("*");

  return new Set(
    getPermissionCatalogForEnabledModules(enabledModules)
      .filter((permission) => permission.key !== "settings.branding" && (hasAllPermissions || sessionPermissionSet.has(permission.key)))
      .map((permission) => permission.key)
  );
}

function normalizePermissions(permissions, allowedPermissionKeys, enabledModules) {
  return normalizeRolePermissions(permissions, {
    allowedPermissionKeys,
    permissionCatalog: getPermissionCatalogForEnabledModules(enabledModules),
  });
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
  const enabledModules = getEnabledModules(lab);
  return {
    allowedPermissionKeys: getAllowedPermissionKeys(auth.session, enabledModules),
    enabledModules,
  };
}

export async function GET(req) {
  try {
    const auth = requireTenantSession(req);
    if (auth.error) return auth.error;
    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "settings.manage");
    if (moduleAuth.error) return moduleAuth.error;
    if (!hasPermission(auth.session, "settings.manage") && !hasPermission(auth.session, "users.manage")) {
      return Response.json({ error: "Permission denied" }, { status: 403 });
    }

    const { allowedPermissionKeys, enabledModules } = await getAllowedPermissionsForTenant(auth);
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
          : normalizePermissions(role.permissions, allowedPermissionKeys, enabledModules),
      })),
    });
  } catch (error) {
    return jsonError("Unable to load roles", error, 500);
  }
}

export async function PATCH(req) {
  try {
    const auth = requireTenantSession(req, "settings.manage");
    if (auth.error) return auth.error;
    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "settings.manage");
    if (moduleAuth.error) return moduleAuth.error;

    const body = await req.json();
    const incomingRoles = dedupeRolesByName(Array.isArray(body.roles) ? body.roles : []);
    const { allowedPermissionKeys, enabledModules } = await getAllowedPermissionsForTenant(auth);
    const { Role } = await getTenantModels(auth.tenantId);
    const savedRoles = [];

    for (const item of incomingRoles) {
      const name = clean(item.name).slice(0, 80);
      if (!name || name.length < 2) continue;

      const permissions = normalizePermissions(item.permissions, allowedPermissionKeys, enabledModules);
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

    return jsonError("Unable to save roles", error, 500);
  }
}

export async function DELETE(req) {
  try {
    const auth = requireTenantSession(req, "settings.manage");
    if (auth.error) return auth.error;
    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "settings.manage");
    if (moduleAuth.error) return moduleAuth.error;

    const { searchParams } = new URL(req.url);
    const roleId = clean(searchParams.get("id"));
    if (!roleId) {
      return Response.json({ error: "Role ID is required" }, { status: 400 });
    }

    const { Role } = await getTenantModels(auth.tenantId);
    const role = await Role.findOne({ _id: roleId, isSystemRole: { $ne: true } });

    if (!role) {
      return Response.json({ error: "Role not found" }, { status: 404 });
    }

    if (role.isDefaultAdmin) {
      return Response.json({ error: "Default admin role cannot be deleted" }, { status: 403 });
    }

    await role.deleteOne();

    const roles = await Role.find({ status: "active", isSystemRole: { $ne: true } }).sort({
      name: 1,
    });

    return Response.json({ roles: dedupeRolesByName(roles).map(serializeRole) });
  } catch (error) {
    return jsonError("Unable to delete role", error, 500);
  }
}
