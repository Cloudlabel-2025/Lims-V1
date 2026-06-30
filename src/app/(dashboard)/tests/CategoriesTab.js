"use client";

export default function CategoriesTab({
  canEditTests,
  editingCategoryId,
  saveCategory,
  categoryName,
  setCategoryName,
  saving,
  onCancelEdit,
}) {
  return (
    <div className="module-grid">
      {canEditTests && (
        <section className="module-panel">
          <div className="module-panel-header">
            <h2>{editingCategoryId ? "Edit Category" : "Create Category"}</h2>
            <p>Manage test departments. {editingCategoryId ? "Update the category name below." : ""}</p>
          </div>

          <form onSubmit={saveCategory} className="module-form">
            <div className="module-form-grid">
              <label>
                Category Name
                <input
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  placeholder="Enter category name"
                  pattern="[A-Za-z][A-Za-z0-9 .&'\/,-]*"
                  title="Only letters, numbers, spaces, and . & ' / , - allowed"
                  maxLength={50}
                  required
                />
              </label>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 24 }}>
              <button type="submit" className="dash-btn-primary module-save" disabled={!categoryName || saving}>
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
