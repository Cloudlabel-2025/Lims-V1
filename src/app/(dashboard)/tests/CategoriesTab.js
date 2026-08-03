"use client";

export default function CategoriesTab({
  canEditTests,
  editingCategoryId,
  saveCategory,
  categoryForm,
  setCategoryForm,
  saving,
  onCancelEdit,
}) {
  return (
    <div className="module-grid single-col">
      {canEditTests && (
        <section className="module-panel">
          <div className="module-panel-header">
            <h2>{editingCategoryId ? "Edit Category" : "Create Category"}</h2>
            <p>Manage test departments. {editingCategoryId ? "Update the category details below." : ""}</p>
          </div>

          <form onSubmit={saveCategory} className="module-form">
            <div className="module-form-grid cols-3">
              <label>
                Category Name
                <input
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Enter category name"
                  pattern="[A-Za-z0-9\-]+"
                  title="Only letters, numbers, and hyphens allowed (max 25 characters)"
                  maxLength={25}
                  required
                />
              </label>
              <label>
                Description
                <textarea
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Enter description"
                  maxLength={300}
                  rows={2}
                />
              </label>
              <label>
                Status
                <select
                  value={categoryForm.status}
                  onChange={(e) => setCategoryForm((p) => ({ ...p, status: e.target.value }))}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 24 }}>
              <button type="submit" className="dash-btn-primary module-save" disabled={!categoryForm.name || saving}>
                {saving ? "Saving..." : editingCategoryId ? "Update Category" : "Create Category"}
              </button>
              {editingCategoryId && (
                <button type="button" className="dash-btn-secondary" onClick={() => { if (onCancelEdit) onCancelEdit(); }}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
