"use client";

import { useEffect, useMemo, useState } from "react";
import { Icons } from "@/app/components/Icons";
import rbacConfig from "@/app/lib/rbac-config.json";
import { defaultLabModules } from "@/app/lib/modules";

const sampleRoles = [
  {
    name: "Lab Admin",
    description: "Full tenant administration access.",
    permissions: ["*"],
  },
  {
    name: "Receptionist",
    description: "Registration, order entry, billing lookup, and report print access.",
    permissions: [
      "dashboard.view",
      "patients.view",
      "patients.register",
      "patients.edit",
      "doctors.view",
      "orders.view",
      "orders.create",
      "reports.view",
      "reports.print",
    ],
  },
  {
    name: "Technician",
    description: "Sample workflow and report entry.",
    permissions: [
      "dashboard.view",
      "orders.view",
      "samples.view",
      "samples.collect",
      "samples.update",
      "tests.view",
      "reports.view",
      "reports.edit",
    ],
  },
];

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

export default function LabAdminSettingsPage() {
  const [theme, setTheme] = useState(null);
  const [brandingDraft, setBrandingDraft] = useState({
    logo: null,
    logoAltText: "",
    primaryColor: "#0d9488",
    secondaryColor: "#0f766e",
    accentColor: "#f59e0b",
  });
  const [savedBranding, setSavedBranding] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState("");
  const [brandingSaving, setBrandingSaving] = useState(false);
  const [brandingMessage, setBrandingMessage] = useState("");
  const [brandingError, setBrandingError] = useState("");
  const [activeRoleIndex, setActiveRoleIndex] = useState(0);
  const [roles, setRoles] = useState(sampleRoles);
  const [newRoleName, setNewRoleName] = useState("");
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    role: "Lab Admin",
  });

  useEffect(() => {
    let cancelled = false;

    async function loadTheme() {
      try {
        const response = await fetch("/api/theme", { credentials: "include" });
        const data = await response.json();
        if (!cancelled && response.ok) {
          setTheme(data.theme);
          const nextBranding = {
            logo: data.theme.logo
              ? {
                  url: data.theme.logo,
                  altText: data.theme.logoAltText,
                }
              : null,
            logoAltText: data.theme.logoAltText || "",
            primaryColor: data.theme.primaryColor || "#0d9488",
            secondaryColor: data.theme.secondaryColor || "#0f766e",
            accentColor: data.theme.accentColor || "#f59e0b",
          };
          setBrandingDraft(nextBranding);
          setSavedBranding(nextBranding);
        }
      } catch {
        if (!cancelled) setTheme(null);
      }
    }

    loadTheme();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!logoFile) {
      setLogoPreviewUrl("");
      return undefined;
    }

    const objectUrl = URL.createObjectURL(logoFile);
    setLogoPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [logoFile]);

  const enabledModules = theme?.enabledModules?.length ? theme.enabledModules : defaultLabModules;
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
  const activeRole = roles[activeRoleIndex] || roles[0];
  const activePermissions = activeRole?.permissions?.includes("*")
    ? labPermissions.map((permission) => permission.key)
    : activeRole?.permissions || [];

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

    setRoles((current) => [
      ...current,
      {
        name: roleName,
        description: "Custom lab role.",
        permissions: ["dashboard.view"],
      },
    ]);
    setActiveRoleIndex(roles.length);
    setNewRoleName("");
  }

  async function uploadLogoIfSelected() {
    if (!logoFile) return brandingDraft.logo;

    const uploadForm = new FormData();
    uploadForm.append("file", logoFile);
    uploadForm.append("context", "lab-logo");

    const response = await fetch("/api/uploads/image", {
      method: "POST",
      credentials: "include",
      body: uploadForm,
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.details || "Unable to upload logo");
    }

    return {
      ...data.image,
      altText: brandingDraft.logoAltText || `${theme?.labName || "Lab"} logo`,
    };
  }

  async function saveBranding() {
    setBrandingSaving(true);
    setBrandingError("");
    setBrandingMessage("");

    try {
      const logo = await uploadLogoIfSelected();
      const response = await fetch("/api/theme", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          logo,
          logoAltText: brandingDraft.logoAltText,
          primaryColor: brandingDraft.primaryColor,
          secondaryColor: brandingDraft.secondaryColor,
          accentColor: brandingDraft.accentColor,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || "Unable to save branding");
      }

      const nextBranding = {
        logo: data.theme.logo
          ? {
              url: data.theme.logo,
              altText: data.theme.logoAltText,
            }
          : null,
        logoAltText: data.theme.logoAltText || "",
        primaryColor: data.theme.primaryColor,
        secondaryColor: data.theme.secondaryColor,
        accentColor: data.theme.accentColor,
      };

      setTheme(data.theme);
      setBrandingDraft(nextBranding);
      setSavedBranding(nextBranding);
      setLogoFile(null);
      setBrandingMessage("Branding saved.");
    } catch (err) {
      setBrandingError(err.message);
    } finally {
      setBrandingSaving(false);
    }
  }

  function cancelBranding() {
    if (savedBranding) setBrandingDraft(savedBranding);
    setLogoFile(null);
    setBrandingError("");
    setBrandingMessage("");
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

      <section className="settings-panel">
        <div className="settings-panel-header">
          <h2>Lab Branding</h2>
          <p>Upload the lab logo to Cloudinary and update colors used on the login page.</p>
        </div>
        {brandingError && <div className="developer-alert">{brandingError}</div>}
        {brandingMessage && <div className="developer-success">{brandingMessage}</div>}
        <div className="settings-branding-grid">
          <div>
            <label className="settings-file-label">
              Logo Image
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => setLogoFile(event.target.files?.[0] || null)}
              />
            </label>
            {(logoPreviewUrl || brandingDraft.logo?.url) && (
              <div
                className="developer-logo-preview"
                role="img"
                aria-label={brandingDraft.logoAltText || `${theme?.labName || "Lab"} logo`}
                style={{ backgroundImage: `url("${logoPreviewUrl || brandingDraft.logo?.url}")` }}
              />
            )}
          </div>
          <div className="settings-form-grid">
            <label>
              Logo Alt Text
              <input
                value={brandingDraft.logoAltText}
                onChange={(event) =>
                  setBrandingDraft((current) => ({ ...current, logoAltText: event.target.value }))
                }
                placeholder={`${theme?.labName || "Lab"} logo`}
              />
            </label>
            <label>
              Primary Color
              <input
                type="color"
                value={brandingDraft.primaryColor}
                onChange={(event) =>
                  setBrandingDraft((current) => ({ ...current, primaryColor: event.target.value }))
                }
              />
            </label>
            <label>
              Secondary Color
              <input
                type="color"
                value={brandingDraft.secondaryColor}
                onChange={(event) =>
                  setBrandingDraft((current) => ({ ...current, secondaryColor: event.target.value }))
                }
              />
            </label>
            <label>
              Accent Color
              <input
                type="color"
                value={brandingDraft.accentColor}
                onChange={(event) =>
                  setBrandingDraft((current) => ({ ...current, accentColor: event.target.value }))
                }
              />
            </label>
          </div>
        </div>
        <div className="developer-config-actions">
          <button type="button" className="developer-secondary-link" onClick={cancelBranding} disabled={brandingSaving}>
            Cancel
          </button>
          <button type="button" className="developer-primary-link" onClick={saveBranding} disabled={brandingSaving}>
            {brandingSaving ? "Saving..." : "Save Branding"}
          </button>
        </div>
      </section>

      <div className="settings-two-column">
        <section className="settings-panel">
          <div className="settings-panel-header">
            <h2>Lab Roles</h2>
            <p>Create roles inside this lab and assign only allowed tenant permissions.</p>
          </div>

          <div className="settings-role-list">
            {roles.map((role, index) => (
              <button
                type="button"
                className={activeRoleIndex === index ? "active" : ""}
                key={role.name}
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
              {Icons.plus} Add Role
            </button>
          </div>
        </section>

        <section className="settings-panel">
          <div className="settings-panel-header">
            <h2>User Assignment</h2>
            <p>Create lab users and assign one role from this tenant.</p>
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
              Email
              <input
                value={newUser.email}
                onChange={(event) => setNewUser((current) => ({ ...current, email: event.target.value }))}
                placeholder="anita@lab.com"
              />
            </label>
            <label>
              Role
              <select
                value={newUser.role}
                onChange={(event) => setNewUser((current) => ({ ...current, role: event.target.value }))}
              >
                {roles.map((role) => (
                  <option key={role.name} value={role.name}>
                    {role.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="settings-config-note">
            User creation should save into the tenant DB and never into the developer master RBAC area.
          </div>
        </section>
      </div>

      <section className="settings-panel">
        <div className="settings-panel-header">
          <h2>Permission Mapping For {activeRole?.name}</h2>
          <p>Checkbox selection is limited to modules enabled by the developer for this lab.</p>
        </div>

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
      </section>

      <section className="settings-panel">
        <div className="settings-panel-header">
          <h2>Lab Configuration Sections</h2>
          <p>Tenant-level configuration owned by the lab admin.</p>
        </div>
        <div className="settings-section-grid">
          <article>
            <strong>Lab Profile</strong>
            <span>Name, contact details, address, report display identity.</span>
          </article>
          <article>
            <strong>Report Settings</strong>
            <span>Header, footer, signature, templates, print behavior.</span>
          </article>
          <article>
            <strong>Numbering</strong>
            <span>Patient IDs, order numbers, sample IDs, report numbers.</span>
          </article>
          <article>
            <strong>Workflow</strong>
            <span>Sample, order, and report approval defaults.</span>
          </article>
        </div>
      </section>

      <div className="settings-config-note">
        This page defines the tenant-level configuration workspace. Persisting roles, users, and role permissions should be backed by tenant DB APIs protected by <strong>settings.manage</strong> and <strong>users.manage</strong>.
      </div>
    </section>
  );
}
