"use client";

import { useEffect, useMemo, useState } from "react";
import rbacConfig from "@/app/lib/rbac-config.json";
import { availableLabModules, defaultLabModules } from "@/app/lib/modules";

function groupBy(items, key) {
  return items.reduce((groups, item) => {
    const groupKey = item[key] || "general";
    return {
      ...groups,
      [groupKey]: [...(groups[groupKey] || []), item],
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

function sameValues(left, right) {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((value) => rightSet.has(value));
}

function normalizeAdminPermissions(permissions, enabledModules, labPermissions) {
  const enabledModuleSet = new Set(enabledModules);
  const allowedKeys = new Set(
    labPermissions
      .filter(
        (permission) =>
          enabledModuleSet.has(permission.module) ||
          permission.module === "users" ||
          permission.module === "settings"
      )
      .map((permission) => permission.key)
  );

  return permissions.filter((permissionKey) => allowedKeys.has(permissionKey));
}

export default function DeveloperSystemPage() {
  const developerPermissions = useMemo(
    () => rbacConfig.permissions.filter((permission) => permission.scope === "developer"),
    []
  );
  const labPermissions = useMemo(
    () => rbacConfig.permissions.filter((permission) => permission.scope !== "developer"),
    []
  );
  const developerPermissionGroups = useMemo(
    () => groupBy(developerPermissions, "category"),
    [developerPermissions]
  );
  const [developerRole, setDeveloperRole] = useState({
    name: "Platform Owner",
    permissions: developerPermissions.map((permission) => permission.key),
  });
  const [labs, setLabs] = useState([]);
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [savedAccess, setSavedAccess] = useState(null);
  const [draftAccess, setDraftAccess] = useState(null);
  const [loadingLabs, setLoadingLabs] = useState(true);
  const [loadingAccess, setLoadingAccess] = useState(false);
  const [savingAccess, setSavingAccess] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedLab = labs.find((lab) => lab.tenantId === selectedTenantId);
  const activeDraftModules = useMemo(
    () => draftAccess?.enabledModules || [],
    [draftAccess]
  );
  const visibleLabPermissions = useMemo(
    () =>
      labPermissions.filter(
        (permission) =>
          activeDraftModules.includes(permission.module) ||
          permission.module === "users" ||
          permission.module === "settings"
      ),
    [activeDraftModules, labPermissions]
  );
  const labPermissionGroups = useMemo(
    () => groupBy(visibleLabPermissions, "module"),
    [visibleLabPermissions]
  );
  const accessDirty = Boolean(
    savedAccess &&
      draftAccess &&
      (!sameValues(savedAccess.enabledModules, draftAccess.enabledModules) ||
        !sameValues(savedAccess.adminPermissions, draftAccess.adminPermissions))
  );

  useEffect(() => {
    let cancelled = false;

    async function loadLabs() {
      try {
        const response = await fetch("/api/developer/labs", { credentials: "include" });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Unable to load labs");
        }

        const loadedLabs = data.labs || [];
        if (!cancelled) {
          setLabs(loadedLabs);
          setSelectedTenantId(loadedLabs[0]?.tenantId || "");
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoadingLabs(false);
      }
    }

    loadLabs();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedTenantId) return;
    let cancelled = false;

    async function loadLabAccess() {
      setLoadingAccess(true);
      setError("");
      setSuccess("");

      try {
        const response = await fetch(`/api/developer/labs/${selectedTenantId}/access`, {
          credentials: "include",
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || data.details || "Unable to load lab access");
        }

        const enabledModules = data.lab?.enabledModules?.length
          ? data.lab.enabledModules
          : defaultLabModules;
        const adminPermissions = data.adminRole?.permissions?.includes("*")
          ? normalizeAdminPermissions(
              labPermissions.map((permission) => permission.key),
              enabledModules,
              labPermissions
            )
          : normalizeAdminPermissions(data.adminRole?.permissions || [], enabledModules, labPermissions);
        const accessState = {
          enabledModules,
          adminPermissions,
        };

        if (!cancelled) {
          setSavedAccess(accessState);
          setDraftAccess(accessState);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          setSavedAccess(null);
          setDraftAccess(null);
        }
      } finally {
        if (!cancelled) setLoadingAccess(false);
      }
    }

    loadLabAccess();

    return () => {
      cancelled = true;
    };
  }, [selectedTenantId, labPermissions]);

  function toggleDeveloperPermission(permissionKey) {
    setDeveloperRole((current) => ({
      ...current,
      permissions: toggleSetValue(current.permissions, permissionKey),
    }));
  }

  function toggleLabModule(moduleId) {
    setDraftAccess((current) => {
      if (!current) return current;

      const selected = new Set(current.enabledModules);
      if (selected.has(moduleId)) {
        selected.delete(moduleId);
      } else {
        selected.add(moduleId);
      }
      selected.add("dashboard");

      const enabledModules = availableLabModules
        .map((moduleConfig) => moduleConfig.id)
        .filter((id) => selected.has(id));

      return {
        ...current,
        enabledModules,
        adminPermissions: normalizeAdminPermissions(
          current.adminPermissions,
          enabledModules,
          labPermissions
        ),
      };
    });
  }

  function toggleLabAdminPermission(permissionKey) {
    setDraftAccess((current) =>
      current
        ? {
            ...current,
            adminPermissions: toggleSetValue(current.adminPermissions, permissionKey),
          }
        : current
    );
  }

  function cancelAccessChanges() {
    setDraftAccess(savedAccess);
    setError("");
    setSuccess("");
  }

  async function saveAccessChanges() {
    if (!selectedTenantId || !draftAccess) return;

    setSavingAccess(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/developer/labs/${selectedTenantId}/access`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          enabledModules: draftAccess.enabledModules,
          adminPermissions: draftAccess.adminPermissions,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || "Unable to save lab access");
      }

      const nextSavedAccess = {
        enabledModules: data.lab.enabledModules,
        adminPermissions: data.adminRole.permissions,
      };
      setSavedAccess(nextSavedAccess);
      setDraftAccess(nextSavedAccess);
      setLabs((current) =>
        current.map((lab) =>
          lab.tenantId === selectedTenantId
            ? { ...lab, enabledModules: data.lab.enabledModules }
            : lab
        )
      );
      setSuccess("Lab admin permissions and modules saved.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingAccess(false);
    }
  }

  return (
    <section className="developer-page">
      <div className="developer-page-actions">
        <div>
          <p className="developer-kicker">System</p>
          <h2>System Configuration</h2>
          <span>Global RBAC plus lab-wise admin access and module assignment.</span>
        </div>
      </div>

      {error && <div className="developer-alert">{error}</div>}
      {success && <div className="developer-success">{success}</div>}

      <div className="developer-summary-grid">
        <article className="developer-summary-card">
          <span>Total Labs</span>
          <strong>{loadingLabs ? "-" : labs.length}</strong>
        </article>
        <article className="developer-summary-card">
          <span>Developer Permissions</span>
          <strong>{developerPermissions.length}</strong>
        </article>
        <article className="developer-summary-card">
          <span>Lab Permissions</span>
          <strong>{labPermissions.length}</strong>
        </article>
        <article className="developer-summary-card">
          <span>Selected Lab Modules</span>
          <strong>{draftAccess?.enabledModules?.length || 0}</strong>
        </article>
      </div>

      <section className="developer-panel developer-config-section">
        <div className="developer-panel-header">
          <h2>Lab Wise Access Control</h2>
          <p>Select a lab, then modify its enabled modules and Lab Admin role permissions.</p>
        </div>

        <div className="developer-form-grid">
          <label>
            Select Lab
            <select
              value={selectedTenantId}
              onChange={(event) => setSelectedTenantId(event.target.value)}
              disabled={loadingLabs || labs.length === 0}
            >
              {labs.length === 0 ? (
                <option value="">No labs available</option>
              ) : (
                labs.map((lab) => (
                  <option key={lab.tenantId} value={lab.tenantId}>
                    {lab.name} ({lab.tenantId})
                  </option>
                ))
              )}
            </select>
          </label>
          <label>
            Lab Admin Role
            <input value={selectedLab ? `${selectedLab.name} Admin` : "Select a lab"} readOnly />
          </label>
        </div>

        {loadingAccess ? (
          <p className="developer-empty">Loading lab access...</p>
        ) : draftAccess ? (
          <>
            <div className="developer-panel-header developer-subsection-header">
              <h2>Enabled Modules</h2>
              <p>Removing a module also removes its permissions from the Lab Admin draft.</p>
            </div>
            <div className="developer-module-grid">
              {availableLabModules.map((moduleConfig) => (
                <label key={moduleConfig.id} className="developer-module-option">
                  <input
                    type="checkbox"
                    checked={draftAccess.enabledModules.includes(moduleConfig.id)}
                    disabled={moduleConfig.id === "dashboard"}
                    onChange={() => toggleLabModule(moduleConfig.id)}
                  />
                  <span>{moduleConfig.label}</span>
                </label>
              ))}
            </div>

            <div className="developer-panel-header developer-subsection-header">
              <h2>Lab Admin Permissions</h2>
              <p>Only permissions for selected modules are shown here.</p>
            </div>
            <div className="permission-matrix">
              {Object.entries(labPermissionGroups).map(([moduleId, permissions]) => (
                <article className="permission-group" key={moduleId}>
                  <div className="permission-group-header">
                    <strong>{moduleId}</strong>
                    <span>{permissions.length} permissions</span>
                  </div>
                  {permissions.map((permission) => (
                    <label className="permission-checkbox" key={permission.key}>
                      <input
                        type="checkbox"
                        checked={draftAccess.adminPermissions.includes(permission.key)}
                        onChange={() => toggleLabAdminPermission(permission.key)}
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
              <button
                type="button"
                className="developer-secondary-link"
                disabled={!accessDirty || savingAccess}
                onClick={cancelAccessChanges}
              >
                Cancel
              </button>
              <button
                type="button"
                className="developer-primary-link"
                disabled={!accessDirty || savingAccess}
                onClick={saveAccessChanges}
              >
                {savingAccess ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </>
        ) : (
          <p className="developer-empty">Select an active lab to configure access.</p>
        )}
      </section>

      <section className="developer-panel developer-config-section">
        <div className="developer-panel-header">
          <h2>Developer RBAC</h2>
          <p>Create developer control-panel roles and map global developer permissions.</p>
        </div>
        <div className="developer-form-grid">
          <label>
            Role Name
            <input
              value={developerRole.name}
              onChange={(event) =>
                setDeveloperRole((current) => ({ ...current, name: event.target.value }))
              }
            />
          </label>
          <label>
            Access Scope
            <select defaultValue="developer">
              <option value="developer">Developer Control Panel</option>
            </select>
          </label>
        </div>

        <div className="permission-matrix">
          {Object.entries(developerPermissionGroups).map(([group, permissions]) => (
            <article className="permission-group" key={group}>
              <div className="permission-group-header">
                <strong>{group.replaceAll("-", " ")}</strong>
                <span>{permissions.length} permissions</span>
              </div>
              {permissions.map((permission) => (
                <label className="permission-checkbox" key={permission.key}>
                  <input
                    type="checkbox"
                    checked={developerRole.permissions.includes(permission.key)}
                    onChange={() => toggleDeveloperPermission(permission.key)}
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
      </section>

      <section className="developer-panel developer-config-section">
        <div className="developer-panel-header">
          <h2>Permission Catalog Reference</h2>
          <p>Master permission mapping used by developer and lab configuration screens.</p>
        </div>
        <div className="developer-module-catalog">
          {availableLabModules.map((moduleConfig) => {
            const permissions = labPermissions.filter(
              (permission) => permission.module === moduleConfig.id
            );
            return (
              <article key={moduleConfig.id}>
                <strong>{moduleConfig.label}</strong>
                <span>{moduleConfig.id}</span>
                <small>
                  {permissions.map((permission) => permission.key).join(", ") ||
                    "No mapped permissions yet"}
                </small>
                {defaultLabModules.includes(moduleConfig.id) && <em>Default</em>}
              </article>
            );
          })}
        </div>
      </section>
    </section>
  );
}
