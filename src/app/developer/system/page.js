"use client";

import { useEffect, useMemo, useState } from "react";
import rbacConfig from "@/app/lib/rbac-config.json";
import { availableLabModules, defaultLabModules } from "@/app/lib/modules";
import { cachedJsonFetch, clearCachedApi } from "@/app/lib/use-current-user";
import CmsSuccessDialog from "@/app/developer/components/CmsSuccessDialog";
import { Icons } from "@/app/components/Icons";

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
  const [activeConfigView, setActiveConfigView] = useState("modules");

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
    <section className="developer-page developer-system-page">
      <div className="developer-page-actions">
        <div>
          <p className="developer-kicker">System</p>
          <h2>System Configuration</h2>
          <span>Control laboratory capabilities and administrator access from one governed workspace.</span>
        </div>
        <div className="developer-system-safety">{Icons.shield}<span><strong>Access controls</strong><small>Changes apply only after saving</small></span></div>
      </div>

      {error && <div className="developer-alert">{error}</div>}
      <CmsSuccessDialog message={success} onClose={() => setSuccess("")} />

      <div className="developer-summary-grid developer-system-summary-grid">
        <article className="developer-summary-card">
          <span>Active Labs</span>
          <strong>{loadingLabs ? "—" : labs.length}</strong>
        </article>
        <article className="developer-summary-card">
          <span>Lab Permissions</span>
          <strong>{labPermissions.length}</strong>
        </article>
        <article className="developer-summary-card">
          <span>Current Selection</span>
          <strong>{draftAccess?.enabledModules?.length || 0}</strong>
          <small>enabled modules</small>
        </article>
      </div>

      <div className="developer-system-workspace">
        <aside className="developer-system-context">
          <div className="developer-system-context-heading">
            <span>{Icons.settings}</span>
            <div><strong>Configuration target</strong><small>Select one active laboratory</small></div>
          </div>
          <label>
            Laboratory
            <select value={selectedLabId} onChange={(event) => setSelectedLabId(event.target.value)} disabled={loadingLabs || labs.length === 0}>
              {labs.length === 0 ? <option value="">No labs available</option> : labs.map((lab) => <option key={lab.id} value={lab.id}>{lab.name} ({lab.tenantId})</option>)}
            </select>
          </label>
          <div className="developer-system-lab-card">
            <small>Selected workspace</small>
            <strong>{selectedLab?.name || "No laboratory selected"}</strong>
            <span>{selectedLab?.tenantId || "Choose a laboratory above"}</span>
          </div>
          <dl className="developer-system-context-facts">
            <div><dt>Administrator role</dt><dd>{selectedLab ? `${selectedLab.name} Admin` : "Not available"}</dd></div>
            <div><dt>Enabled modules</dt><dd>{draftAccess?.enabledModules?.length || 0}</dd></div>
            <div><dt>Granted permissions</dt><dd>{draftAccess?.adminPermissions?.length || 0}</dd></div>
          </dl>
          <div className="developer-system-context-note">{Icons.alertCircle}<span>Removing a module also removes its related administrator permissions.</span></div>
        </aside>

        <section className="developer-panel developer-config-section developer-system-config-panel">
          <header className="developer-system-config-header">
            <div><p className="developer-kicker">Lab access policy</p><h2>{selectedLab?.name || "Select a laboratory"}</h2><span>Configure available capabilities and Lab Admin permissions.</span></div>
            <span className={`developer-config-state ${accessDirty ? "changed" : "saved"}`}><i />{accessDirty ? "Unsaved changes" : "Configuration saved"}</span>
          </header>

          <nav className="developer-config-tabs" aria-label="System configuration sections">
            <button type="button" className={activeConfigView === "modules" ? "active" : ""} onClick={() => setActiveConfigView("modules")}>{Icons.grid}<span><strong>Modules</strong><small>{draftAccess?.enabledModules?.length || 0} enabled</small></span></button>
            <button type="button" className={activeConfigView === "permissions" ? "active" : ""} onClick={() => setActiveConfigView("permissions")}>{Icons.shield}<span><strong>Admin permissions</strong><small>{draftAccess?.adminPermissions?.length || 0} granted</small></span></button>
          </nav>

          {loadingAccess ? <p className="developer-empty">Loading lab access...</p> : draftAccess ? <>
            <div className="developer-system-config-body">
              {activeConfigView === "modules" && <section className="developer-config-view">
                <div className="developer-config-view-heading"><div><h3>Enabled modules</h3><p>Choose the functional areas available inside this laboratory workspace.</p></div><span>{draftAccess.enabledModules.length} of {availableLabModules.length}</span></div>
                <div className="developer-module-grid developer-system-module-grid">
                  {availableLabModules.map((moduleConfig) => (
                    <label key={moduleConfig.id} className="developer-module-option">
                      <input type="checkbox" checked={draftAccess.enabledModules.includes(moduleConfig.id)} disabled={moduleConfig.id === "dashboard"} onChange={() => toggleLabModule(moduleConfig.id)} />
                      <span><strong>{moduleConfig.label}</strong><small>{moduleConfig.id === "dashboard" ? "Required foundation" : "Workspace capability"}</small></span>
                    </label>
                  ))}
                </div>
              </section>}

              {activeConfigView === "permissions" && <section className="developer-config-view">
                <div className="developer-config-view-heading"><div><h3>Lab Admin permissions</h3><p>Expand a module to review its available actions.</p></div><span>{draftAccess.adminPermissions.length} granted</span></div>
                <div className="cms-permission-card-list developer-system-permissions">
                  {orderedPermissionGroups.map(([moduleId, permissions]) => {
                    const selectedCount = permissions.filter((permission) => draftAccess.adminPermissions.includes(permission.key)).length;
                    const expanded = expandedPermissionModules.has(moduleId);
                    return <article className="cms-permission-card" key={moduleId}>
                      <button type="button" className="cms-permission-card-header" onClick={() => togglePermissionModule(moduleId)} aria-expanded={expanded}>
                        <span className="cms-permission-toggle">{expanded ? "−" : "+"}</span>
                        <span className="cms-permission-title"><strong>{getModuleLabel(moduleId)}</strong><small>{selectedCount} selected of {permissions.length}</small></span>
                        <span className="cms-permission-status">{selectedCount === permissions.length ? "Full access" : selectedCount === 0 ? "No access" : "Custom"}</span>
                      </button>
                      {expanded && <div className="cms-permission-card-body">
                        <div className="cms-permission-card-tools"><button type="button" className="developer-secondary-link" onClick={() => setModulePermissions(permissions, true)}>Select all</button><button type="button" className="developer-secondary-link" onClick={() => setModulePermissions(permissions, false)}>Clear</button></div>
                        <div className="permission-matrix cms-permission-matrix"><article className="permission-group">
                          <div className="permission-group-header"><strong>{getModuleLabel(moduleId)} actions</strong><span>{permissions.length} permissions</span></div>
                          {permissions.map((permission) => <label className="permission-checkbox" key={permission.key}><input type="checkbox" checked={draftAccess.adminPermissions.includes(permission.key)} onChange={() => toggleLabAdminPermission(permission.key)} /><span><strong>{permission.name}</strong><small>{permission.key}</small></span></label>)}
                        </article></div>
                      </div>}
                    </article>;
                  })}
                </div>
              </section>}
            </div>

            <footer className="developer-config-actions developer-system-savebar">
              <div><strong>{accessDirty ? "Review and save your changes" : "No pending configuration changes"}</strong><span>{accessDirty ? "Updates affect the selected laboratory after saving." : "The current laboratory configuration is up to date."}</span></div>
              <button type="button" className="developer-secondary-link" disabled={!accessDirty || savingAccess} onClick={cancelAccessChanges}>Discard</button>
              <button type="button" className="developer-primary-link" disabled={!accessDirty || savingAccess} onClick={saveAccessChanges}>{savingAccess ? "Saving..." : "Save changes"}</button>
            </footer>
          </> : <p className="developer-empty">Select an active lab to configure access.</p>}
        </section>
      </div>

    </section>
  );
}
