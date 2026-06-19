"use client";

import { useEffect, useMemo, useState } from "react";
import rbacConfig from "@/app/lib/rbac-config.json";
import { availableLabModules, defaultLabModules } from "@/app/lib/modules";
import { cachedJsonFetch, clearCachedApi } from "@/app/lib/use-current-user";
import CmsSuccessDialog from "@/app/developer/components/CmsSuccessDialog";

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

function getModuleLabel(moduleId) {
  const moduleConfig = availableLabModules.find((module) => module.id === moduleId);
  if (moduleConfig) return moduleConfig.label;

  return moduleId
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
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
  const labPermissions = useMemo(
    () => rbacConfig.permissions.filter((permission) => permission.scope !== "developer"),
    []
  );

  const [labs, setLabs] = useState([]);
  const [selectedLabId, setSelectedLabId] = useState("");
  const [savedAccess, setSavedAccess] = useState(null);
  const [draftAccess, setDraftAccess] = useState(null);
  const [loadingLabs, setLoadingLabs] = useState(true);
  const [loadingAccess, setLoadingAccess] = useState(false);
  const [savingAccess, setSavingAccess] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [expandedPermissionModules, setExpandedPermissionModules] = useState(new Set(["dashboard"]));

  const selectedLab = labs.find((lab) => lab.id === selectedLabId);
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
  const orderedPermissionGroups = useMemo(() => {
    const moduleOrder = [
      ...availableLabModules.map((module) => module.id),
      "users",
      "settings",
    ];

    return Object.entries(labPermissionGroups).sort(
      ([leftModule], [rightModule]) =>
        moduleOrder.indexOf(leftModule) - moduleOrder.indexOf(rightModule)
    );
  }, [labPermissionGroups]);
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
        const loadedLabs = (data.labs || []).filter((lab) => lab.status === "active");
        if (!cancelled) {
          setLabs(loadedLabs);
          setSelectedLabId(loadedLabs[0]?.id || "");
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
    if (!selectedLabId) return;
    let cancelled = false;

    async function loadLabAccess() {
      setLoadingAccess(true);
      setError("");
      setSuccess("");

      try {
        const encodedLabId = encodeURIComponent(selectedLabId);
        const { response, data } = await cachedJsonFetch(
          `/api/developer/labs/${encodedLabId}/access`,
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
  }, [selectedLabId, labPermissions]);

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

  function togglePermissionModule(moduleId) {
    setExpandedPermissionModules((current) => {
      const next = new Set(current);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      return next;
    });
  }

  function setModulePermissions(permissions, checked) {
    setDraftAccess((current) => {
      if (!current) return current;
      const nextPermissions = new Set(current.adminPermissions);
      for (const permission of permissions) {
        if (checked) {
          nextPermissions.add(permission.key);
        } else {
          nextPermissions.delete(permission.key);
        }
      }
      return { ...current, adminPermissions: [...nextPermissions] };
    });
  }

  function cancelAccessChanges() {
    setDraftAccess(savedAccess);
    setError("");
    setSuccess("");
  }

  async function saveAccessChanges() {
    if (!selectedLabId || !draftAccess) return;
    setSavingAccess(true);
    setError("");
    setSuccess("");

    try {
      const encodedLabId = encodeURIComponent(selectedLabId);
      const { response, data } = await cachedJsonFetch(`/api/developer/labs/${encodedLabId}/access`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabledModules: draftAccess.enabledModules,
          adminPermissions: draftAccess.adminPermissions,
        }),
      });
      if (!response.ok) throw new Error(data.error || data.details || "Unable to save lab access");

      const nextSavedAccess = {
        enabledModules: data.lab.enabledModules,
        adminPermissions: data.adminRole.permissions,
      };
      clearCachedApi("/api/developer/labs");
      clearCachedApi(`/api/developer/labs/${encodedLabId}/access`);
      setSavedAccess(nextSavedAccess);
      setDraftAccess(nextSavedAccess);
      setLabs((current) =>
        current.map((lab) =>
          lab.id === selectedLabId
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
          <span>Lab-wise admin access and module assignment.</span>
        </div>
      </div>

      {error && <div className="developer-alert">{error}</div>}
      <CmsSuccessDialog message={success} onClose={() => setSuccess("")} />

      <div className="developer-summary-grid">
        <article className="developer-summary-card">
          <span>Active Labs</span>
          <strong>{loadingLabs ? "—" : labs.length}</strong>
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
              value={selectedLabId}
              onChange={(event) => setSelectedLabId(event.target.value)}
              disabled={loadingLabs || labs.length === 0}
            >
              {labs.length === 0 ? (
                <option value="">No labs available</option>
              ) : (
                labs.map((lab) => (
                  <option key={lab.id} value={lab.id}>
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
              <p>Open a module card to choose the permissions required for this lab.</p>
            </div>
            <div className="cms-permission-card-list">
              {orderedPermissionGroups.map(([moduleId, permissions]) => {
                const selectedCount = permissions.filter((permission) =>
                  draftAccess.adminPermissions.includes(permission.key)
                ).length;
                const expanded = expandedPermissionModules.has(moduleId);

                return (
                  <article className="cms-permission-card" key={moduleId}>
                    <button
                      type="button"
                      className="cms-permission-card-header"
                      onClick={() => togglePermissionModule(moduleId)}
                      aria-expanded={expanded}
                    >
                      <span className="cms-permission-toggle">{expanded ? "-" : "+"}</span>
                      <span className="cms-permission-title">
                        <strong>{getModuleLabel(moduleId)}</strong>
                        <small>{selectedCount} selected of {permissions.length}</small>
                      </span>
                      <span className="cms-permission-status">
                        {selectedCount === permissions.length ? "Full access" : "Custom"}
                      </span>
                    </button>

                    {expanded && (
                      <div className="cms-permission-card-body">
                        <div className="cms-permission-card-tools">
                          <button
                            type="button"
                            className="developer-secondary-link"
                            onClick={() => setModulePermissions(permissions, true)}
                          >
                            Select All
                          </button>
                          <button
                            type="button"
                            className="developer-secondary-link"
                            onClick={() => setModulePermissions(permissions, false)}
                          >
                            Clear
                          </button>
                        </div>

                        <div className="permission-matrix cms-permission-matrix">
                          <article className="permission-group" key={moduleId}>
                            <div className="permission-group-header">
                              <strong>{getModuleLabel(moduleId)} Permission Matrix</strong>
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
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
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

    </section>
  );
}
