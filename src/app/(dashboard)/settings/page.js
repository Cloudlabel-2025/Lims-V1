"use client";

import { useEffect, useMemo, useState } from "react";
import { Icons } from "@/app/components/Icons";
import PasswordField from "@/app/components/PasswordField";
import rbacConfig from "@/app/lib/rbac-config.json";
import { defaultLabModules } from "@/app/lib/modules";
import { hasPermission } from "@/app/lib/client-rbac";

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

export default function LabAdminSettingsPage() {
  const [theme, setTheme] = useState(null);
  const [user, setUser] = useState(null);
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
        const sessionResponse = await fetch("/api/auth/me", { credentials: "include" });
        const sessionData = await sessionResponse.json();
        if (!sessionResponse.ok) {
          throw new Error(sessionData.error || "Unable to load session");
        }

        const sessionUser = sessionData.user;
        const canManageRoles = hasPermission(sessionUser, "settings.manage");
        const canManageUsers = hasPermission(sessionUser, "users.manage");

        const [themeResponse, roleResponse, userResponse] = await Promise.all([
          fetch("/api/theme", { credentials: "include" }),
          canManageRoles || canManageUsers
            ? fetch("/api/settings/roles", { credentials: "include" })
            : Promise.resolve(null),
          canManageUsers
            ? fetch("/api/settings/users", { credentials: "include" })
            : Promise.resolve(null),
        ]);
        const [themeData, roleData, userData] = await Promise.all([
          themeResponse.json(),
          roleResponse ? roleResponse.json() : Promise.resolve({ roles: [] }),
          userResponse ? userResponse.json() : Promise.resolve({ users: [] }),
        ]);

        if (!cancelled && themeResponse.ok) {
          setTheme(themeData.theme);
        }

        if (roleResponse && !roleResponse.ok) {
          throw new Error(roleData.error || roleData.details || "Unable to load roles");
        }

        if (userResponse && !userResponse.ok) {
          throw new Error(userData.error || userData.details || "Unable to load users");
        }

        if (!cancelled) {
          const loadedRoles = roleData.roles || [];
          setUser(sessionUser);
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
          setTheme(null);
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
  }, []);

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
  const activePermissions = activeRole?.permissions?.includes("*")
    ? labPermissions.map((permission) => permission.key)
    : activeRole?.permissions || [];
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
      <section className="settings-panel">
          <div className="settings-panel-header">
            <h2>Lab Roles</h2>
            <p>Create roles inside this lab and assign only allowed permissions.</p>
          </div>

          <div className="settings-role-list">
            {roles.map((role, index) => (
              <button
                type="button"
                className={activeRoleIndex === index ? "active" : ""}
                key={role.id || role.name}
                onClick={() => setActiveRoleIndex(index)}
              >
                <strong>{role.name}</strong>
                <span>{role.permissions.includes("*") ? "All permissions" : `${role.permissions.length} permissions`}</span>
              </button>
            ))}
          </div>

          <div className="settings-inline-form">
            <input
              value={newRoleName}
              onChange={(event) => setNewRoleName(event.target.value)}
              placeholder="Create role, e.g. Billing Cashier"
            />
            <button type="button" onClick={addRole}>
              {Icons.plus} Add Roles
            </button>
          </div>
          <div className="developer-config-actions">
            <button type="button" className="developer-secondary-link" onClick={cancelRoleChanges} disabled={!rolesDirty || roleSaving}>
              Cancel
            </button>
            <button type="button" className="developer-primary-link" onClick={saveRoleConfiguration} disabled={!rolesDirty || roleSaving}>
              {roleSaving ? "Saving..." : "Save Role Configuration"}
            </button>
          </div>
      </section>
      )}

      {canManageRoles && (
      <section className="settings-panel">
        <div className="settings-panel-header">
          <h2>Permission Mapping For {activeRole?.name || "New Role"}</h2>
          <p>Checkbox selection is limited to modules enabled by the developer for this lab.</p>
        </div>

        {roles.length === 0 ? (
          <p className="developer-empty">Create a role first, then choose permissions for it.</p>
        ) : (
          <>
          <div className="permission-matrix">
          {Object.entries(permissionsByModule).map(([moduleId, permissions]) => (
            <article className="permission-group" key={moduleId}>
              <div className="permission-group-header">
                <strong>{moduleId}</strong>
                <span>{permissions.length} permissions</span>
              </div>
              {permissions.map((permission) => (
                <label className="permission-checkbox" key={permission.key}>
                  <input
                    type="checkbox"
                    checked={activePermissions.includes(permission.key)}
                    onChange={() => toggleRolePermission(permission.key)}
                  />
                  <span>
                    <strong>{permission.name}</strong>
                    <small>{permission.key}</small>
                  </span>
                </label>
              ))}
            </article>
          ))}
          </div>
          <div className="developer-config-actions">
            <button type="button" className="developer-secondary-link" onClick={cancelRoleChanges} disabled={!rolesDirty || roleSaving}>
              Cancel
            </button>
            <button type="button" className="developer-primary-link" onClick={saveRoleConfiguration} disabled={!rolesDirty || roleSaving}>
              {roleSaving ? "Saving..." : "Save Role Configuration"}
            </button>
          </div>
          </>
        )}
      </section>
      )}

      {canManageUsers && (
      <section className="settings-panel">
        <div className="settings-panel-header">
          <h2>User Assignment</h2>
          <p>Create lab users and assign one role for this lab.</p>
        </div>
        <div className="settings-form-grid">
          <label>
            User Name
            <input
              value={newUser.name}
              onChange={(event) => setNewUser((current) => ({ ...current, name: event.target.value }))}
              placeholder="Anita Kumar"
            />
          </label>
          <label>
            Login Email
            <input
              type="email"
              name="lab-settings-new-user-email"
              value={newUser.email}
              onChange={(event) => setNewUser((current) => ({ ...current, email: event.target.value }))}
              placeholder="anita@lab.com"
              autoComplete="section-lab-settings-new-user username"
            />
          </label>
          <label>
            Password
            <PasswordField
              name="lab-settings-new-user-password"
              value={newUser.password}
              onChange={(event) => setNewUser((current) => ({ ...current, password: event.target.value }))}
              placeholder="Minimum 8 characters"
              autoComplete="section-lab-settings-new-user new-password"
              invalid={Boolean(newUserErrors.password)}
              toggleLabel="user password"
            />
            {newUserErrors.password && <em>{newUserErrors.password}</em>}
          </label>
          <label>
            Confirm Password
            <PasswordField
              name="lab-settings-new-user-confirm-password"
              value={newUser.confirmPassword}
              onChange={(event) => setNewUser((current) => ({ ...current, confirmPassword: event.target.value }))}
              placeholder="Repeat password"
              autoComplete="section-lab-settings-new-user new-password"
              invalid={Boolean(newUserErrors.confirmPassword)}
              toggleLabel="confirm user password"
            />
            {newUserErrors.confirmPassword && <em>{newUserErrors.confirmPassword}</em>}
          </label>
          <label>
            Role
            <select
              value={newUser.roleId}
              onChange={(event) => setNewUser((current) => ({ ...current, roleId: event.target.value }))}
            >
              {roles.map((role) => (
                <option key={role.id || role.name} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="developer-config-actions">
          <button type="button" className="developer-primary-link" onClick={createUser} disabled={userSaving || rolesDirty || !canCreateUser}>
            {userSaving ? "Creating..." : "Create Lab User"}
          </button>
        </div>
        {rolesDirty && <p className="developer-empty">Save role configuration before creating users.</p>}
        {users.length > 0 && (
          <div className="settings-role-list">
            {users.map((user) => (
              <button type="button" key={user.id}>
                <strong>{user.userId}</strong>
                <span>{user.email} - {user.role?.name || "No role"}</span>
              </button>
            ))}
          </div>
        )}
      </section>
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
