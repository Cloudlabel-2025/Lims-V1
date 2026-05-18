"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
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

const UserManager = dynamic(() => import("./UserManager"), {
  ssr: false,
  loading: () => (
    <section className="settings-panel">
      <p className="developer-empty">Loading users...</p>
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

function toggleSetValue(values, value) {
  const next = new Set(values);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return [...next];
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

export default function LabAdminSettingsPage() {
  const { theme, user } = useTenantShell();
  const [activeRoleIndex, setActiveRoleIndex] = useState(0);
  const [roles, setRoles] = useState([]);
  const [savedRoles, setSavedRoles] = useState([]);
  const [newRoleName, setNewRoleName] = useState("");
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    roleId: "",
  });
  const [users, setUsers] = useState([]);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [roleSaving, setRoleSaving] = useState(false);
  const [userSaving, setUserSaving] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [roleMessage, setRoleMessage] = useState("");
  const [userMessage, setUserMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      try {
        setSettingsError("");
        if (!user) return;

        const canManageRoles = hasPermission(user, "settings.manage");
        const canManageUsers = hasPermission(user, "users.manage");

        const [roleResponse, userResponse] = await Promise.all([
          canManageRoles || canManageUsers
            ? cachedJsonFetch("/api/settings/roles", { ttl: 10_000 })
            : Promise.resolve(null),
          canManageUsers
            ? cachedJsonFetch("/api/settings/users", { ttl: 10_000 })
            : Promise.resolve(null),
        ]);
        const roleData = roleResponse ? roleResponse.data : { roles: [] };
        const userData = userResponse ? userResponse.data : { users: [] };

        if (roleResponse && !roleResponse.response.ok) {
          throw new Error(roleData.error || roleData.details || "Unable to load roles");
        }

        if (userResponse && !userResponse.response.ok) {
          throw new Error(userData.error || userData.details || "Unable to load users");
        }

        if (!cancelled) {
          const loadedRoles = roleData.roles || [];
          setRoles(loadedRoles);
          setSavedRoles(loadedRoles);
          setUsers(userData.users || []);
          setNewUser((current) => ({
            ...current,
            roleId: current.roleId || loadedRoles[0]?.id || "",
          }));
        }
      } catch (err) {
        if (!cancelled) {
          setSettingsError(err.message);
        }
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
  const canManageUsers = hasPermission(user, "users.manage");
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
  const newUserErrors = useMemo(() => {
    const errors = {};

    if (newUser.password && newUser.password.length < 8) {
      errors.password = "Password must be at least 8 characters.";
    }

    if (newUser.password && !newUser.confirmPassword) {
      errors.confirmPassword = "Confirm password is required.";
    } else if (newUser.password && newUser.password !== newUser.confirmPassword) {
      errors.confirmPassword = "Password and confirm password must match.";
    }

    return errors;
  }, [newUser.confirmPassword, newUser.password]);
  const canCreateUser =
    Boolean(newUser.password && newUser.confirmPassword) && Object.keys(newUserErrors).length === 0;

  function toggleRolePermission(permissionKey) {
    setRoles((current) =>
      current.map((role, index) =>
        index === activeRoleIndex
          ? {
              ...role,
              permissions: role.permissions.includes("*")
                ? labPermissions
                    .map((permission) => permission.key)
                    .filter((key) => key !== permissionKey)
                : toggleSetValue(role.permissions, permissionKey),
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

      if (!response.ok) {
        throw new Error(data.error || data.details || "Unable to delete role");
      }

      const nextRoles = data.roles || [];
      clearCachedApi("/api/settings/roles");
      clearCachedApi("/api/settings/users");
      setRoles(nextRoles);
      setSavedRoles(nextRoles);
      setActiveRoleIndex((current) => clampRoleIndex(nextRoles, Math.max(0, current - (current >= index ? 1 : 0))));
      setNewUser((current) => ({
        ...current,
        roleId: nextRoles.some((item) => item.id === current.roleId) ? current.roleId : nextRoles[0]?.id || "",
      }));
      setRoleMessage(`Role "${role.name}" deleted.`);
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

      if (!response.ok) {
        throw new Error(data.error || data.details || "Unable to save role configuration");
      }

      const nextRoles = data.roles || [];
      clearCachedApi("/api/settings/roles");
      setRoles(nextRoles);
      setSavedRoles(nextRoles);
      setActiveRoleIndex(0);
      setNewUser((current) => ({
        ...current,
        roleId: nextRoles.some((role) => role.id === current.roleId)
          ? current.roleId
          : nextRoles[0]?.id || "",
      }));
      setRoleMessage("Role configuration saved.");
    } catch (err) {
      setSettingsError(err.message);
    } finally {
      setRoleSaving(false);
    }
  }

  async function createUser() {
    setUserSaving(true);
    setUserMessage("");
    setSettingsError("");

    try {
      const response = await fetch("/api/settings/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(newUser),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || "Unable to create user");
      }

      clearCachedApi("/api/settings/users");
      setUsers((current) => [data.user, ...current]);
      setUserMessage(`User created. Login User ID: ${data.user.userId}`);
      setNewUser({
        name: "",
        email: "",
        password: "",
        confirmPassword: "",
        roleId: roles[0]?.id || "",
      });
    } catch (err) {
      setSettingsError(err.message);
    } finally {
      setUserSaving(false);
    }
  }

  return (
    <section className="settings-page">
      <div className="settings-header">
        <div>
          <p className="module-kicker">Lab Admin</p>
          <h1>System Configuration</h1>
          <span>{theme?.labName || "Tenant Lab"} configuration, roles, users, and permission mapping.</span>
        </div>
      </div>

      {settingsError && <div className="developer-alert">{settingsError}</div>}
      {roleMessage && <div className="developer-success">{roleMessage}</div>}
      {userMessage && <div className="developer-success">{userMessage}</div>}

      <div className="settings-summary-grid">
        <article>
          <span>Enabled Modules</span>
          <strong>{enabledModules.length}</strong>
        </article>
        <article>
          <span>Allowed Permissions</span>
          <strong>{labPermissions.length}</strong>
        </article>
        <article>
          <span>Lab Roles</span>
          <strong>{roles.length}</strong>
        </article>
      </div>

      {loadingSettings ? (
        <p className="developer-empty">Loading settings...</p>
      ) : (
        <>
          {canManageRoles && (
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
          )}

          {canManageRoles && (
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
          )}

          {canManageUsers && (
            <UserManager
              newUser={newUser}
              setNewUser={setNewUser}
              newUserErrors={newUserErrors}
              roles={roles}
              createUser={createUser}
              userSaving={userSaving}
              rolesDirty={rolesDirty}
              canCreateUser={canCreateUser}
              users={users}
            />
          )}

          {!canManageRoles && !canManageUsers && (
            <section className="settings-panel">
              <p className="developer-empty">Your role does not have permission to manage settings or users.</p>
            </section>
          )}
        </>
      )}

    </section>
  );
}
