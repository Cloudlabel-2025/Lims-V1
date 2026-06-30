"use client";

export default function CategoriesTab({
  canEditTests,
  editingCategoryId,
  saveCategory,
  categoryName,
  setCategoryName,
  saving,
  categories,
  categoryUsageCounts,
  showList = true,
  canDeleteTests = false,
  onDeleteCategory = null,
  onEditCategory = null,
  onCancelEdit = null,
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

      <aside className="module-panel">
        <div className="module-panel-header">
          <h2>Department Categories</h2>
          <p>{categories.length} categories available</p>
        </div>
        <div className="test-card-list">
          {categories.map((cat) => (
            <article
              key={cat._id}
              className={`test-card ${editingCategoryId === cat._id ? "active" : ""}`}
              onClick={() => { if (canEditTests && onEditCategory) onEditCategory(cat); }}
              style={{ cursor: canEditTests && onEditCategory ? "pointer" : "default" }}
            >
              <div>
                <h3>{cat.name}</h3>
                <span>Used in {categoryUsageCounts.get(cat._id) || 0} tests</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {canEditTests && onEditCategory && (
                  <button type="button" className="test-card-delete" onClick={(e) => { e.stopPropagation(); onEditCategory(cat); }} title="Edit category" style={{ fontSize: 13 }}>
                    ✏️
                  </button>
                )}
                {onDeleteCategory && (
                  <button
                    type="button"
                    className="test-card-delete"
                    onClick={(e) => { e.stopPropagation(); onDeleteCategory(cat._id); }}
                    title="Delete category"
                  >
                    🗑
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </aside>
    </div>
  );
}
