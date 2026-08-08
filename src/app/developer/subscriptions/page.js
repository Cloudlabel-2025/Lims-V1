"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { availableLabModules } from "@/app/lib/modules";
import { Icons } from "@/app/components/Icons";

const quotaFields = [
  { key: "patientRegistrations", label: "Patients", detail: "registrations / month" },
  { key: "billingRecords", label: "Bills", detail: "confirmed / month" },
  { key: "staffUsers", label: "Staff", detail: "active users" },
];

const currencies = ["INR", "USD", "AED", "GBP", "EUR"];

function amountInputFromMinor(value) {
  return value === null || value === undefined ? "" : (value / 100).toFixed(2);
}

function formatPrice(value, currency = "INR") {
  if (value === null || value === undefined) return null;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: value % 100 === 0 ? 0 : 2,
  }).format(value / 100);
}

function formatLimit(value) {
  return value === null || value === undefined ? "Unlimited" : Number(value).toLocaleString("en-IN");
}

function packageDraft(pkg = {}, { duplicate = false } = {}) {
  return {
    packageId: duplicate ? "" : pkg.id || "",
    expectedRevision: pkg.internalRevision || 1,
    name: pkg.name || "",
    releaseVersion: duplicate ? "" : pkg.releaseVersion || "",
    description: pkg.description || "",
    modules: pkg.modules?.length ? pkg.modules : ["dashboard"],
    features: pkg.features || [],
    quotas: {
      patientRegistrations: pkg.quotas?.patientRegistrations ?? "",
      billingRecords: pkg.quotas?.billingRecords ?? "",
      staffUsers: pkg.quotas?.staffUsers ?? "",
    },
    pricing: {
      currency: pkg.pricing?.currency || "INR",
      monthlyAmount: amountInputFromMinor(pkg.pricing?.monthlyAmountMinor),
      annualAmount: amountInputFromMinor(pkg.pricing?.annualAmountMinor),
    },
    addons: {
      patientRegistrations: {
        units: pkg.addons?.patientRegistrations?.units ?? 100,
        price: amountInputFromMinor(pkg.addons?.patientRegistrations?.priceMinor ?? 10000),
      },
      billingRecords: {
        units: pkg.addons?.billingRecords?.units ?? 250,
        price: amountInputFromMinor(pkg.addons?.billingRecords?.priceMinor ?? 12500),
      },
      staffUsers: {
        units: pkg.addons?.staffUsers?.units ?? 1,
        price: amountInputFromMinor(pkg.addons?.staffUsers?.priceMinor ?? 20000),
      },
    },
  };
}

function PackageCard({ pkg, onEdit, onNewVersion }) {
  const currency = pkg.pricing?.currency || "INR";
  const monthlyPrice = formatPrice(pkg.pricing?.monthlyAmountMinor, currency);
  const annualPrice = formatPrice(pkg.pricing?.annualAmountMinor, currency);
  const visibleModules = pkg.modules.slice(0, 5);
  const hiddenModuleCount = Math.max(0, pkg.modules.length - visibleModules.length);

  return (
    <article className="subscription-package-card">
      <header className="subscription-card-header">
        <div className="subscription-package-identity">
          <div className="subscription-package-title-row">
            <h3>{pkg.name}</h3>
            <span className="subscription-version-badge">Version {pkg.releaseVersion}</span>
          </div>
          <p>{pkg.description || "No package description has been added."}</p>
        </div>
        <div className="subscription-package-state-actions">
          <span className={`subscription-status-badge status-${pkg.status}`}>{pkg.status}</span>
          <button type="button" className="subscription-icon-button" onClick={() => onEdit(pkg)} aria-label={`Edit ${pkg.name}`}>{Icons.edit} Edit</button>
        </div>
      </header>

      <div className={`subscription-price-grid ${monthlyPrice ? "" : "pricing-missing"}`} aria-label="Package pricing">
        <div>
          <span>Monthly price</span>
          <strong>{monthlyPrice || "Pricing required"}</strong>
          <small>{monthlyPrice ? "Per laboratory workspace" : "Set an amount before assignment"}</small>
        </div>
        <div>
          <span>Annual price</span>
          <strong>{annualPrice || "Not offered"}</strong>
          <small>{annualPrice ? "Prepaid annual billing" : "Optional billing cycle"}</small>
        </div>
      </div>

      <div className="subscription-section-label subscription-allowance-heading">
        <span>Included allowances</span>
        <small>Per billing period</small>
      </div>
      <div className="subscription-limit-grid" aria-label="Package usage allowances">
        {quotaFields.map((field) => (
          <div key={field.key}>
            <span>{field.label}</span>
            <strong>{formatLimit(pkg.quotas[field.key])}</strong>
            <small>{field.detail}</small>
          </div>
        ))}
      </div>

      <div className="subscription-module-section">
        <div className="subscription-section-label">
          <span>Included modules &amp; features</span>
          <small>{pkg.modules.length} modules, {(pkg.features || []).length} features</small>
        </div>
        <div className="subscription-module-chips">
          {visibleModules.map((moduleId) => (
            <span key={moduleId}>
              {availableLabModules.find((module) => module.id === moduleId)?.label || moduleId}
            </span>
          ))}
          {hiddenModuleCount > 0 && <span className="more">+{hiddenModuleCount} more</span>}
          {((pkg.features || []).includes("record-deletion") || (pkg.features || []).includes("record-deletion:5min")) && (
            <span style={{ backgroundColor: "#fef3c7", color: "#92400e", fontWeight: 700 }}>
              ⏱️ 5m Deletion Window
            </span>
          )}
          {(pkg.features || []).includes("record-deletion:all") && (
            <span style={{ backgroundColor: "#dcfce7", color: "#166534", fontWeight: 700 }}>
              🔓 Full Delete (All Modules)
            </span>
          )}
        </div>
      </div>

      <footer className="subscription-card-footer">
        <div>
          <strong>{pkg.labCount || 0}</strong>
          <span> assigned lab{pkg.labCount === 1 ? "" : "s"}</span>
        </div>
        <button type="button" onClick={() => onNewVersion(pkg)}>{Icons.plus} New version</button>
      </footer>
    </article>
  );
}

function PackageDrawer({ draft, setDraft, saving, mode, onClose, onSave }) {
  const [activeStep, setActiveStep] = useState(1);
  const [editorError, setEditorError] = useState("");
  const steps = [
    { id: 1, label: "Identity", detail: "Name and release" },
    { id: 2, label: "Pricing", detail: "Commercial terms" },
    { id: 3, label: "Allowances", detail: "Usage limits" },
    { id: 4, label: "Modules", detail: "Feature access" },
  ];

  function toggleModule(moduleId) {
    if (moduleId === "dashboard") return;
    setDraft((current) => ({
      ...current,
      modules: current.modules.includes(moduleId)
        ? current.modules.filter((item) => item !== moduleId)
        : [...current.modules, moduleId],
    }));
  }

  const editorTitle = mode === "edit" ? "Edit package" : mode === "version" ? "Create package version" : "Create custom package";
  const monthlyPreview = draft.pricing.monthlyAmount
    ? `${draft.pricing.currency} ${Number(draft.pricing.monthlyAmount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "Not set";

  function validateStep(step) {
    if (step === 1) {
      if (!draft.name.trim()) return "Enter a package name before continuing.";
      if (!draft.releaseVersion.trim()) return "Enter a developer-controlled version before continuing.";
      if (!/^[A-Za-z0-9]+([._-][A-Za-z0-9]+)*$/.test(draft.releaseVersion.trim())) return "Use letters and numbers separated only by dots, underscores, or hyphens.";
    }
    if (step === 2 && (draft.pricing.monthlyAmount === "" || Number(draft.pricing.monthlyAmount) < 0)) {
      return "Set a valid monthly amount before continuing.";
    }
    if (step === 2 && draft.pricing.annualAmount !== "" && Number(draft.pricing.annualAmount) < 0) {
      return "Annual pricing cannot be negative.";
    }
    if (step === 3) {
      if (Object.values(draft.quotas).some((value) => value !== "" && (!Number.isInteger(Number(value)) || Number(value) < 0))) {
        return "Allowances must be whole numbers or left blank for unlimited usage.";
      }
      for (const key of ["patientRegistrations", "billingRecords", "staffUsers"]) {
        const addon = draft.addons?.[key] || {};
        if (addon.units === "" || addon.units === undefined || !Number.isInteger(Number(addon.units)) || Number(addon.units) <= 0) {
          return `Add-on pack size for ${key === "patientRegistrations" ? "Patients" : key === "billingRecords" ? "Bills" : "Staff"} must be a positive whole number.`;
        }
        if (addon.price === "" || addon.price === undefined || Number(addon.price) < 0) {
          return `Add-on price for ${key === "patientRegistrations" ? "Patients" : key === "billingRecords" ? "Bills" : "Staff"} must be a valid positive value.`;
        }
      }
    }
    return "";
  }

  function continueEditor() {
    const validationError = validateStep(activeStep);
    if (validationError) {
      setEditorError(validationError);
      return;
    }
    setEditorError("");
    setActiveStep((step) => Math.min(4, step + 1));
  }

  function submitEditor(event) {
    for (const step of [1, 2, 3]) {
      const validationError = validateStep(step);
      if (validationError) {
        event.preventDefault();
        setActiveStep(step);
        setEditorError(validationError);
        return;
      }
    }
    setEditorError("");
    onSave(event);
  }

  return (
    <>
      <button className="subscription-drawer-backdrop" type="button" onClick={onClose} aria-label="Close package editor" />
      <aside className="subscription-drawer subscription-package-editor" aria-label="Package editor" role="dialog" aria-modal="true">
        <header className="subscription-drawer-header">
          <div>
            <span>Subscription catalog</span>
            <h2>{editorTitle}</h2>
            <p>Configure one publishable package release.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close editor">{Icons.close}</button>
        </header>

        <div className="subscription-editor-layout">
          <aside className="subscription-editor-steps" aria-label="Package setup steps">
            <p>Package setup</p>
            {steps.map((step) => (
              <button key={step.id} type="button" className={`${activeStep === step.id ? "active" : ""} ${activeStep > step.id ? "complete" : ""}`} onClick={() => { setActiveStep(step.id); setEditorError(""); }}>
                <i>{activeStep > step.id ? "✓" : step.id}</i>
                <span><strong>{step.label}</strong><small>{step.detail}</small></span>
              </button>
            ))}
            <div className="subscription-editor-help">
              {Icons.shield}
              <span><strong>Safe publishing</strong><small>Existing laboratory entitlement snapshots remain unchanged.</small></span>
            </div>
          </aside>

          <div className="subscription-editor-workspace">
            <div className="subscription-editor-summary">
              <div><small>Package</small><strong>{draft.name || "Untitled package"}</strong></div>
              <div><small>Version</small><strong>{draft.releaseVersion || "Not set"}</strong></div>
              <div><small>Monthly price</small><strong>{monthlyPreview}</strong></div>
              <div><small>Modules</small><strong>{draft.modules.length} selected</strong></div>
            </div>
            {editorError && <div className="subscription-editor-error">{Icons.alertCircle} {editorError}</div>}

        <form id="subscription-package-form" onSubmit={submitEditor} className="subscription-drawer-form">
          {activeStep === 1 && <section className="subscription-form-section">
            <div className="subscription-form-heading">
              <span>1</span>
              <div><h3>Package identity</h3><p>Give this release a recognizable commercial name and developer-controlled version.</p></div>
            </div>
            <div className="subscription-form-grid">
              <label>
                Package name <em>*</em>
                <input required maxLength={80} value={draft.name} placeholder="Example: Silver" onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
              </label>
              <label>
                Version <em>*</em>
                <input required maxLength={30} pattern="[A-Za-z0-9]+([._-][A-Za-z0-9]+)*" value={draft.releaseVersion} placeholder="Example: 2.0" onChange={(event) => setDraft((current) => ({ ...current, releaseVersion: event.target.value }))} />
                <small>Set by the developer. Example: 1.0, 2.1, 2026-Q3.</small>
              </label>
              <label className="subscription-field-wide">
                Description
                <textarea maxLength={500} value={draft.description} placeholder="Explain who this package is designed for" onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} />
              </label>
            </div>
          </section>}

          {activeStep === 2 && <section className="subscription-form-section">
            <div className="subscription-form-heading">
              <span>2</span>
              <div><h3>Commercial pricing</h3><p>Monthly pricing is required. Annual pricing is an optional prepaid alternative.</p></div>
            </div>
            <div className="subscription-pricing-fields">
              <label>
                Currency
                <select value={draft.pricing.currency} onChange={(event) => setDraft((current) => ({ ...current, pricing: { ...current.pricing, currency: event.target.value } }))}>
                  {currencies.map((currency) => <option key={currency}>{currency}</option>)}
                </select>
              </label>
              <label>
                Monthly amount <em>*</em>
                <input required type="number" min="0" step="0.01" value={draft.pricing.monthlyAmount} placeholder="1999.00" onChange={(event) => setDraft((current) => ({ ...current, pricing: { ...current.pricing, monthlyAmount: event.target.value } }))} />
              </label>
              <label>
                Annual amount
                <input type="number" min="0" step="0.01" value={draft.pricing.annualAmount} placeholder="Optional" onChange={(event) => setDraft((current) => ({ ...current, pricing: { ...current.pricing, annualAmount: event.target.value } }))} />
              </label>
            </div>
            <div className="subscription-pricing-guidance">
              <strong>Pricing guidance</strong>
              <span>Enter customer-facing amounts in the selected currency. The system stores precise minor-unit values automatically.</span>
            </div>
          </section>}

          {activeStep === 3 && <section className="subscription-form-section">
            <div className="subscription-form-heading">
              <span>3</span>
              <div><h3>Included allowances</h3><p>Control monthly patient registration, billing generation, and staff capacity.</p></div>
            </div>
            <div className="subscription-quota-fields">
              {quotaFields.map((field) => (
                <label key={field.key}>
                  {field.label}
                  <input type="number" min="0" step="1" value={draft.quotas[field.key]} placeholder="Unlimited" onChange={(event) => setDraft((current) => ({ ...current, quotas: { ...current.quotas, [field.key]: event.target.value } }))} />
                  <small>{field.detail}</small>
                </label>
              ))}
            </div>
            <div className="subscription-quota-guidance">Leave a field blank only when that resource should be unlimited.</div>

            <div className="subscription-form-heading" style={{ marginTop: "24px" }}>
              <span>+</span>
              <div><h3>Capacity Add-ons</h3><p>Configure pack size and pricing for laboratories to purchase extra resources.</p></div>
            </div>
            <div className="subscription-quota-fields" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              {[
                { key: "patientRegistrations", label: "Patient Add-on" },
                { key: "billingRecords", label: "Billing Add-on" },
                { key: "staffUsers", label: "Staff Add-on" },
              ].map((field) => (
                <div key={field.key} style={{ gridColumn: "span 2", display: "flex", gap: "12px", border: "1px dashed #cbd5e1", padding: "12px", borderRadius: "8px", background: "#f8fafc" }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569" }}>{field.label} Pack Size</label>
                    <input 
                      type="number" min="1" step="1" required 
                      value={draft.addons?.[field.key]?.units ?? ""} 
                      style={{ marginTop: "4px" }}
                      onChange={(event) => setDraft((current) => ({
                        ...current,
                        addons: {
                          ...current.addons,
                          [field.key]: {
                            ...current.addons?.[field.key],
                            units: event.target.value
                          }
                        }
                      }))} 
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569" }}>{field.label} Pack Price ({draft.pricing.currency})</label>
                    <input 
                      type="number" min="0" step="0.01" required 
                      value={draft.addons?.[field.key]?.price ?? ""} 
                      style={{ marginTop: "4px" }}
                      onChange={(event) => setDraft((current) => ({
                        ...current,
                        addons: {
                          ...current.addons,
                          [field.key]: {
                            ...current.addons?.[field.key],
                            price: event.target.value
                          }
                        }
                      }))} 
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>}

          {activeStep === 4 && <section className="subscription-form-section">
            <div className="subscription-form-heading">
              <span>4</span>
              <div><h3>Modules &amp; Feature Entitlements</h3><p>Select functional modules and premium features included in this package.</p></div>
            </div>
            <div style={{ marginBottom: "16px" }}>
              <h4 style={{ fontSize: "13px", fontWeight: 700, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>Included Modules</h4>
              <div className="subscription-module-picker">
                {availableLabModules.map((module) => (
                  <label key={module.id} className={module.id === "dashboard" ? "locked" : ""}>
                    <input type="checkbox" checked={module.id === "dashboard" || draft.modules.includes(module.id)} disabled={module.id === "dashboard"} onChange={() => toggleModule(module.id)} />
                    <span>{module.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h4 style={{ fontSize: "13px", fontWeight: 700, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>Record Deletion Security &amp; Access Controls</h4>
              <div className="subscription-module-picker" style={{ gridTemplateColumns: "1fr", gap: "8px", marginBottom: "16px" }}>
                {[
                  { id: "record-deletion:5min", label: "⏱️ Standard 5-Minute Grace Window Delete Access (Default)" },
                  { id: "record-deletion:all", label: "🔓 Permanent Delete Access for ALL Modules (Purchased Upgrade)" },
                  { id: "record-deletion:patients", label: "🔒 Permanent Delete Access: Patients Module Only" },
                  { id: "record-deletion:accounts", label: "🔒 Permanent Delete Access: Accounts & Financials Only" },
                  { id: "record-deletion:doctors", label: "🔒 Permanent Delete Access: Doctors Module Only" },
                  { id: "record-deletion:billing", label: "🔒 Permanent Delete Access: Billing Module Only" },
                  { id: "record-deletion:reports", label: "🔒 Permanent Delete Access: Reports Module Only" },
                ].map((feat) => {
                  const isChecked = (draft.features || []).includes(feat.id);
                  return (
                    <label key={feat.id} style={{ display: "flex", alignItems: "center", gap: "8px", background: "#f8fafc", padding: "8px 12px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          setDraft((current) => {
                            const currentFeats = current.features || [];
                            return {
                              ...current,
                              features: isChecked
                                ? currentFeats.filter((f) => f !== feat.id)
                                : [...currentFeats, feat.id],
                            };
                          });
                        }}
                      />
                      <span style={{ fontSize: "13px", fontWeight: isChecked ? 700 : 500 }}>{feat.label}</span>
                    </label>
                  );
                })}
              </div>

              <h4 style={{ fontSize: "13px", fontWeight: 700, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>Platform Feature Add-ons</h4>
              <div className="subscription-module-picker">
                {[
                  { id: "patient-portal", label: "Patient Portal Access" },
                  { id: "doctor-portal", label: "Doctor Portal Access" },
                  { id: "corporate-accounts", label: "Corporate Accounts" },
                  { id: "doctor-commissions", label: "Doctor Commissions" },
                  { id: "custom-branding", label: "Custom Lab Branding" },
                  { id: "excel-export", label: "Excel Export" },
                  { id: "pdf-export", label: "PDF Export" },
                ].map((feat) => {
                  const isChecked = (draft.features || []).includes(feat.id);
                  return (
                    <label key={feat.id}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          setDraft((current) => {
                            const currentFeats = current.features || [];
                            return {
                              ...current,
                              features: isChecked
                                ? currentFeats.filter((f) => f !== feat.id)
                                : [...currentFeats, feat.id],
                            };
                          });
                        }}
                      />
                      <span>{feat.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </section>}
        </form>
          </div>
        </div>

        <footer className="subscription-drawer-footer">
          <button type="button" onClick={onClose}>Cancel</button>
          <div>
            {activeStep > 1 && <button type="button" onClick={() => setActiveStep((step) => Math.max(1, step - 1))}>{Icons.arrowLeft} Back</button>}
            {activeStep < 4 ? (
              <button type="button" className="primary" onClick={continueEditor}>Continue {Icons.arrowRight}</button>
            ) : (
              <button type="submit" className="primary" form="subscription-package-form" disabled={saving}>
                {saving ? "Saving package..." : mode === "edit" ? "Save package" : "Create package"}
              </button>
            )}
          </div>
        </footer>
      </aside>
    </>
  );
}

export default function DeveloperSubscriptionsPage() {
  const [packages, setPackages] = useState([]);
  const [labs, setLabs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState(null);
  const [drawerMode, setDrawerMode] = useState("");
  const [saving, setSaving] = useState(false);
  const [upgradeRequests, setUpgradeRequests] = useState([]);
  const [reviewingRequestId, setReviewingRequestId] = useState("");
  const [activeView, setActiveView] = useState("packages");
  const [packageQuery, setPackageQuery] = useState("");
  const [packageStatus, setPackageStatus] = useState("all");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [packagesResponse, labsResponse, upgradesResponse] = await Promise.all([
          fetch("/api/developer/subscription-packages", { credentials: "include", cache: "no-store" }),
          fetch("/api/developer/labs", { credentials: "include", cache: "no-store" }),
          fetch("/api/developer/subscription-upgrades", { credentials: "include", cache: "no-store" }),
        ]);
        const [packagesData, labsData, upgradesData] = await Promise.all([packagesResponse.json(), labsResponse.json(), upgradesResponse.json()]);
        if (!packagesResponse.ok) throw new Error(packagesData.error || "Unable to load packages");
        if (!labsResponse.ok) throw new Error(labsData.error || "Unable to load labs");
        if (!upgradesResponse.ok) throw new Error(upgradesData.error || "Unable to load upgrade requests");
        if (!cancelled) {
          setPackages(packagesData.packages || []);
          setLabs((labsData.labs || []).filter((lab) => lab.status === "active"));
          setUpgradeRequests(upgradesData.requests || []);
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const summary = useMemo(() => ({
    packageCount: packages.length,
    pricedCount: packages.filter((pkg) => pkg.pricing?.monthlyAmountMinor !== null && pkg.pricing?.monthlyAmountMinor !== undefined).length,
    customCount: packages.filter((pkg) => pkg.type === "custom").length,
    assignedLabs: packages.reduce((total, pkg) => total + (pkg.labCount || 0), 0),
  }), [packages]);

  const filteredPackages = useMemo(() => {
    const query = packageQuery.trim().toLowerCase();
    return packages.filter((pkg) => {
      const matchesQuery = !query || [pkg.name, pkg.releaseVersion, pkg.description]
        .some((value) => String(value || "").toLowerCase().includes(query));
      const matchesStatus = packageStatus === "all" || pkg.status === packageStatus;
      return matchesQuery && matchesStatus;
    });
  }, [packageQuery, packageStatus, packages]);

  function openCreate() {
    setDraft(packageDraft());
    setDrawerMode("create");
    setError("");
  }

  function openEdit(pkg) {
    setDraft(packageDraft(pkg));
    setDrawerMode("edit");
    setError("");
  }

  function openNewVersion(pkg) {
    setDraft(packageDraft(pkg, { duplicate: true }));
    setDrawerMode("version");
    setError("");
  }

  function closeDrawer() {
    if (saving) return;
    setDraft(null);
    setDrawerMode("");
  }

  async function savePackage(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const isEdit = drawerMode === "edit";
      const response = await fetch("/api/developer/subscription-packages", {
        method: isEdit ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save package");

      setPackages((current) => isEdit
        ? current.map((pkg) => pkg.id === data.package.id ? { ...data.package, labCount: pkg.labCount } : pkg)
        : [...current, data.package]);
      setNotice(`${data.package.name} version ${data.package.releaseVersion} was ${isEdit ? "updated" : "created"}.`);
      setDraft(null);
      setDrawerMode("");
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  async function reviewUpgrade(requestId, action) {
    setReviewingRequestId(requestId);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/developer/subscription-upgrades", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to review upgrade request");
      setUpgradeRequests((current) => current.filter((item) => item.id !== requestId));
      setNotice(payload.message);
    } catch (reviewError) {
      setError(reviewError.message);
    } finally {
      setReviewingRequestId("");
    }
  }

  return (
    <section className="developer-page subscription-page">
      <div className="subscription-page-header">
        <div>
          <p className="developer-kicker">Subscription Management</p>
          <h2>Catalog &amp; Billing Control</h2>
          <p>Configure commercial packages, review upgrade approvals, and monitor assigned laboratories.</p>
        </div>
        <button type="button" onClick={openCreate}>{Icons.plus} New package</button>
      </div>

      {error && <div className="developer-alert subscription-feedback">{error}</div>}
      {notice && <div className="subscription-notice subscription-feedback">{notice}</div>}

      <div className="subscription-summary-strip">
        <div><span>Package releases</span><strong>{summary.packageCount}</strong></div>
        <div><span>Priced packages</span><strong>{summary.pricedCount}</strong></div>
        <div><span>Custom packages</span><strong>{summary.customCount}</strong></div>
        <div><span>Assigned labs</span><strong>{summary.assignedLabs}</strong></div>
      </div>

      <nav className="subscription-workspace-tabs" aria-label="Subscription workspace views">
        <button type="button" className={activeView === "packages" ? "active" : ""} onClick={() => setActiveView("packages")}>
          Package catalog <span>{packages.length}</span>
        </button>
        <button type="button" className={activeView === "upgrades" ? "active" : ""} onClick={() => setActiveView("upgrades")}>
          Upgrade requests <span className={upgradeRequests.length ? "attention" : ""}>{upgradeRequests.length}</span>
        </button>
        <button type="button" className={activeView === "labs" ? "active" : ""} onClick={() => setActiveView("labs")}>
          Lab usage <span>{labs.length}</span>
        </button>
      </nav>

      {activeView === "upgrades" && <section className="subscription-upgrade-requests subscription-workspace-panel">
        <div className="subscription-labs-heading">
          <div><h2>Upgrade requests</h2><p>Approve a request to publish the selected Version 1 package to the lab.</p></div>
          <span>{upgradeRequests.length} pending</span>
        </div>
        {upgradeRequests.length === 0 ? <p className="developer-empty">No upgrade requests are waiting for review.</p> : (
          <div className="subscription-upgrade-request-list">
            {upgradeRequests.map((request) => (
              <article key={request.id}>
                <div>
                  <strong>{request.tenantId}</strong>
                  <span>{request.fromPackageName} → {request.toPackageName} · Version 1</span>
                  <small>Requested by {request.requestedByEmail || "Lab administrator"} on {new Date(request.requestedAt).toLocaleDateString("en-IN")}</small>
                </div>
                <div className="subscription-upgrade-request-actions">
                  <button type="button" className="reject" disabled={reviewingRequestId === request.id} onClick={() => reviewUpgrade(request.id, "reject")}>Reject</button>
                  <button type="button" disabled={reviewingRequestId === request.id} onClick={() => reviewUpgrade(request.id, "approve")}>{reviewingRequestId === request.id ? "Processing..." : "Approve"}</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>}

      {activeView === "packages" && <section className="subscription-catalog-workspace">
        <div className="subscription-catalog-toolbar">
          <div>
            <span className="subscription-toolbar-search-icon">{Icons.search}</span>
            <input value={packageQuery} onChange={(event) => setPackageQuery(event.target.value)} placeholder="Search package name, version, or description" aria-label="Search packages" />
          </div>
          <select value={packageStatus} onChange={(event) => setPackageStatus(event.target.value)} aria-label="Filter package status">
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="retired">Retired</option>
          </select>
          <span>{filteredPackages.length} shown</span>
        </div>
      {loading ? (
        <p className="developer-empty subscription-loading">Loading package catalog...</p>
      ) : packages.length === 0 ? (
        <div className="subscription-empty-state"><h3>No packages yet</h3><p>Create the first package release to begin.</p><button type="button" onClick={openCreate}>Create package</button></div>
      ) : filteredPackages.length === 0 ? (
        <div className="subscription-empty-state"><h3>No matching packages</h3><p>Change the search term or status filter.</p><button type="button" onClick={() => { setPackageQuery(""); setPackageStatus("all"); }}>Clear filters</button></div>
      ) : (
        <div className="subscription-package-grid">
          {filteredPackages.map((pkg) => <PackageCard key={pkg.id} pkg={pkg} onEdit={openEdit} onNewVersion={openNewVersion} />)}
        </div>
      )}
      </section>}

      {activeView === "labs" && <section className="subscription-labs-panel subscription-workspace-panel">
        <div className="subscription-labs-heading">
          <div><h2>Lab usage</h2><p>Open a lab to review its assigned entitlement snapshot and current consumption.</p></div>
          <Link href="/developer/labs">Manage labs</Link>
        </div>
        {labs.length === 0 ? <p className="developer-empty">No active labs are available.</p> : (
          <div className="subscription-lab-list">
            {labs.map((lab) => (
              <article key={lab.id}>
                <div><strong>{lab.name}</strong><span>{lab.tenantId} · {lab.subscriptionPackageName}{lab.subscriptionReleaseVersion ? ` ${lab.subscriptionReleaseVersion}` : ""}</span></div>
                <Link href={`/developer/labs/${encodeURIComponent(lab.tenantId)}/subscription`}>View usage</Link>
              </article>
            ))}
          </div>
        )}
      </section>}

      {draft && <PackageDrawer draft={draft} setDraft={setDraft} saving={saving} mode={drawerMode} onClose={closeDrawer} onSave={savePackage} />}
    </section>
  );
}
