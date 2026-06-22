"use client";

export default function CategoriesTab({
  canEditTests,
  editingCategoryId,
  createCategory,
  categoryName,
  setCategoryName,
  saving,
  categories,
  categoryUsageCounts,
  showList = true,
}) {
  return (
    <div className="module-grid">
      {canEditTests && (
        <section className="module-panel">
          <div className="module-panel-header">
            <h2>{editingCategoryId ? "Edit Category" : "Create Category"}</h2>
            <p>Manage test departments.</p>
          </div>

          <form onSubmit={createCategory} className="module-form">
            <div className="module-form-grid">
              <label>
                Category Name
                <input
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  placeholder="Enter category name"
                  pattern="[A-Za-z][A-Za-z0-9 .&'\/,-]*"
                  title="Only letters, numbers, spaces, and . & ' / , - allowed"
                  required
                />
              </label>
            </div>
            <button type="submit" className="dash-btn-primary module-save" disabled={!categoryName || saving} style={{ marginTop: "24px" }}>
              {saving ? "Saving..." : editingCategoryId ? "Update Category" : "Create Category"}
            </button>
          </form>
        </section>
      )}

      {showList && (
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
              >
                <div>
                  <h3>{cat.name}</h3>
                  <span>Used in {categoryUsageCounts.get(cat._id) || 0} tests</span>
                </div>
              </article>
            ))}
          </div>
        </aside>
      )}
    </div>
  );
}
