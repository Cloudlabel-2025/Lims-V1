"use client";

import { Icons } from "@/app/components/Icons";
import dynamic from "next/dynamic";

const MultiSelect = dynamic(() => import("@/app/components/MultiSelect"), {
  ssr: false,
  loading: () => <div className="lims-input">Loading options...</div>,
});

export default function PackagesTab({
  canEditTests,
  packageForm,
  setPackageForm,
  savePackage,
  canSavePackage,
  saving,
  editingPackageId,
  selectedTestsTotal,
  packageTestOptions,
  packages,
  editPackage,
  showList = true,
  canDeleteTests = false,
  onDeletePackage = null,
}) {
  return (
    <div className="module-grid">
      {canEditTests && (
        <section className="module-panel">
          <div className="module-panel-header">
            <h2>{editingPackageId ? "Edit Package" : "Create Package"}</h2>
            <p>Bundle multiple tests together.</p>
          </div>

          <form onSubmit={savePackage} className="module-form">
            <div className="module-form-grid">
                <label>
                  Package Name
                  <input
                    value={packageForm.name}
                    onChange={(e) => setPackageForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Enter package name"
                    required
                    minLength={2}
                    maxLength={25}
                    pattern="[A-Za-z0-9\-]+"
                    title="Only letters, numbers, and hyphens allowed (max 25 characters, only one hyphen)"
                  />
                </label>
                <label>
                  Code
                  <input
                    value={packageForm.code}
                    onChange={(e) => setPackageForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                    placeholder="Enter package code"
                    required
                    maxLength={20}
                    pattern="[A-Z0-9]+"
                    title="Only uppercase letters and numbers allowed (max 20 characters)"
                  />
                </label>
              <label className="full-width">
                Description
                <textarea
                  value={packageForm.description}
                  onChange={(e) => setPackageForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Enter description"
                  maxLength={150}
                  style={{ width: "100%", height: "80px", padding: "10px", borderRadius: "var(--radius-sm)", border: "1.5px solid var(--border)", fontSize: "13.5px" }}
                />
              </label>
              <label>
                Package Price (₹)
                <div style={{ position: "relative" }}>
                  <input
                    type="number"
                    min="0"
                    max="99999999"
                    value={packageForm.price}
                    onChange={(e) => { const v = e.target.value; if (v.length <= 8) setPackageForm((p) => ({ ...p, price: v })); }}
                    placeholder="Enter price"
                    required
                    className="lims-input"
                  />
                  {packageForm.tests.length > 0 && (
                    <div style={{
                      position: "absolute",
                      right: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      fontSize: "11px",
                      color: "var(--text-muted)",
                      pointerEvents: "none"
                    }}>
                      Individual Sum: ₹{selectedTestsTotal}
                    </div>
                  )}
                </div>
              </label>
              <label>
                Status
                <select
                  value={packageForm.status}
                  onChange={(e) => setPackageForm((p) => ({ ...p, status: e.target.value }))}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
              <label className="full-width">
                Select Tests
                <MultiSelect
                  options={packageTestOptions}
                  value={packageForm.tests}
                  onChange={(e) => setPackageForm((p) => ({ ...p, tests: e.target.value }))}
                  placeholder="Search tests"
                />
              </label>
            </div>

            <button type="submit" className="dash-btn-primary module-save" disabled={!canSavePackage || saving} style={{ marginTop: "24px" }}>
              {saving ? "Saving..." : editingPackageId ? "Update Package" : "Create Package"}
            </button>
          </form>
        </section>
      )}

      {showList && (
        <aside className="module-panel">
          <div className="module-panel-header">
            <h2>Defined Packages</h2>
            <p>{packages.length} packages configured</p>
          </div>
          <div className="test-card-list">
            {packages.map((pkg) => (
              <article
                key={pkg._id}
                className={`test-card ${editingPackageId === pkg._id ? "active" : ""}`}
                onClick={() => {
                  if (canEditTests) editPackage(pkg);
                }}
              >
                <div>
                  <h3>{pkg.name}</h3>
                  <span>{pkg.tests?.length || 0} tests included · ₹{pkg.price}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <strong>{pkg.status}</strong>
                  {onDeletePackage && (
                    <button
                      type="button"
                      className="test-card-delete"
                      onClick={(e) => { e.stopPropagation(); onDeletePackage(pkg._id); }}
                      title="Delete package"
                    >
                      {Icons.trash}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </aside>
      )}
    </div>
  );
}
