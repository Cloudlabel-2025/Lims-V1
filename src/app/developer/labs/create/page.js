"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { availableLabModules, defaultLabModules } from "@/app/lib/modules";
import { Icons } from "@/app/components/Icons";
import PasswordField from "@/app/components/PasswordField";
import { clearCachedApi } from "@/app/lib/use-current-user";

const defaultForm = {
  name: "",
  tenantId: "",
  subscriptionPlan: "trial",
  adminFirstName: "Lab",
  adminLastName: "Admin",
  adminEmail: "",
  adminPassword: "",
  adminConfirmPassword: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  logo: null,
  logoAltText: "",
  primaryColor: "#0d9488",
  secondaryColor: "#0f766e",
  accentColor: "#f59e0b",
  enabledModules: defaultLabModules,
  loginHighlights: [],
};

const wizardSteps = [
  { id: "details", title: "Lab Details" },
  { id: "modules", title: "Lab Modules" },
  { id: "highlights", title: "Login Page Highlights" },
  { id: "branding", title: "Login Branding" },
];

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

const logoUploadRules = {
  maxSizeBytes: 2 * 1024 * 1024,
  allowedTypes: new Set(["image/png", "image/jpeg", "image/webp"]),
};

function slugifyTenantId(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function isPhone(value) {
  const phone = String(value || "").trim();
  return !phone || /^\d{10}$/.test(phone);
}

function validateDeveloperForm(form) {
  const errors = {};

  if (!form.name.trim() || form.name.trim().length < 2) {
    errors.name = "Lab name must be at least 2 characters.";
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.tenantId)) {
    errors.tenantId = "Use lowercase letters, numbers, and hyphens only.";
  }

  if (form.contactEmail && !isEmail(form.contactEmail)) {
    errors.contactEmail = "Enter a valid contact email.";
  }

  if (!isPhone(form.contactPhone)) {
    errors.contactPhone = "Phone number must be exactly 10 digits.";
  }

  if (!form.adminFirstName.trim()) {
    errors.adminFirstName = "Admin first name is required.";
  }

  if (!form.adminLastName.trim()) {
    errors.adminLastName = "Admin last name is required.";
  }

  if (!isEmail(form.adminEmail)) {
    errors.adminEmail = "Enter a valid admin email.";
  }

  if (form.adminPassword.length < 8) {
    errors.adminPassword = "Password must be at least 8 characters.";
  }

  if (!form.adminConfirmPassword) {
    errors.adminConfirmPassword = "Confirm password is required.";
  } else if (form.adminPassword !== form.adminConfirmPassword) {
    errors.adminConfirmPassword = "Password and confirm password must match.";
  }

  return errors;
}

function validateLogoFile(file) {
  if (!file) return "";

  if (!logoUploadRules.allowedTypes.has(file.type)) {
    return "Logo must be a PNG, JPG, or WebP image.";
  }

  if (file.size > logoUploadRules.maxSizeBytes) {
    return "Logo image must be 2 MB or smaller.";
  }

  return "";
}

function getLocalLabLoginUrl(tenantId) {
  if (typeof window === "undefined") return "";

  const { hostname, port, protocol } = window.location;
  if (hostname !== "localhost" && hostname !== "127.0.0.1") return "";

  const host = port ? `${tenantId}.localhost:${port}` : `${tenantId}.localhost`;
  return `${protocol}//${host}/`;
}

function getActiveLabLoginUrl(lab, loginUrl) {
  return getLocalLabLoginUrl(lab.tenantId) || loginUrl;
}

export default function DeveloperCreateLabPage() {
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [createdLab, setCreatedLab] = useState(null);
  const [activeStep, setActiveStep] = useState(0);
  const [customHighlight, setCustomHighlight] = useState("");
  const [copiedLoginUrl, setCopiedLoginUrl] = useState("");
  const [logoFile, setLogoFile] = useState(null);
  const [logoInputTouched, setLogoInputTouched] = useState(false);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const formErrors = useMemo(() => validateDeveloperForm(form), [form]);
  const logoFileError = useMemo(() => validateLogoFile(logoFile), [logoFile]);
  const canSubmit = Object.keys(formErrors).length === 0 && !logoFileError;
  const stepId = wizardSteps[activeStep].id;
  const activeStepWarning = getStepWarning(activeStep);

  useEffect(() => {
    if (!logoFile || logoFileError) {
      setLogoPreviewUrl("");
      return undefined;
    }

    const objectUrl = URL.createObjectURL(logoFile);
    setLogoPreviewUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [logoFile, logoFileError]);

  function updateField(name, value) {
    setForm((current) => ({
      ...current,
      [name]: value,
      ...(name === "name" && !current.tenantId
        ? { tenantId: slugifyTenantId(value) }
        : {}),
    }));
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
          .filter((id) => selected.has(id)),
      };
    });
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
  }

  function getStepErrors(index = activeStep) {
    const id = wizardSteps[index].id;
    if (id === "details") {
      return [
        "name",
        "tenantId",
        "contactEmail",
        "contactPhone",
        "adminFirstName",
        "adminLastName",
        "adminEmail",
        "adminPassword",
        "adminConfirmPassword",
      ].filter((field) => formErrors[field]);
    }

    if (id === "branding") {
      return logoFileError ? ["logoFile"] : [];
    }

    return [];
  }

  function getStepWarning(index = activeStep) {
    const id = wizardSteps[index].id;

    if (id === "details" && getStepErrors(index).length > 0) {
      return "Complete the required lab, admin, email, and password fields before continuing.";
    }

    if (id === "branding" && logoFileError) {
      return "Fix the logo upload issue before continuing.";
    }

    return "";
  }

  function goToStep(index) {
    if (index <= activeStep) {
      setActiveStep(index);
      return;
    }

    const blockingStep = wizardSteps.findIndex((_, currentIndex) => {
      return currentIndex < index && getStepErrors(currentIndex).length > 0;
    });

    if (blockingStep >= 0) {
      setActiveStep(blockingStep);
      setError("");
      return;
    }

    setError("");
    setActiveStep(index);
  }

  function nextStep() {
    if (getStepErrors().length > 0) {
      if (stepId === "branding") setLogoInputTouched(true);
      setError("");
      return;
    }

    setError("");
    setActiveStep((current) => Math.min(current + 1, wizardSteps.length - 1));
  }

  function previousStep() {
    setError("");
    setActiveStep((current) => Math.max(current - 1, 0));
  }

  async function copyLoginUrl(loginUrl) {
    if (!loginUrl) return;

    try {
      await navigator.clipboard.writeText(loginUrl);
      setCopiedLoginUrl(loginUrl);
      window.setTimeout(() => {
        setCopiedLoginUrl((current) => (current === loginUrl ? "" : current));
      }, 1800);
    } catch {
      setError("Unable to copy login link. Please copy it manually.");
    }
  }

  function openLoginUrl(loginUrl) {
    window.open(loginUrl, "_blank", "noopener,noreferrer");
  }

  async function uploadLogoIfSelected() {
    if (!logoFile) return form.logo;

    const tenantId = form.tenantId.trim();
    const uploadForm = new FormData();
    uploadForm.append("file", logoFile);
    uploadForm.append("context", "lab-logo");
    uploadForm.append("tenantId", tenantId);

    setUploadingLogo(true);
    try {
      const response = await fetch("/api/uploads/image", {
        method: "POST",
        credentials: "include",
        body: uploadForm,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.details || data.error || "Unable to upload logo");
      }

      return {
        ...data.image,
        altText: form.logoAltText || `${form.name} logo`,
      };
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setCreatedLab(null);

    if (!canSubmit) {
      const firstInvalidStep = wizardSteps.findIndex((_, index) => getStepErrors(index).length > 0);
      if (firstInvalidStep >= 0) setActiveStep(firstInvalidStep);
      if (firstInvalidStep >= 0 && wizardSteps[firstInvalidStep].id === "branding") {
        setLogoInputTouched(true);
      }
      setError("");
      return;
    }

    setSaving(true);

    try {
      const logo = await uploadLogoIfSelected();
      const response = await fetch("/api/developer/labs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...form,
          logo,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.details || data.error || "Unable to create lab");
      }

      clearCachedApi("/api/developer/labs");
      setCreatedLab(data);
      setForm(defaultForm);
      setLogoFile(null);
      setCustomHighlight("");
      setLogoInputTouched(false);
      setActiveStep(0);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const activeCreatedUrl = createdLab
    ? getActiveLabLoginUrl(createdLab.lab, createdLab.loginUrl)
    : "";

  return (
    <section className="developer-page">
      <div className="developer-page-actions">
        <div>
          <p className="developer-kicker">Lab Management</p>
          <h2>Create Lab</h2>
          <span>Create tenant metadata, initialize tenant DB, and create the first lab admin.</span>
        </div>
        <Link className="developer-secondary-link" href="/developer/labs">
          {Icons.list}
          View Lab List
        </Link>
      </div>

      {error && <div className="developer-alert">{error}</div>}

      {createdLab && (
        <section className="developer-success">
          <div>
            <strong>{createdLab.lab.name}</strong> is ready.
            <span> Lab admin: {createdLab.admin.email}</span>
            <button
              type="button"
              className="developer-url-link"
              onClick={() => openLoginUrl(activeCreatedUrl)}
            >
              {activeCreatedUrl}
            </button>
            {getLocalLabLoginUrl(createdLab.lab.tenantId) && (
              <small className="developer-production-url">Production: {createdLab.loginUrl}</small>
            )}
          </div>
          <div className="developer-link-actions">
            <button type="button" onClick={() => openLoginUrl(activeCreatedUrl)}>
              Open
            </button>
            <button type="button" onClick={() => copyLoginUrl(activeCreatedUrl)}>
              {copiedLoginUrl === activeCreatedUrl ? "Copied" : "Copy Link"}
            </button>
          </div>
        </section>
      )}

      <form
        className="developer-panel"
        onSubmit={(e) => e.preventDefault()}
        autoComplete="on"
        name="developer-create-lab-form"
      >
        <div className="developer-wizard-steps" aria-label="Create lab steps">
          {wizardSteps.map((step, index) => (
            <button
              key={step.id}
              type="button"
              className={index === activeStep ? "active" : ""}
              onClick={() => goToStep(index)}
            >
              <span>{index + 1}</span>
              {step.title}
            </button>
          ))}
        </div>

        {stepId === "details" && (
          <>
            <div className="developer-panel-header">
              <h2>Lab Details</h2>
              <p>Tenant ID becomes the lab subdomain or local lab login identifier.</p>
            </div>
            {activeStepWarning && <div className="developer-step-warning">{activeStepWarning}</div>}

            <div className="developer-form-grid">
          <label>
            Lab Name
            <input
              className={formErrors.name ? "invalid" : ""}
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="Enter lab name"
              required
            />
            {formErrors.name && <em>{formErrors.name}</em>}
          </label>
          <label>
            Tenant ID
            <input
              className={formErrors.tenantId ? "invalid" : ""}
              value={form.tenantId}
              onChange={(e) => updateField("tenantId", slugifyTenantId(e.target.value))}
              placeholder="Enter tenant ID"
              required
            />
            {formErrors.tenantId && <em>{formErrors.tenantId}</em>}
          </label>
          <label>
            Plan
            <select
              value={form.subscriptionPlan}
              onChange={(e) => updateField("subscriptionPlan", e.target.value)}
            >
              <option value="trial">Trial</option>
              <option value="basic">Basic</option>
              <option value="professional">Professional</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </label>
          <label>
            Contact Phone
            <input
              className={formErrors.contactPhone ? "invalid" : ""}
              inputMode="numeric"
              maxLength={10}
              value={form.contactPhone}
              onChange={(e) => updateField("contactPhone", e.target.value.replace(/\D/g, ""))}
              placeholder="Enter mobile number"
            />
            {formErrors.contactPhone && <em>{formErrors.contactPhone}</em>}
          </label>
          <label>
            Contact Email
            <input
              className={formErrors.contactEmail ? "invalid" : ""}
              type="email"
              name="developer-create-lab-contact-email"
              value={form.contactEmail}
              onChange={(e) => updateField("contactEmail", e.target.value)}
              placeholder="Enter email"
              autoComplete="section-developer-create-lab email"
            />
            {formErrors.contactEmail && <em>{formErrors.contactEmail}</em>}
          </label>
          <label>
            Admin First Name
            <input
              className={formErrors.adminFirstName ? "invalid" : ""}
              value={form.adminFirstName}
              onChange={(e) => updateField("adminFirstName", e.target.value)}
              required
            />
            {formErrors.adminFirstName && <em>{formErrors.adminFirstName}</em>}
          </label>
          <label>
            Admin Last Name
            <input
              className={formErrors.adminLastName ? "invalid" : ""}
              value={form.adminLastName}
              onChange={(e) => updateField("adminLastName", e.target.value)}
              required
            />
            {formErrors.adminLastName && <em>{formErrors.adminLastName}</em>}
          </label>
          <label>
            Admin Email
            <input
              className={formErrors.adminEmail ? "invalid" : ""}
              type="email"
              name="developer-create-lab-admin-email"
              value={form.adminEmail}
              onChange={(e) => updateField("adminEmail", e.target.value)}
              placeholder="Enter admin email"
              autoComplete="section-developer-create-lab username"
              required
            />
            {formErrors.adminEmail && <em>{formErrors.adminEmail}</em>}
          </label>
          <label>
            Admin Password
            <PasswordField
              name="developer-create-lab-admin-password"
              value={form.adminPassword}
              onChange={(e) => updateField("adminPassword", e.target.value)}
              invalid={Boolean(formErrors.adminPassword)}
              autoComplete="section-developer-create-lab new-password"
              toggleLabel="admin password"
              minLength={8}
              required
            />
            {formErrors.adminPassword && <em>{formErrors.adminPassword}</em>}
          </label>
          <label>
            Confirm Password
            <PasswordField
              name="developer-create-lab-admin-confirm-password"
              value={form.adminConfirmPassword}
              onChange={(e) => updateField("adminConfirmPassword", e.target.value)}
              invalid={Boolean(formErrors.adminConfirmPassword)}
              autoComplete="section-developer-create-lab new-password"
              toggleLabel="confirm admin password"
              minLength={8}
              required
            />
            {formErrors.adminConfirmPassword && <em>{formErrors.adminConfirmPassword}</em>}
          </label>
            </div>
          </>
        )}

        {stepId === "modules" && (
          <div className="developer-module-picker flush">
            <div className="developer-panel-header">
              <h2>Lab Modules</h2>
              <p>Only selected modules appear in this lab after login.</p>
            </div>
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
        )}

        {stepId === "highlights" && (
          <div className="developer-module-picker flush">
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
                onChange={(e) => setCustomHighlight(e.target.value)}
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
        )}

        {stepId === "branding" && (
          <>
            <div className="developer-branding-fields flush">
              <div className="developer-panel-header">
                <h2>Login Branding</h2>
                <p>Upload a lab logo to Cloudinary. Only the Cloudinary URL and public ID are saved.</p>
              </div>
              {activeStepWarning && <div className="developer-step-warning">{activeStepWarning}</div>}
              <div className="developer-form-grid">
                <label>
                  Logo Image
                  <input
                    className={logoFileError && logoInputTouched ? "invalid" : ""}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => {
                      setLogoInputTouched(true);
                      setLogoFile(e.target.files?.[0] || null);
                    }}
                  />
                  <small>PNG, JPG, or WebP. Maximum 2 MB.</small>
                  {logoFileError && logoInputTouched && <em>{logoFileError}</em>}
                </label>
                <label>
                  Logo Alt Text
                  <input
                    value={form.logoAltText}
                    onChange={(e) => updateField("logoAltText", e.target.value)}
                    placeholder="Enter logo alt text"
                    maxLength={120}
                  />
                </label>
              </div>
              {logoPreviewUrl && (
                <div
                  className="developer-logo-preview"
                  role="img"
                  aria-label={form.logoAltText || `${form.name || "Lab"} logo`}
                  style={{ backgroundImage: `url("${logoPreviewUrl}")` }}
                />
              )}
            </div>

            <div className="developer-colors">
              <label>
                Primary
                <input
                  type="color"
                  value={form.primaryColor}
                  onChange={(e) => updateField("primaryColor", e.target.value)}
                />
              </label>
              <label>
                Secondary
                <input
                  type="color"
                  value={form.secondaryColor}
                  onChange={(e) => updateField("secondaryColor", e.target.value)}
                />
              </label>
              <label>
                Accent
                <input
                  type="color"
                  value={form.accentColor}
                  onChange={(e) => updateField("accentColor", e.target.value)}
                />
              </label>
            </div>
          </>
        )}

        <div className="developer-wizard-actions">
          <button type="button" onClick={previousStep} disabled={activeStep === 0 || saving || uploadingLogo}>
            Back
          </button>
          {activeStep < wizardSteps.length - 1 ? (
            <button type="button" className="developer-submit" onClick={nextStep}>
              Next
            </button>
          ) : (
            <button type="button" className="developer-submit" onClick={handleSubmit} disabled={!canSubmit || saving || uploadingLogo}>
              {uploadingLogo ? "Uploading Logo..." : saving ? "Creating Lab..." : "Create Lab And Admin"}
            </button>
          )}
        </div>
      </form>
    </section>
  );
}

