import rbacConfig from "@/app/lib/rbac-config.json";
import { availableLabModules, defaultLabModules } from "@/app/lib/modules";

const actionNames = new Set([
  "create",
  "edit",
  "delete",
  "release",
  "verify",
  "collect",
  "update",
  "cancel",
  "refund",
  "manage",
  "register",
  "price",
]);

export function getEnabledModules(lab) {
  return lab?.enabledModules?.length ? lab.enabledModules : defaultLabModules;
}

export function getViewPermissionForModule(moduleId) {
  return (
    availableLabModules.find((module) => module.id === moduleId)?.permission ||
    rbacConfig.permissions.find((permission) => permission.module === moduleId && permission.action === "view")?.key ||
    null
  );
}

export function getPermissionCatalogForEnabledModules(enabledModules) {
  const enabledModuleSet = new Set(enabledModules);

  return rbacConfig.permissions.filter(
    (permission) =>
      permission.scope !== "developer" &&
      (enabledModuleSet.has(permission.module) || permission.module === "users" || permission.module === "settings")
  );
}

export function normalizeRolePermissions(permissions, { allowedPermissionKeys, permissionCatalog }) {
  const incoming = new Set(Array.isArray(permissions) ? permissions : []);
  const normalized = new Set();

  for (const permission of permissionCatalog) {
    if (!incoming.has(permission.key) || !allowedPermissionKeys.has(permission.key)) continue;

    normalized.add(permission.key);
    for (const dependency of permission.dependencies || []) {
      if (allowedPermissionKeys.has(dependency)) normalized.add(dependency);
    }

    const moduleViewPermission = getViewPermissionForModule(permission.module);
    if (actionNames.has(permission.action) && moduleViewPermission && allowedPermissionKeys.has(moduleViewPermission)) {
      normalized.add(moduleViewPermission);
    }
  }

  return [...normalized];
}
