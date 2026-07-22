import { availableLabModules, defaultLabModules } from "@/app/lib/modules";

export function hasPermission(user, permission) {
  if (!permission) return true;
  const permissions = user?.permissions || [];
  return permissions.includes("*") || permissions.includes(permission);
}

export function hasAnyPermission(user, permissions) {
  return permissions.some((permission) => hasPermission(user, permission));
}

export function getEnabledModules(theme) {
  if (!theme?.enabledModules?.length) return new Set(defaultLabModules);

  return new Set(theme.enabledModules);
}

export function getAllowedNavItems(user, theme) {
  const enabledModules = getEnabledModules(theme);

  return availableLabModules.filter(
    (module) => enabledModules.has(module.id) && hasPermission(user, module.permission)
  );
}

export function getFirstAllowedHref(user, theme) {
  if (user?.doctorId) return "/doctor/dashboard";
  return getAllowedNavItems(user, theme)[0]?.href || (hasPermission(user, "users.manage") ? "/users" : hasPermission(user, "settings.manage") ? "/settings" : "");
}

export function getRequiredPermissionsForPath(pathname) {
  if (!pathname) return [];

  if (pathname === "/doctor/dashboard" || pathname.startsWith("/doctor/patients/")) return ["reports.view"];

  if (pathname === "/users" || pathname.startsWith("/users/")) {
    return ["users.manage"];
  }

  if (pathname === "/settings" || pathname.startsWith("/settings/")) {
    return ["settings.manage"];
  }

  if (pathname.startsWith("/patients/register")) return ["patients.register"];
  if (pathname.startsWith("/patients/edit")) return ["patients.edit"];
  if (pathname === "/patients" || pathname.startsWith("/patients/")) return ["patients.view"];

  if (pathname.startsWith("/doctors/register")) return ["doctors.register"];
  if (pathname.startsWith("/doctors/edit")) return ["doctors.edit"];
  if (pathname === "/doctors" || pathname.startsWith("/doctors/")) return ["doctors.view"];
  if (pathname === "/doctor/profile") return ["doctors.view", "doctors.edit"];

  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) return ["dashboard.view"];

  const moduleMatch = availableLabModules.find(
    (module) => module.href !== "/dashboard" && (pathname === module.href || pathname.startsWith(`${module.href}/`))
  );

  return moduleMatch?.permission ? [moduleMatch.permission] : [];
}

export function canAccessPath(user, theme, pathname) {
  if (pathname?.startsWith("/doctor/") && pathname !== "/doctor/profile" && !user?.doctorId) return false;
  const requiredPermissions = getRequiredPermissionsForPath(pathname);
  if (requiredPermissions.length === 0) return true;

  if (pathname !== "/settings" && !pathname.startsWith("/settings/") && pathname !== "/users" && !pathname.startsWith("/users/")) {
    const enabledModules = getEnabledModules(theme);
    const moduleMatch = availableLabModules.find(
      (module) => module.href !== "/dashboard" && (pathname === module.href || pathname.startsWith(`${module.href}/`))
    );
    if (moduleMatch && !enabledModules.has(moduleMatch.id)) return false;
  }

  return hasAnyPermission(user, requiredPermissions);
}
