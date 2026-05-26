"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { availableLabModules } from "@/app/lib/modules";
import { Icons } from "@/app/components/Icons";
import PasswordField from "@/app/components/PasswordField";
import { clearCachedApi } from "@/app/lib/use-current-user";

const loginHighlightOptions = [
  "Patient Registration & Tracking",
  "Doctor & Referral Management",
  "Lab Test Definitions",
  "Billing Queue",
  "Sample Collection Workflow",
  "Report Generation",
  "Billing & Payments",
  "Inventory Management",
  "Quality Control",
];

const emptyForm = {
  name: "",
  tenantId: "",
  status: "active",
  subscriptionPlan: "trial",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  adminEmail: "",
  adminPassword: "",
  adminConfirmPassword: "",
  primaryColor: "#0d9488",
  secondaryColor: "#0f766e",
  accentColor: "#f59e0b",
  enabledModules: ["dashboard"],
  loginHighlights: [],
};

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

async function readResponseJson(response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

function validateForm(form) {
  const errors = {};

  if (!form.name.trim() || form.name.trim().length < 2) {
    errors.name = "Lab name must be at least 2 characters.";
  }

  if (form.contactEmail && !isEmail(form.contactEmail)) {
    errors.contactEmail = "Enter a valid contact email.";
  }

  if (form.contactPhone && !/^\d{10}$/.test(form.contactPhone)) {
    errors.contactPhone = "Phone number must be exactly 10 digits.";
  }

  if (form.adminEmail && !isEmail(form.adminEmail)) {
    errors.adminEmail = "Enter a valid admin email.";
  }

  if (form.adminPassword && form.adminPassword.length < 8) {
    errors.adminPassword = "Password must be at least 8 characters.";
  }

  if (form.adminPassword && !form.adminConfirmPassword) {
    errors.adminConfirmPassword = "Confirm password is required.";
  } else if (form.adminPassword && form.adminPassword !== form.adminConfirmPassword) {
    errors.adminConfirmPassword = "Password and confirm password must match.";
  }

  if (!form.enabledModules.includes("dashboard")) {
    errors.enabledModules = "Dashboard module is required.";
  }

  return errors;
}

export default function DeveloperEditLabPage({ params }) {
  const { id } = use(params);
  const [form, setForm] = useState(emptyForm);
  const [customHighlight, setCustomHighlight] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const formErrors = useMemo(() => validateForm(form), [form]);
  const canSubmit = Object.keys(formErrors).length === 0;

  useEffect(() => {
    let cancelled = false;

    async function loadLab() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(`/api/developer/labs/${encodeURIComponent(id)}`, {
          credentials: "include",
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || data.details || "Unable to load lab");
        }

        if (!cancelled) {
          setForm({
            ...emptyForm,
            name: data.lab.name || "",
            tenantId: data.lab.tenantId || "",
            status: data.lab.status || "active",
            subscriptionPlan: data.lab.subscriptionPlan || "trial",
            contactName: data.lab.contactName || "",
            contactEmail: data.lab.contactEmail || "",
            contactPhone: data.lab.contactPhone || "",
            adminEmail: data.lab.adminEmail || "",
            adminPassword: "",
            adminConfirmPassword: "",
            primaryColor: data.lab.primaryColor || emptyForm.primaryColor,
            secondaryColor: data.lab.secondaryColor || emptyForm.secondaryColor,
            accentColor: data.lab.accentColor || emptyForm.accentColor,
            enabledModules: data.lab.enabledModules?.length
              ? data.lab.enabledModules
              : emptyForm.enabledModules,
            loginHighlights: data.lab.loginHighlights || [],
          });
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadLab();

    return () => {
      cancelled = true;
    };
  }, [id]);

  function updateField(name, value) {
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
    setSuccess("");
  }

  function toggleModule(moduleId) {
    setForm((current) => {
      const selected = new Set(current.enabledModules);
      if (selected.has(moduleId)) {
        selected.delete(moduleId);
      } else {
        selected.add(moduleId);
      }

      selected.add("dashboard");

      return {
        ...current,
        enabledModules: availableLabModules
          .map((module) => module.id)
          .filter((module) => selected.has(module)),
      };
    });
    setSuccess("");
  }

  function toggleLoginHighlight(highlight) {
    setForm((current) => {
      const selected = new Set(current.loginHighlights);
      if (selected.has(highlight)) {
        selected.delete(highlight);
      } else {
        selected.add(highlight);
      }

      return {
        ...current,
        loginHighlights: [...selected].slice(0, 6),
      };
    });
    setSuccess("");
  }

  function addCustomHighlight() {
    const highlight = customHighlight.trim();
    if (!highlight) return;

    setForm((current) => {
      if (current.loginHighlights.includes(highlight)) return current;

      return {
        ...current,
        loginHighlights: [...current.loginHighlights, highlight].slice(0, 6),
      };
    });
    setCustomHighlight("");
    setSuccess("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!canSubmit) {
      setError("Please fix the highlighted fields before saving the lab.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        name: form.name.trim(),
        status: form.status,
        subscriptionPlan: form.subscriptionPlan,
        contactName: form.contactName.trim(),
        contactEmail: form.contactEmail.trim(),
        contactPhone: form.contactPhone.replace(/\D/g, ""),
        adminEmail: form.adminEmail.trim(),
        primaryColor: form.primaryColor,
        secondaryColor: form.secondaryColor,
        accentColor: form.accentColor,
        enabledModules: form.enabledModules,
        loginHighlights: form.loginHighlights,
      };

      if (form.adminPassword.trim()) {
        payload.adminPassword = form.adminPassword.trim();
        payload.adminPasswordConfirm = form.adminConfirmPassword.trim();
      }

      const response = await fetch(`/api/developer/labs/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await readResponseJson(response);

      if (!response.ok) {
        const message = [data.error, data.details].filter(Boolean).join(": ");
        throw new Error(message || `Unable to update lab (${response.status})`);
      }

      setForm((current) => ({
        ...current,
        ...data.lab,
        adminPassword: "",
        adminConfirmPassword: "",
      }));
      clearCachedApi("/api/developer/labs");
      clearCachedApi(`/api/developer/labs/${encodeURIComponent(id)}`);
      clearCachedApi(`/api/developer/labs/${data.lab.tenantId}/access`);
      setSuccess("Lab updated successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="developer-page">
      <div className="developer-page-actions">
        <div>
          <p className="developer-kicker">Lab Management</p>
          <h2>Edit Lab</h2>
          <span>Update lab profile, status, branding colors, and enabled modules.</span>
        </div>
        <Link className="developer-secondary-link" href="/developer/labs">
          {Icons.arrowLeft}
          Back To Labs
        </Link>
      </div>

      {error && <div className="developer-alert">{error}</div>}
      {success && <div className="developer-success">{success}</div>}

      {loading ? (
        <section className="developer-panel">
          <p className="developer-empty">Loading lab...</p>
        </section>
      ) : (
        <form
          className="developer-panel"
          onSubmit={handleSubmit}
          autoComplete="on"
          name="developer-edit-lab-form"
        >
          <div className="developer-panel-header">
            <h2>Lab Details</h2>
            <p>Tenant ID is locked so existing login URLs and tenant database mapping stay stable.</p>
          </div>

          <div className="developer-form-grid">
            <label>
              Lab Name
              <input
                className={formErrors.name ? "invalid" : ""}
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
                placeholder="Enter lab name"
                required
              />
              {formErrors.name && <em>{formErrors.name}</em>}
            </label>
            <label>
              Tenant ID
              <input value={form.tenantId} placeholder="Enter tenant ID" readOnly />
            </label>
            <label>
              Status
              <select value={form.status} onChange={(event) => updateField("status", event.target.value)}>
                <option value="pending">Pending</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <label>
              Plan
              <select
                value={form.subscriptionPlan}
                onChange={(event) => updateField("subscriptionPlan", event.target.value)}
              >
                <option value="trial">Trial</option>
                <option value="basic">Basic</option>
                <option value="professional">Professional</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </label>
            <label>
              Contact Name
              <input
                value={form.contactName}
                onChange={(event) => updateField("contactName", event.target.value)}
                placeholder="Enter contact name"
              />
            </label>
            <label>
              Contact Phone
              <input
                className={formErrors.contactPhone ? "invalid" : ""}
                inputMode="numeric"
                maxLength={10}
                value={form.contactPhone}
                onChange={(event) =>
                  updateField("contactPhone", event.target.value.replace(/\D/g, ""))
                }
                placeholder="Enter mobile number"
              />
              {formErrors.contactPhone && <em>{formErrors.contactPhone}</em>}
            </label>
            <label>
              Contact Email
              <input
                className={formErrors.contactEmail ? "invalid" : ""}
                type="email"
                name="developer-edit-lab-contact-email"
                value={form.contactEmail}
                onChange={(event) => updateField("contactEmail", event.target.value)}
                placeholder="Enter email"
                autoComplete="section-developer-edit-lab email"
              />
              {formErrors.contactEmail && <em>{formErrors.contactEmail}</em>}
            </label>
          </div>

          <div className="developer-module-picker">
            <div className="developer-panel-header">
              <h2>Lab Admin Login</h2>
              <p>Change the admin email or enter a new password only when credentials need updating.</p>
            </div>
            <div className="developer-form-grid">
              <label>
                Admin User ID
                <input
                  className={formErrors.adminEmail ? "invalid" : ""}
                  type="email"
                  name="developer-edit-lab-admin-email"
                  value={form.adminEmail}
                  onChange={(event) => updateField("adminEmail", event.target.value)}
                  placeholder="Enter admin email"
                  autoComplete="section-developer-edit-lab username"
                />
                {formErrors.adminEmail && <em>{formErrors.adminEmail}</em>}
              </label>
              <label>
                Admin Password
                <PasswordField
                  name="developer-edit-lab-admin-password"
                  value={form.adminPassword}
                  onChange={(event) => updateField("adminPassword", event.target.value)}
                  invalid={Boolean(formErrors.adminPassword)}
                  autoComplete="section-developer-edit-lab new-password"
                  placeholder="Enter new password"
                  toggleLabel="admin password"
                />
                {formErrors.adminPassword && <em>{formErrors.adminPassword}</em>}
              </label>
              <label>
                Confirm Password
                <PasswordField
                  name="developer-edit-lab-admin-confirm-password"
                  value={form.adminConfirmPassword}
                  onChange={(event) => updateField("adminConfirmPassword", event.target.value)}
                  invalid={Boolean(formErrors.adminConfirmPassword)}
                  autoComplete="section-developer-edit-lab new-password"
                  placeholder="Enter confirm password"
                  toggleLabel="confirm admin password"
                />
                {formErrors.adminConfirmPassword && <em>{formErrors.adminConfirmPassword}</em>}
              </label>
            </div>
          </div>

          <div className="developer-colors">
            <label>
              Primary
              <input
                type="color"
                value={form.primaryColor}
                onChange={(event) => updateField("primaryColor", event.target.value)}
              />
            </label>
            <label>
              Secondary
              <input
                type="color"
                value={form.secondaryColor}
                onChange={(event) => updateField("secondaryColor", event.target.value)}
              />
            </label>
            <label>
              Accent
              <input
                type="color"
                value={form.accentColor}
                onChange={(event) => updateField("accentColor", event.target.value)}
              />
            </label>
          </div>

          <div className="developer-module-picker">
            <div className="developer-panel-header">
              <h2>Lab Modules</h2>
              <p>Only selected modules appear in this lab after login.</p>
            </div>
            {formErrors.enabledModules && <div className="developer-alert">{formErrors.enabledModules}</div>}
            <div className="developer-module-grid">
              {availableLabModules.map((module) => (
                <label key={module.id} className="developer-module-option">
                  <input
                    type="checkbox"
                    checked={form.enabledModules.includes(module.id)}
                    disabled={module.id === "dashboard"}
                    onChange={() => toggleModule(module.id)}
                  />
                  <span>{module.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="developer-module-picker">
            <div className="developer-panel-header">
              <h2>Login Page Highlights</h2>
              <p>Optional lines shown below the lab name on the lab login page.</p>
            </div>
            <div className="developer-module-grid">
              {loginHighlightOptions.map((highlight) => (
                <label key={highlight} className="developer-module-option">
                  <input
                    type="checkbox"
                    checked={form.loginHighlights.includes(highlight)}
                    onChange={() => toggleLoginHighlight(highlight)}
                  />
                  <span>{highlight}</span>
                </label>
              ))}
            </div>
            <div className="developer-highlight-custom">
              <input
                value={customHighlight}
                onChange={(event) => setCustomHighlight(event.target.value)}
                placeholder="Enter login highlight"
                maxLength={80}
              />
              <button type="button" onClick={addCustomHighlight}>
                Add
              </button>
            </div>
            {form.loginHighlights.length > 0 && (
              <div className="developer-highlight-selected">
                {form.loginHighlights.map((highlight) => (
                  <button
                    key={highlight}
                    type="button"
                    onClick={() => toggleLoginHighlight(highlight)}
                  >
                    {highlight}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button type="submit" className="developer-submit" disabled={!canSubmit || saving}>
            {saving ? "Saving Lab..." : "Save Lab"}
          </button>
        </form>
      )}
    </section>
  );
}

