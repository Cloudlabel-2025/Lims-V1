"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import SuccessDialog from "@/app/components/SuccessDialog";
import { cachedJsonFetch, clearCachedApi, useTenantShell } from "@/app/lib/use-current-user";
import rbacConfig from "@/app/lib/rbac-config.json";
import { defaultLabModules } from "@/app/lib/modules";
import { hasPermission } from "@/app/lib/client-rbac";

const RoleManager = dynamic(() => import("./RoleManager"), {
  ssr: false,
  loading: () => (
    <section className="settings-panel">
      <p className="developer-empty">Loading roles...</p>
    </section>
  ),
});

const PermissionMatrix = dynamic(() => import("./PermissionMatrix"), {
  ssr: false,
  loading: () => (
    <section className="settings-panel">
      <p className="developer-empty">Loading permissions...</p>
    </section>
  ),
});

function groupByModule(permissions) {
  return permissions.reduce((groups, permission) => {
    const moduleId = permission.module || "general";
    return {
      ...groups,
      [moduleId]: [...(groups[moduleId] || []), permission],
    };
  }, {});
}

function sameRoleConfiguration(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function normalizeRoleName(value) {
  return String(value || "").trim().toLowerCase();
}

function clampRoleIndex(nextRoles, preferredIndex) {
  if (nextRoles.length === 0) return 0;
  return Math.min(preferredIndex, nextRoles.length - 1);
}

function addPermissionWithDependencies(selected, permissionKey, permissionByKey) {
  if (selected.has(permissionKey)) return;
  const permission = permissionByKey.get(permissionKey);
  if (!permission) return;

  selected.add(permissionKey);
  (permission.dependencies || []).forEach((dependencyKey) => {
    addPermissionWithDependencies(selected, dependencyKey, permissionByKey);
  });
}

function removePermissionWithDependents(selected, permissionKey, dependentKeysByPermission) {
  if (!selected.has(permissionKey)) return;

  selected.delete(permissionKey);
  (dependentKeysByPermission.get(permissionKey) || []).forEach((dependentKey) => {
    removePermissionWithDependents(selected, dependentKey, dependentKeysByPermission);
  });
}

export default function LabAdminSettingsPage() {
  const { theme, user } = useTenantShell();
  const [activeRoleIndex, setActiveRoleIndex] = useState(0);
  const [roles, setRoles] = useState([]);
  const [savedRoles, setSavedRoles] = useState([]);
  const [newRoleName, setNewRoleName] = useState("");
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [roleSaving, setRoleSaving] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [roleMessage, setRoleMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      try {
        setSettingsError("");
        if (!user) return;

        if (!hasPermission(user, "settings.manage")) {
          if (!cancelled) setRoles([]);
          return;
        }

        const roleRes = await cachedJsonFetch("/api/settings/roles", { ttl: 10_000 });

        if (!roleRes.response.ok) throw new Error(roleRes.data.error || roleRes.data.details || "Unable to load roles");

        if (!cancelled) {
          const loadedRoles = roleRes.data.roles || [];
          setRoles(loadedRoles);
          setSavedRoles(loadedRoles);
        }
      } catch (err) {
        if (!cancelled) setSettingsError(err.message);
      } finally {
        if (!cancelled) setLoadingSettings(false);
      }
    }

    loadSettings();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const enabledModules = theme?.enabledModules?.length ? theme.enabledModules : defaultLabModules;
  const canManageRoles = hasPermission(user, "settings.manage");
  const labPermissions = useMemo(
    () =>
      rbacConfig.permissions.filter(
        (permission) =>
          permission.scope !== "developer" &&
          permission.key !== "settings.branding" &&
          (enabledModules.includes(permission.module) || permission.module === "users" || permission.module === "settings")
      ),
    [enabledModules]
  );
  const permissionsByModule = useMemo(() => groupByModule(labPermissions), [labPermissions]);
  const permissionByKey = useMemo(
    () => new Map(labPermissions.map((permission) => [permission.key, permission])),
    [labPermissions]
  );
  const dependentKeysByPermission = useMemo(() => {
    const dependents = new Map();

    labPermissions.forEach((permission) => {
      (permission.dependencies || []).forEach((dependencyKey) => {
        if (!permissionByKey.has(dependencyKey)) return;
        dependents.set(dependencyKey, [...(dependents.get(dependencyKey) || []), permission.key]);
      });
    });

    return dependents;
  }, [labPermissions, permissionByKey]);
  const activeRole = roles[activeRoleIndex] || roles[0];
  const activePermissions = useMemo(
    () =>
      activeRole?.permissions?.includes("*")
        ? labPermissions.map((permission) => permission.key)
        : activeRole?.permissions || [],
    [activeRole, labPermissions]
  );
  const activePermissionSet = useMemo(() => new Set(activePermissions), [activePermissions]);
  const rolesDirty = !sameRoleConfiguration(roles, savedRoles);

  function toggleRolePermission(permissionKey) {
    setRoles((current) =>
      current.map((role, index) =>
        index === activeRoleIndex
          ? {
              ...role,
              permissions: (() => {
                const selected = new Set(
                  role.permissions.includes("*")
                    ? labPermissions.map((permission) => permission.key)
                    : role.permissions
                );

                if (selected.has(permissionKey)) {
                  removePermissionWithDependents(selected, permissionKey, dependentKeysByPermission);
                } else {
                  addPermissionWithDependencies(selected, permissionKey, permissionByKey);
                }

                return labPermissions
                  .map((permission) => permission.key)
                  .filter((key) => selected.has(key));
              })(),
            }
          : role
      )
    );
  }

  function addRole() {
    const roleName = newRoleName.trim();
    if (!roleName) return;
    if (roles.some((role) => normalizeRoleName(role.name) === normalizeRoleName(roleName))) {
      setSettingsError("Role name already exists.");
      return;
    }

    setSettingsError("");
    setRoles((current) => [
      ...current,
      {
        id: `new-${Date.now()}`,
        name: roleName,
        description: "Custom lab role.",
        permissions: ["dashboard.view"],
        isNew: true,
      },
    ]);
    setActiveRoleIndex(roles.length);
    setNewRoleName("");
  }

  function cancelRoleChanges() {
    setRoles(savedRoles);
    setActiveRoleIndex(0);
    setRoleMessage("");
    setSettingsError("");
  }

  async function deleteRole(role, index) {
    setRoleMessage("");
    setSettingsError("");
    if (!role) return;

    if (role.isDefaultAdmin || role.isSystemRole) {
      setSettingsError("This role cannot be deleted.");
      return;
    }

    if (role.isNew) {
      const nextRoles = roles.filter((_, roleIndex) => roleIndex !== index);
      setRoles(nextRoles);
      setActiveRoleIndex((current) => clampRoleIndex(nextRoles, Math.max(0, current - (current >= index ? 1 : 0))));
      return;
    }

    const confirmed = window.confirm(`Delete the role "${role.name}"?`);
    if (!confirmed) return;

    setRoleSaving(true);
    try {
      const response = await fetch(`/api/settings/roles?id=${encodeURIComponent(role.id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.details || "Unable to delete role");

      const nextRoles = data.roles || [];
      clearCachedApi("/api/settings/roles");
      clearCachedApi("/api/settings/users");
      setRoles(nextRoles);
      setSavedRoles(nextRoles);
      setActiveRoleIndex((current) => clampRoleIndex(nextRoles, Math.max(0, current - (current >= index ? 1 : 0))));
      setRoleMessage(`Role "${role.name}" deleted successfully.`);
    } catch (err) {
      setSettingsError(err.message);
    } finally {
      setRoleSaving(false);
    }
  }

  async function saveRoleConfiguration() {
    setRoleSaving(true);
    setRoleMessage("");
    setSettingsError("");

    try {
      const response = await fetch("/api/settings/roles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          roles: roles.map((role) => ({
            id: role.isNew ? undefined : role.id,
            name: role.name,
            description: role.description,
            permissions: role.permissions,
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.details || "Unable to save role configuration");

      const nextRoles = data.roles || [];
      clearCachedApi("/api/settings/roles");
      setRoles(nextRoles);
      setSavedRoles(nextRoles);
      setActiveRoleIndex(0);
      setRoleMessage("Role configuration saved successfully.");
    } catch (err) {
      setSettingsError(err.message);
    } finally {
      setRoleSaving(false);
    }
  }

  return (
    <section className="settings-page">
      <div className="settings-header">
        <div>
          <p className="module-kicker">Lab Admin</p>
          <h1>System Configuration</h1>
          <span>{theme?.labName || "Tenant Lab"} roles and permission mapping.</span>
        </div>
      </div>

      <SuccessDialog message={roleMessage} onClose={() => setRoleMessage("")} />
      {settingsError && <div className="developer-alert">{settingsError}</div>}

      <div className="settings-summary-grid">
        <article>
          <span>Enabled Modules</span>
          <strong>{enabledModules.length}</strong>
        </article>
        <article>
          <span>Active Role Permissions</span>
          <strong>{activePermissionSet.size}</strong>
        </article>
        <article>
          <span>Lab Roles</span>
          <strong>{roles.length}</strong>
        </article>
      </div>

      {loadingSettings ? (
        <p className="developer-empty">Loading settings...</p>
      ) : canManageRoles ? (
        <>
          <RoleManager
            roles={roles}
            activeRoleIndex={activeRoleIndex}
            setActiveRoleIndex={setActiveRoleIndex}
            newRoleName={newRoleName}
            setNewRoleName={setNewRoleName}
            addRole={addRole}
            deleteRole={deleteRole}
            roleSaving={roleSaving}
            rolesDirty={rolesDirty}
            cancelRoleChanges={cancelRoleChanges}
            saveRoleConfiguration={saveRoleConfiguration}
          />

          <PermissionMatrix
            activeRole={activeRole}
            roles={roles}
            permissionsByModule={permissionsByModule}
            activePermissionSet={activePermissionSet}
            toggleRolePermission={toggleRolePermission}
            rolesDirty={rolesDirty}
            roleSaving={roleSaving}
            cancelRoleChanges={cancelRoleChanges}
            saveRoleConfiguration={saveRoleConfiguration}
          />

        </>
      ) : (
        <section className="settings-panel">
          <p className="developer-empty">Your role does not have permission to manage settings.</p>
        </section>
      )}
    </section>
  );
}
