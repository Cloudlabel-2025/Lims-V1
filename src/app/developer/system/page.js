"use client";

import { useEffect, useMemo, useState } from "react";
import rbacConfig from "@/app/lib/rbac-config.json";
import { availableLabModules, defaultLabModules } from "@/app/lib/modules";
import { cachedJsonFetch, clearCachedApi } from "@/app/lib/use-current-user";

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

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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

  const [labs, setLabs] = useState([]);
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [savedAccess, setSavedAccess] = useState(null);
  const [draftAccess, setDraftAccess] = useState(null);
  const [loadingLabs, setLoadingLabs] = useState(true);
  const [loadingAccess, setLoadingAccess] = useState(false);
  const [savingAccess, setSavingAccess] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Archived labs state
  const [archivedLabs, setArchivedLabs] = useState([]);
  const [loadingArchived, setLoadingArchived] = useState(true);
  const [restoringId, setRestoringId] = useState("");
  const [archiveError, setArchiveError] = useState("");
  const [archiveSuccess, setArchiveSuccess] = useState("");

  const selectedLab = labs.find((lab) => lab.tenantId === selectedTenantId);
  const activeDraftModules = useMemo(() => draftAccess?.enabledModules || [], [draftAccess]);
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
        const { response, data } = await cachedJsonFetch("/api/developer/labs", { ttl: 15_000 });
        if (!response.ok) throw new Error(data.error || "Unable to load labs");
        const loadedLabs = (data.labs || []).filter((lab) => lab.status !== "archived");
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
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadArchived() {
      try {
        const { response, data } = await cachedJsonFetch("/api/developer/labs/archived", { ttl: 10_000 });
        if (!response.ok) throw new Error(data.error || "Unable to load archived labs");
        if (!cancelled) setArchivedLabs(data.labs || []);
      } catch (err) {
        if (!cancelled) setArchiveError(err.message);
      } finally {
        if (!cancelled) setLoadingArchived(false);
      }
    }

    loadArchived();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selectedTenantId) return;
    let cancelled = false;

    async function loadLabAccess() {
      setLoadingAccess(true);
      setError("");
      setSuccess("");

      try {
        const { response, data } = await cachedJsonFetch(
          `/api/developer/labs/${selectedTenantId}/access`,
          { ttl: 10_000 }
        );
        if (!response.ok) throw new Error(data.error || data.details || "Unable to load lab access");

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
        const accessState = { enabledModules, adminPermissions };

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
    return () => { cancelled = true; };
  }, [selectedTenantId, labPermissions]);

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
        ? { ...current, adminPermissions: toggleSetValue(current.adminPermissions, permissionKey) }
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
      if (!response.ok) throw new Error(data.error || data.details || "Unable to save lab access");

      const nextSavedAccess = {
        enabledModules: data.lab.enabledModules,
        adminPermissions: data.adminRole.permissions,
      };
      clearCachedApi("/api/developer/labs");
      clearCachedApi(`/api/developer/labs/${selectedTenantId}/access`);
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

  async function restoreLab(lab) {
    const confirmed = window.confirm(
      `Restore "${lab.name}"?\n\nThis will set the lab back to active and allow users to log in again.`
    );
    if (!confirmed) return;

    setArchiveError("");
    setArchiveSuccess("");
    setRestoringId(lab.tenantId);

    try {
      const response = await fetch("/api/developer/labs/archived", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tenantId: lab.tenantId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to restore lab");

      clearCachedApi("/api/developer/labs/archived");
      clearCachedApi("/api/developer/labs");
      setArchivedLabs((current) => current.filter((item) => item.tenantId !== lab.tenantId));
      setArchiveSuccess(`"${lab.name}" has been restored and is now active.`);
    } catch (err) {
      setArchiveError(err.message);
    } finally {
      setRestoringId("");
    }
  }

  return (
    <section className="developer-page">
      <div className="developer-page-actions">
        <div>
          <p className="developer-kicker">System</p>
          <h2>System Configuration</h2>
          <span>Global RBAC, lab-wise admin access, module assignment, and archived lab recovery.</span>
        </div>
      </div>

      {error && <div className="developer-alert">{error}</div>}
      {success && <div className="developer-success">{success}</div>}

      <div className="developer-summary-grid">
        <article className="developer-summary-card">
          <span>Active Labs</span>
          <strong>{loadingLabs ? "—" : labs.length}</strong>
        </article>
        <article className="developer-summary-card">
          <span>Archived Labs</span>
          <strong>{loadingArchived ? "—" : archivedLabs.length}</strong>
        </article>
        <article className="developer-summary-card">
          <span>Developer Permissions</span>
          <strong>{developerPermissions.length}</strong>
        </article>
        <article className="developer-summary-card">
          <span>Lab Permissions</span>
          <strong>{labPermissions.length}</strong>
        </article>
      </div>

      {/* Lab Wise Access Control */}
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

      {/* Developer RBAC */}
      <section className="developer-panel developer-config-section">
        <div className="developer-panel-header">
          <h2>Developer RBAC</h2>
          <p>Developer control-panel permissions are code-defined and change only during development.</p>
        </div>
        <div className="developer-form-grid">
          <label>
            Role Name
            <input value="Platform Owner" readOnly />
          </label>
          <label>
            Access Scope
            <select value="developer" disabled>
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
                  <input type="checkbox" checked disabled readOnly />
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

      {/* Archived Labs */}
      <section className="developer-panel developer-config-section">
        <div className="developer-panel-header">
          <h2>Archived Labs</h2>
          <p>
            Labs that were deleted. All tenant data is intact. Restore a lab to make it active again.
          </p>
        </div>

        {archiveError && <div className="developer-alert">{archiveError}</div>}
        {archiveSuccess && <div className="developer-success">{archiveSuccess}</div>}

        {loadingArchived ? (
          <p className="developer-empty">Loading archived labs...</p>
        ) : archivedLabs.length === 0 ? (
          <p className="developer-empty">No archived labs. Deleted labs will appear here.</p>
        ) : (
          <div className="developer-lab-list">
            {archivedLabs.map((lab) => (
              <article key={lab.tenantId} className="developer-lab-card">
                <div
                  className="developer-lab-swatch"
                  style={{ background: lab.primaryColor || "#6b7280" }}
                />
                <div>
                  <h3>{lab.name}</h3>
                  <span>
                    {lab.tenantId} · {lab.subscriptionPlan} ·{" "}
                    <em style={{ color: "var(--danger, #dc2626)" }}>archived</em>
                  </span>
                  <small>Created {formatDate(lab.createdAt)}</small>
                  <small style={{ color: "var(--danger, #dc2626)" }}>
                    Archived {formatDate(lab.archivedAt)}
                  </small>
                  {lab.adminEmail && <small>Admin: {lab.adminEmail}</small>}
                  <small>DB: {lab.dbName}</small>
                </div>
                <div className="developer-link-actions">
                  <button
                    type="button"
                    className="developer-submit"
                    disabled={restoringId === lab.tenantId}
                    onClick={() => restoreLab(lab)}
                  >
                    {restoringId === lab.tenantId ? "Restoring..." : "Restore Lab"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
