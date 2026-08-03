"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { availableLabModules } from "@/app/lib/modules";

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
  };
}

function PackageCard({ pkg, onEdit, onNewVersion }) {
  const currency = pkg.pricing?.currency || "INR";
  const monthlyPrice = formatPrice(pkg.pricing?.monthlyAmountMinor, currency);
  const annualPrice = formatPrice(pkg.pricing?.annualAmountMinor, currency);

  return (
    <article className="subscription-package-card">
      <header className="subscription-card-header">
        <div className="subscription-package-identity">
          <div className="subscription-badge-row">
            <span className="subscription-version-badge">Version {pkg.releaseVersion}</span>
            <span className="subscription-status-badge">{pkg.status}</span>
          </div>
          <h3>{pkg.name}</h3>
          <p>{pkg.description || "No package description has been added."}</p>
        </div>
        <button type="button" className="subscription-icon-button" onClick={() => onEdit(pkg)} aria-label={`Edit ${pkg.name}`}>
          Edit
        </button>
      </header>

      <div className={`subscription-price-grid ${monthlyPrice ? "" : "pricing-missing"}`}>
        <div>
          <span>Monthly price</span>
          <strong>{monthlyPrice || "Pricing required"}</strong>
          {!monthlyPrice && <small>Edit this package to set its monthly amount.</small>}
        </div>
        <div>
          <span>Annual price</span>
          <strong>{annualPrice || "Not offered"}</strong>
          <small>{annualPrice ? "Prepaid annual billing" : "Optional billing cycle"}</small>
        </div>
      </div>

      <div className="subscription-limit-grid" aria-label="Package usage limits">
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
          <span>Included modules</span>
          <small>{pkg.modules.length} enabled</small>
        </div>
        <div className="subscription-module-chips">
          {pkg.modules.map((moduleId) => (
            <span key={moduleId}>
              {availableLabModules.find((module) => module.id === moduleId)?.label || moduleId}
            </span>
          ))}
        </div>
      </div>

      <footer className="subscription-card-footer">
        <div>
          <strong>{pkg.labCount || 0}</strong>
          <span> active lab{pkg.labCount === 1 ? "" : "s"}</span>
        </div>
        <button type="button" onClick={() => onNewVersion(pkg)}>Create new version</button>
      </footer>
    </article>
  );
}

function PackageDrawer({ draft, setDraft, saving, mode, onClose, onSave }) {
  function toggleModule(moduleId) {
    if (moduleId === "dashboard") return;
    setDraft((current) => ({
      ...current,
      modules: current.modules.includes(moduleId)
        ? current.modules.filter((item) => item !== moduleId)
        : [...current.modules, moduleId],
    }));
  }

  return (
    <>
      <button className="subscription-drawer-backdrop" type="button" onClick={onClose} aria-label="Close package editor" />
      <aside className="subscription-drawer" aria-label="Package editor">
        <header className="subscription-drawer-header">
          <div>
            <span>{mode === "edit" ? "Edit package" : mode === "version" ? "New package version" : "New custom package"}</span>
            <h2>{draft.name || "Package details"}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close editor">Close</button>
        </header>

        <form id="subscription-package-form" onSubmit={onSave} className="subscription-drawer-form">
          <section className="subscription-form-section">
            <div className="subscription-form-heading">
              <span>1</span>
              <div><h3>Identity and release</h3><p>Each name and version is saved as an individual package.</p></div>
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
          </section>

          <section className="subscription-form-section">
            <div className="subscription-form-heading">
              <span>2</span>
              <div><h3>Commercial terms</h3><p>Monthly price is required. Annual billing remains optional.</p></div>
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
          </section>

          <section className="subscription-form-section">
            <div className="subscription-form-heading">
              <span>3</span>
              <div><h3>Included usage</h3><p>Leave a limit blank only when usage should be unlimited.</p></div>
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
          </section>

          <section className="subscription-form-section">
            <div className="subscription-form-heading">
              <span>4</span>
              <div><h3>Functional modules</h3><p>Dependencies are included automatically when saved.</p></div>
            </div>
            <div className="subscription-module-picker">
              {availableLabModules.map((module) => (
                <label key={module.id} className={module.id === "dashboard" ? "locked" : ""}>
                  <input type="checkbox" checked={module.id === "dashboard" || draft.modules.includes(module.id)} disabled={module.id === "dashboard"} onChange={() => toggleModule(module.id)} />
                  <span>{module.label}</span>
                </label>
              ))}
            </div>
          </section>
        </form>

        <footer className="subscription-drawer-footer">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" form="subscription-package-form" disabled={saving}>
            {saving ? "Saving package..." : mode === "edit" ? "Save package" : "Create package"}
          </button>
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
          <h2>Package Catalog</h2>
          <p>Manage each package release, price, allowance, and module access from one clear view.</p>
        </div>
        <button type="button" onClick={openCreate}>New custom package</button>
      </div>

      {error && <div className="developer-alert subscription-feedback">{error}</div>}
      {notice && <div className="subscription-notice subscription-feedback">{notice}</div>}

      <div className="subscription-summary-strip">
        <div><span>Package releases</span><strong>{summary.packageCount}</strong></div>
        <div><span>Priced packages</span><strong>{summary.pricedCount}</strong></div>
        <div><span>Custom packages</span><strong>{summary.customCount}</strong></div>
        <div><span>Assigned labs</span><strong>{summary.assignedLabs}</strong></div>
      </div>

      <section className="subscription-upgrade-requests">
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
      </section>

      {loading ? (
        <p className="developer-empty subscription-loading">Loading package catalog...</p>
      ) : packages.length === 0 ? (
        <div className="subscription-empty-state"><h3>No packages yet</h3><p>Create the first package release to begin.</p><button type="button" onClick={openCreate}>Create package</button></div>
      ) : (
        <div className="subscription-package-grid">
          {packages.map((pkg) => <PackageCard key={pkg.id} pkg={pkg} onEdit={openEdit} onNewVersion={openNewVersion} />)}
        </div>
      )}

      <section className="subscription-labs-panel">
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
      </section>

      {draft && <PackageDrawer draft={draft} setDraft={setDraft} saving={saving} mode={drawerMode} onClose={closeDrawer} onSave={savePackage} />}
    </section>
  );
}
