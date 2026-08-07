"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import SuccessDialog from "@/app/components/SuccessDialog";
import { cachedJsonFetch, clearCachedApi, useTenantShell } from "@/app/lib/use-current-user";
import { uploadImageThroughServer } from "@/app/lib/client-image-upload";
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
  const { theme, user, setTheme } = useTenantShell();
  const [activeTab, setActiveTab] = useState("roles");

  const [activeRoleIndex, setActiveRoleIndex] = useState(0);
  const [roles, setRoles] = useState([]);
  const [savedRoles, setSavedRoles] = useState([]);
  const [newRoleName, setNewRoleName] = useState("");
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [roleSaving, setRoleSaving] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [roleMessage, setRoleMessage] = useState("");
  const [expandedModules, setExpandedModules] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  // Branding states
  const [labName, setLabName] = useState("");
  const [upiId, setUpiId] = useState("");
  const [primaryColor, setPrimaryColor] = useState("");
  const [secondaryColor, setSecondaryColor] = useState("");
  const [accentColor, setAccentColor] = useState("");
  const [loginHighlights, setLoginHighlights] = useState([]);
  const [logo, setLogo] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [logoRemoved, setLogoRemoved] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);

  const [reportHeader, setReportHeader] = useState(null);
  const [headerFile, setHeaderFile] = useState(null);
  const [headerPreview, setHeaderPreview] = useState("");
  const [headerRemoved, setHeaderRemoved] = useState(false);
  const [headerUploading, setHeaderUploading] = useState(false);

  // Numbering prefixes states
  const [patientPrefix, setPatientPrefix] = useState("");
  const [doctorPrefix, setDoctorPrefix] = useState("");
  const [savingBranding, setSavingBranding] = useState(false);
  const [savingNumbering, setSavingNumbering] = useState(false);

  useEffect(() => {
    if (theme) {
      setLabName(theme.labName || "");
      setUpiId(theme.upiId || "");
      setPrimaryColor(theme.primaryColor || "#0d9488");
      setSecondaryColor(theme.secondaryColor || "#0f766e");
      setAccentColor(theme.accentColor || "#f59e0b");
      setLoginHighlights(theme.loginHighlights || []);
      setLogo(theme.logo ? { url: theme.logo, altText: theme.logoAltText } : null);
      setReportHeader(theme.reportHeader ? { url: theme.reportHeader } : null);
      if (theme.numbering) {
        setPatientPrefix(theme.numbering.patientPrefix || "");
        setDoctorPrefix(theme.numbering.doctorPrefix || "");
      }
    }
  }, [theme]);

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
      setLogoRemoved(false);
    }
  };

  const handleHeaderChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setHeaderFile(file);
      setHeaderPreview(URL.createObjectURL(file));
      setHeaderRemoved(false);
    }
  };

  const handleAddHighlight = () => {
    if (loginHighlights.length < 6) {
      setLoginHighlights([...loginHighlights, ""]);
    }
  };

  const handleRemoveHighlight = (idx) => {
    setLoginHighlights(loginHighlights.filter((_, i) => i !== idx));
  };

  const handleHighlightChange = (idx, val) => {
    const next = [...loginHighlights];
    next[idx] = val;
    setLoginHighlights(next);
  };

  const handleSaveBranding = async (e) => {
    e.preventDefault();
    setSavingBranding(true);
    setSettingsError("");
    setRoleMessage("");

    try {
      let uploadedLogo = null;
      let uploadedHeader = null;

      if (logoFile) {
        setLogoUploading(true);
        try {
          uploadedLogo = await uploadImageThroughServer(logoFile, {
            context: "lab-logo",
            tenantId: theme.tenantId,
            altText: `${labName} logo`
          });
        } finally {
          setLogoUploading(false);
        }
      }

      if (headerFile) {
        setHeaderUploading(true);
        try {
          uploadedHeader = await uploadImageThroughServer(headerFile, {
            context: "report-header",
            tenantId: theme.tenantId,
            altText: `${labName} report header`
          });
        } finally {
          setHeaderUploading(false);
        }
      }

      const patchBody = {
        labName,
        upiId,
        primaryColor,
        secondaryColor,
        accentColor,
        loginHighlights: loginHighlights.filter(Boolean),
        logoAltText: `${labName} logo`,
      };

      if (logoRemoved) {
        patchBody.removeLogo = true;
      } else if (uploadedLogo) {
        patchBody.logo = uploadedLogo;
      }

      if (headerRemoved) {
        patchBody.reportHeader = null;
      } else if (uploadedHeader) {
        patchBody.reportHeader = uploadedHeader;
      }

      const response = await fetch("/api/theme", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(patchBody),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to update branding settings");
      }

      setTheme(data.theme);
      setRoleMessage("Branding and profile settings updated successfully.");
      setLogoFile(null);
      setHeaderFile(null);
      setLogoPreview("");
      setHeaderPreview("");
      setLogoRemoved(false);
      setHeaderRemoved(false);
    } catch (err) {
      setSettingsError(err.message);
    } finally {
      setSavingBranding(false);
    }
  };

  const handleSaveNumbering = async (e) => {
    e.preventDefault();
    setSavingNumbering(true);
    setSettingsError("");
    setRoleMessage("");

    try {
      const response = await fetch("/api/theme", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          numbering: {
            patientPrefix: patientPrefix.trim(),
            doctorPrefix: doctorPrefix.trim()
          }
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to update numbering settings");
      }

      setTheme(data.theme);
      setRoleMessage("Numbering prefixes updated successfully.");
    } catch (err) {
      setSettingsError(err.message);
    } finally {
      setSavingNumbering(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      try {
        setSettingsError("");
        if (!user) return;

        if (!hasPermission(user, "settings.manage") && !hasPermission(user, "users.manage")) {
          if (!cancelled) {
            setRoles([]);
            setLoadingSettings(false);
            if (hasPermission(user, "settings.branding")) {
              setActiveTab("branding");
            }
          }
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
  const canManageBranding = hasPermission(user, "settings.branding");
  const canManageSettings = canManageRoles || canManageBranding;

  const labPermissions = useMemo(
    () =>
      rbacConfig.permissions.filter(
        (permission) =>
          permission.scope !== "developer" &&
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

  async function importStandardRoles() {
    setRoleSaving(true);
    setRoleMessage("");
    setSettingsError("");

    try {
      const response = await fetch("/api/settings/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.details || "Unable to import standard role templates");

      const nextRoles = data.roles || [];
      clearCachedApi("/api/settings/roles");
      setRoles(nextRoles);
      setSavedRoles(nextRoles);
      setActiveRoleIndex(0);
      setRoleMessage(data.message || "Standard role templates imported successfully.");
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

  function toggleModuleExpand(moduleId) {
    setExpandedModules((current) => {
      const next = new Set(current);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      return next;
    });
  }

  function handleSelectAll(_moduleId, permissions) {
    setRoles((current) =>
      current.map((role, index) =>
        index === activeRoleIndex
          ? {
              ...role,
              permissions: (() => {
                const selected = new Set(
                  role.permissions.includes("*")
                    ? labPermissions.map((p) => p.key)
                    : role.permissions
                );
                permissions.forEach((permission) => {
                  addPermissionWithDependencies(selected, permission.key, permissionByKey);
                });
                return labPermissions
                  .map((p) => p.key)
                  .filter((key) => selected.has(key));
              })(),
            }
          : role
      )
    );
  }

  function handleClear(_moduleId, permissions) {
    setRoles((current) =>
      current.map((role, index) =>
        index === activeRoleIndex
          ? {
              ...role,
              permissions: (() => {
                const selected = new Set(
                  role.permissions.includes("*")
                    ? labPermissions.map((p) => p.key)
                    : role.permissions
                );
                permissions.forEach((permission) => {
                  removePermissionWithDependents(selected, permission.key, dependentKeysByPermission);
                });
                return labPermissions
                  .map((p) => p.key)
                  .filter((key) => selected.has(key));
              })(),
            }
          : role
      )
    );
  }

  return (
    <section className="settings-page">
      <div className="settings-header">
        <div>
          <p className="module-kicker">Lab Admin</p>
          <h1>System Configuration</h1>
          <span>{theme?.labName || "Tenant Lab"} organization settings, roles, and branding.</span>
        </div>
      </div>

      <SuccessDialog message={roleMessage} onClose={() => setRoleMessage("")} />
      {settingsError && <div className="developer-alert">{settingsError}</div>}

      <div className="settings-tabs">
        {canManageRoles && (
          <button
            className={activeTab === "roles" ? "active" : ""}
            onClick={() => setActiveTab("roles")}
          >
            Roles & Permissions
          </button>
        )}
        {canManageBranding && (
          <button
            className={activeTab === "branding" ? "active" : ""}
            onClick={() => setActiveTab("branding")}
          >
            Lab Profile & Branding
          </button>
        )}
        {canManageRoles && (
          <button
            className={activeTab === "numbering" ? "active" : ""}
            onClick={() => setActiveTab("numbering")}
          >
            Numbering Formats
          </button>
        )}
      </div>

      {loadingSettings ? (
        <p className="developer-empty">Loading settings...</p>
      ) : !canManageSettings ? (
        <section className="settings-panel">
          <p className="developer-empty">Your role does not have permission to manage settings.</p>
        </section>
      ) : activeTab === "roles" ? (
        !canManageRoles ? (
          <section className="settings-panel">
            <p className="developer-empty">Your role does not have permission to manage roles.</p>
          </section>
        ) : (
          <>
            <div className="settings-summary-grid mb-4">
              <article>
                <span>Active Role Permissions</span>
                <strong>{activePermissionSet.size}</strong>
              </article>
              <article>
                <span>Lab Roles</span>
                <strong>{roles.length}</strong>
              </article>
            </div>

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
              expandedModules={expandedModules}
              onToggleModuleExpand={toggleModuleExpand}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              handleSelectAll={handleSelectAll}
              handleClear={handleClear}
              permissionByKey={permissionByKey}
            />
          </>
        )
      ) : activeTab === "branding" ? (
        !canManageBranding ? (
          <section className="settings-panel">
            <p className="developer-empty">Your role does not have permission to manage lab branding.</p>
          </section>
        ) : (
          <section className="settings-panel">
          <div className="settings-panel-header">
            <h2>Lab Profile & Branding</h2>
            <p>Configure your workspace details, primary colors, login highlights, and logo assets.</p>
          </div>

          <form onSubmit={handleSaveBranding} className="p-4">
            <div className="row mb-4">
              <div className="col-md-6 mb-3">
                <label className="form-label font-bold text-xs uppercase tracking-wider text-slate-500">Lab Display Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={labName}
                  onChange={(e) => setLabName(e.target.value)}
                  placeholder="Enter Lab display name"
                  required
                />
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label font-bold text-xs uppercase tracking-wider text-slate-500">Business UPI ID (Static VPA)</label>
                <input
                  type="text"
                  className="form-control"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  placeholder="e.g. merchant@okaxis"
                />
                <div className="form-text">Optional. Enables direct scan-to-pay opening Google Pay / PhonePe directly on patient&apos;s phone.</div>
              </div>
            </div>

            <h4 className="border-bottom pb-2 mb-3 mt-4 text-sm font-bold uppercase text-slate-500">Theme Palette & Colors</h4>
            <div className="row mb-4">
              <div className="col-md-4 mb-3">
                <label className="form-label font-bold text-xs uppercase tracking-wider text-slate-500">Primary Theme Color</label>
                <div className="d-flex gap-2">
                  <input
                    type="color"
                    className="form-control form-control-color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                  />
                  <input
                    type="text"
                    className="form-control"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    placeholder="#HEX"
                    pattern="^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$"
                  />
                </div>
              </div>

              <div className="col-md-4 mb-3">
                <label className="form-label font-bold text-xs uppercase tracking-wider text-slate-500">Secondary theme Color</label>
                <div className="d-flex gap-2">
                  <input
                    type="color"
                    className="form-control form-control-color"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                  />
                  <input
                    type="text"
                    className="form-control"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    placeholder="#HEX"
                    pattern="^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$"
                  />
                </div>
              </div>

              <div className="col-md-4 mb-3">
                <label className="form-label font-bold text-xs uppercase tracking-wider text-slate-500">Accent Theme Color</label>
                <div className="d-flex gap-2">
                  <input
                    type="color"
                    className="form-control form-control-color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                  />
                  <input
                    type="text"
                    className="form-control"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    placeholder="#HEX"
                    pattern="^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$"
                  />
                </div>
              </div>
            </div>

            <h4 className="border-bottom pb-2 mb-3 mt-4 text-sm font-bold uppercase text-slate-500">Branding Assets</h4>
            <div className="row mb-4">
              <div className="col-md-6 mb-3">
                <label className="form-label font-bold text-xs uppercase tracking-wider text-slate-500">Workspace Logo</label>
                {logo && !logoRemoved ? (
                  <div className="mb-3 p-3 border rounded bg-light d-flex align-items-center justify-content-between">
                    <img src={logoPreview || logo.url} alt="Lab Logo" style={{ maxHeight: "50px", objectFit: "contain" }} />
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => { setLogoRemoved(true); setLogoPreview(""); }}
                    >
                      Remove Logo
                    </button>
                  </div>
                ) : (
                  <div className="mb-3">
                    <input
                      type="file"
                      className="form-control"
                      accept="image/*"
                      onChange={handleLogoChange}
                    />
                    {logoPreview && (
                      <div className="mt-2">
                        <img src={logoPreview} alt="Logo Preview" style={{ maxHeight: "50px", objectFit: "contain" }} />
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="col-md-6 mb-3">
                <label className="form-label font-bold text-xs uppercase tracking-wider text-slate-500">Report Letterhead / Header</label>
                {reportHeader && !headerRemoved ? (
                  <div className="mb-3 p-3 border rounded bg-light d-flex align-items-center justify-content-between">
                    <img src={headerPreview || reportHeader.url} alt="Report Header" style={{ maxHeight: "50px", objectFit: "contain" }} />
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => { setHeaderRemoved(true); setHeaderPreview(""); }}
                    >
                      Remove Header
                    </button>
                  </div>
                ) : (
                  <div className="mb-3">
                    <input
                      type="file"
                      className="form-control"
                      accept="image/*"
                      onChange={handleHeaderChange}
                    />
                    {headerPreview && (
                      <div className="mt-2">
                        <img src={headerPreview} alt="Header Preview" style={{ maxHeight: "50px", objectFit: "contain" }} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <h4 className="border-bottom pb-2 mb-3 mt-4 text-sm font-bold uppercase text-slate-500">Login Page highlights (Max 6)</h4>
            <div className="mb-4">
              {loginHighlights.map((hl, idx) => (
                <div key={idx} className="d-flex gap-2 mb-2 align-items-center">
                  <span className="text-slate-400 font-bold text-xs">#{idx + 1}</span>
                  <input
                    type="text"
                    className="form-control"
                    value={hl}
                    onChange={(e) => handleHighlightChange(idx, e.target.value)}
                    placeholder="Enter short lab highlight or message"
                    maxLength={80}
                  />
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => handleRemoveHighlight(idx)}
                  >
                    Remove
                  </button>
                </div>
              ))}
              {loginHighlights.length < 6 && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={handleAddHighlight}
                >
                  + Add Highlight item
                </button>
              )}
            </div>

            <div className="mt-4 border-top pt-3 d-flex justify-content-end gap-2">
              <button
                type="submit"
                className="btn btn-primary d-inline-flex align-items-center gap-2"
                disabled={savingBranding || logoUploading || headerUploading}
              >
                {savingBranding ? "Saving Profile..." : "Save branding Configuration"}
              </button>
            </div>
          </form>
        </section>
        )
      ) : (
        <section className="settings-panel">
          <div className="settings-panel-header">
            <h2>Numbering Formats</h2>
            <p>Customize the identifier generation prefixes for patient and referral doctor records.</p>
          </div>

          <form onSubmit={handleSaveNumbering} className="p-4">
            <div className="row mb-4">
              <div className="col-md-6 mb-3">
                <label className="form-label font-bold text-xs uppercase tracking-wider text-slate-500">Patient ID Prefix</label>
                <input
                  type="text"
                  className="form-control"
                  value={patientPrefix}
                  onChange={(e) => setPatientPrefix(e.target.value)}
                  placeholder="e.g. PT"
                  maxLength={10}
                  required
                />
                <div className="form-text">Used when generating UHIDs and patient identifiers. Uppercase letters, numbers, and dashes only.</div>
              </div>

              <div className="col-md-6 mb-3">
                <label className="form-label font-bold text-xs uppercase tracking-wider text-slate-500">Doctor ID Prefix</label>
                <input
                  type="text"
                  className="form-control"
                  value={doctorPrefix}
                  onChange={(e) => setDoctorPrefix(e.target.value)}
                  placeholder="e.g. DR"
                  maxLength={10}
                  required
                />
                <div className="form-text">Used when registering referring doctor codes. Uppercase letters, numbers, and dashes only.</div>
              </div>
            </div>

            <div className="mt-4 border-top pt-3 d-flex justify-content-end">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={savingNumbering}
              >
                {savingNumbering ? "Saving prefixes..." : "Save prefix Configuration"}
              </button>
            </div>
          </form>
        </section>
      )}
    </section>
  );
}
