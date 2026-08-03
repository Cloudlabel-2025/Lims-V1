"use client";

import dynamic from "next/dynamic";
import { Icons } from "@/app/components/Icons";

const MultiSelect = dynamic(() => import("@/app/components/MultiSelect"), {
  ssr: false,
  loading: () => <div className="test-master-select-loading">Loading test catalog…</div>,
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
  canDeleteTests = false,
  onDeletePackage = null,
  onCancelEdit,
}) {
  const activePackages = packages.filter((pkg) => pkg.status === "active").length;

  return (
    <div className={`test-package-workspace ${canEditTests ? "" : "read-only"}`}>
      {canEditTests && (
        <section className="test-master-editor test-package-editor">
          <header className="test-master-panel-header">
            <div>
              <span>{editingPackageId ? "Editing package" : "New health package"}</span>
              <h2>{editingPackageId ? packageForm.name || "Update package" : "Create test package"}</h2>
              <p>Bundle frequently ordered tests with a clear package price and availability state.</p>
            </div>
          </header>

          <form onSubmit={savePackage} className="test-package-form">
            <div className="test-editor-field-grid">
              <label>
                Package name
                <input value={packageForm.name} onChange={(e) => setPackageForm((current) => ({ ...current, name: e.target.value }))} placeholder="e.g. Executive-Health" required minLength={2} maxLength={25} pattern="[A-Za-z0-9\-]+" />
              </label>
              <label>
                Package code
                <input value={packageForm.code} onChange={(e) => setPackageForm((current) => ({ ...current, code: e.target.value.toUpperCase() }))} placeholder="e.g. EHC01" required maxLength={20} pattern="[A-Z0-9]+" />
              </label>
              <label>
                Package price (₹)
                <input type="number" min="0" max="99999999" value={packageForm.price} onChange={(e) => { const value = e.target.value; if (value.length <= 8) setPackageForm((current) => ({ ...current, price: value })); }} placeholder="0.00" required />
                {packageForm.tests.length > 0 && <small>Individual test total: ₹{selectedTestsTotal}</small>}
              </label>
              <label>
                Availability
                <select value={packageForm.status} onChange={(e) => setPackageForm((current) => ({ ...current, status: e.target.value }))}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
              <label className="span-two">
                Description
                <textarea value={packageForm.description} onChange={(e) => setPackageForm((current) => ({ ...current, description: e.target.value }))} placeholder="Explain who this package is designed for" maxLength={150} rows={3} />
              </label>
              <label className="span-two">
                Included tests
                <MultiSelect options={packageTestOptions} value={packageForm.tests} onChange={(e) => setPackageForm((current) => ({ ...current, tests: e.target.value }))} placeholder="Search and select tests" />
                <small>{packageForm.tests.length} test{packageForm.tests.length === 1 ? "" : "s"} selected</small>
              </label>
            </div>
            <footer className="test-package-actions">
              {editingPackageId && <button type="button" className="btn-lims-secondary" onClick={onCancelEdit}>Cancel editing</button>}
              <button type="submit" className="dash-btn-primary" disabled={!canSavePackage || saving}>{saving ? "Saving…" : editingPackageId ? "Update package" : "Create package"}</button>
            </footer>
          </form>
        </section>
      )}

      <aside className="test-master-catalog-panel">
        <header className="test-master-panel-header">
          <div>
            <span>Package catalog</span>
            <h2>Configured packages</h2>
            <p>{packages.length} total packages with {activePackages} currently available.</p>
          </div>
          <em>{activePackages} active</em>
        </header>
        <div className="test-package-list">
          {packages.map((pkg) => (
            <article key={pkg._id} className={editingPackageId === pkg._id ? "active" : ""}>
              <header>
                <div><strong>{pkg.name}</strong><code>{pkg.code || "NO CODE"}</code></div>
                <em className={pkg.status}>{pkg.status}</em>
              </header>
              <p>{pkg.description || "No package description provided."}</p>
              <dl>
                <div><dt>Included tests</dt><dd>{pkg.tests?.length || 0}</dd></div>
                <div><dt>Package price</dt><dd>₹{pkg.price}</dd></div>
              </dl>
              {(canEditTests || (canDeleteTests && onDeletePackage)) && (
                <footer>
                  {canEditTests && <button type="button" onClick={() => editPackage(pkg)}>{Icons.edit} Edit package</button>}
                  {canDeleteTests && onDeletePackage && <button type="button" className="danger" onClick={() => onDeletePackage(pkg._id)}>{Icons.trash} Delete</button>}
                </footer>
              )}
            </article>
          ))}
          {!packages.length && <div className="test-master-empty-state"><span>{Icons.list}</span><strong>No packages configured</strong><p>Create a package after active tests have been added.</p></div>}
        </div>
      </aside>
    </div>
  );
}
