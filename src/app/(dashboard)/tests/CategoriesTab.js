"use client";

import { Icons } from "@/app/components/Icons";

export default function CategoriesTab({
  canEditTests,
  editingCategoryId,
  saveCategory,
  categoryForm,
  setCategoryForm,
  saving,
  onCancelEdit,
  categories = [],
  categoryUsageCounts = new Map(),
  editCategory,
}) {
  return (
    <div className={`test-category-workspace ${canEditTests ? "" : "read-only"}`}>
      {canEditTests && (
        <section className="test-master-editor test-category-editor">
          <header className="test-master-panel-header">
            <div>
              <span>{editingCategoryId ? "Editing department" : "New department"}</span>
              <h2>{editingCategoryId ? "Update test category" : "Create test category"}</h2>
              <p>Organize tests into departments for faster ordering, reporting, and catalog maintenance.</p>
            </div>
          </header>
          <form onSubmit={saveCategory} className="test-category-form">
            <label>
              Category name
              <input value={categoryForm.name} onChange={(e) => setCategoryForm((current) => ({ ...current, name: e.target.value }))} placeholder="e.g. Haematology" pattern="[A-Za-z0-9\-]+" maxLength={25} required />
              <small>Use a short department name visible to all laboratory staff.</small>
            </label>
            <label>
              Description
              <textarea value={categoryForm.description} onChange={(e) => setCategoryForm((current) => ({ ...current, description: e.target.value }))} placeholder="Describe the tests grouped in this category" maxLength={300} rows={4} />
            </label>
            <label>
              Availability
              <select value={categoryForm.status} onChange={(e) => setCategoryForm((current) => ({ ...current, status: e.target.value }))}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <small>Inactive categories remain available for historical records.</small>
            </label>
            <footer>
              {editingCategoryId && <button type="button" className="btn-lims-secondary" onClick={onCancelEdit}>Cancel</button>}
              <button type="submit" className="dash-btn-primary" disabled={!categoryForm.name || saving}>{saving ? "Saving…" : editingCategoryId ? "Update category" : "Create category"}</button>
            </footer>
          </form>
        </section>
      )}

      <aside className="test-master-catalog-panel">
        <header className="test-master-panel-header">
          <div>
            <span>Department overview</span>
            <h2>Configured categories</h2>
            <p>{categories.length} categor{categories.length === 1 ? "y" : "ies"} available in the test catalog.</p>
          </div>
          <em>{categories.filter((category) => category.status === "active").length} active</em>
        </header>
        <div className="test-category-list">
          {categories.map((category) => (
            <article key={category._id} className={editingCategoryId === category._id ? "active" : ""}>
              <span className="test-category-icon">{Icons.grid}</span>
              <div>
                <strong>{category.name}</strong>
                <p>{category.description || "No category description provided."}</p>
                <small>{categoryUsageCounts.get(category._id) || 0} linked tests</small>
              </div>
              <em className={category.status}>{category.status}</em>
              {canEditTests && <button type="button" onClick={() => editCategory?.(category)} aria-label={`Edit ${category.name}`}>{Icons.edit}</button>}
            </article>
          ))}
          {!categories.length && (
            <div className="test-master-empty-state">
              <span>{Icons.grid}</span>
              <strong>No categories configured</strong>
              <p>Create the first department before defining laboratory tests.</p>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
