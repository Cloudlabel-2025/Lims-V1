"use client";

import { useState, useMemo } from "react";
import { Icons } from "@/app/components/Icons";

const PAGE_SIZE = 20;

function PaginationControls({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", marginTop: "18px", flexWrap: "wrap" }}>
      <span style={{ color: "var(--text-muted)", fontSize: "13px", fontWeight: 600 }}>
        Page {page} of {totalPages}
      </span>
      <div style={{ display: "flex", gap: "8px" }}>
        <button type="button" className="btn-lims-secondary"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}>
          Previous
        </button>
        <button type="button" className="btn-lims-secondary"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}

function DeleteConfirmModal({ isOpen, onClose, onConfirm, label, type }) {
  if (!isOpen) return null;

  const titles = {
    category: "Delete Category?",
    test: "Delete Test?",
    package: "Delete Package?",
  };

  const messages = {
    category: `Are you sure you want to delete the category "<strong>{label}</strong>"? This action cannot be undone.`,
    test: `Are you sure you want to delete the test "<strong>{label}</strong>"? This action cannot be undone.`,
    package: `Are you sure you want to delete the package "<strong>{label}</strong>"? This action cannot be undone.`,
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "grid", placeItems: "center", zIndex: 1000 }}>
      <div className="form-card" style={{ padding: 24, borderRadius: 12, maxWidth: 420, width: "90%", display: "grid", gap: 16, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 28, color: "var(--error, #b91c1c)" }}>{Icons.trash}</div>
        <div>
          <h5 style={{ margin: 0, fontSize: 16 }}>{titles[type] || "Delete?"}</h5>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }} dangerouslySetInnerHTML={{ __html: messages[type]?.replace("{label}", label) || "" }} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn-lims-secondary" onClick={onClose} style={{ flex: 1, height: 38 }}>Cancel</button>
          <button type="button" className="btn-lims-primary" style={{ flex: 1, height: 38, background: "var(--error, #b91c1c)", borderColor: "var(--error, #b91c1c)" }} onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  );
}

export default function ListsTab({
  categories,
  categoryUsageCounts,
  tests,
  packages,
  canEditTests,
  editingId,
  editingPackageId,
  editTest,
  editPackage,
  canDeleteTests = false,
  onDeleteCategory = null,
  onDeleteTest = null,
  onDeletePackage = null,
  editCategory = null,
  editingCategoryId = "",
}) {
  const [activeListTab, setActiveListTab] = useState("categories");
  const [page, setPage] = useState({ categories: 1, tests: 1, packages: 1 });
  const [search, setSearch] = useState({ categories: "", tests: "", packages: "" });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteType, setDeleteType] = useState(null);

  const filteredCategories = useMemo(
    () => {
      const q = search.categories.toLowerCase();
      return q ? categories.filter((c) => c.name.toLowerCase().includes(q)) : categories;
    },
    [categories, search.categories]
  );
  const filteredTests = useMemo(
    () => {
      const q = search.tests.toLowerCase();
      return q ? tests.filter((t) => t.name.toLowerCase().includes(q)) : tests;
    },
    [tests, search.tests]
  );
  const filteredPackages = useMemo(
    () => {
      const q = search.packages.toLowerCase();
      return q ? packages.filter((p) => p.name.toLowerCase().includes(q)) : packages;
    },
    [packages, search.packages]
  );

  const paginatedCategories = useMemo(
    () => filteredCategories.slice((page.categories - 1) * PAGE_SIZE, page.categories * PAGE_SIZE),
    [filteredCategories, page.categories]
  );
  const paginatedTests = useMemo(
    () => filteredTests.slice((page.tests - 1) * PAGE_SIZE, page.tests * PAGE_SIZE),
    [filteredTests, page.tests]
  );
  const paginatedPackages = useMemo(
    () => filteredPackages.slice((page.packages - 1) * PAGE_SIZE, page.packages * PAGE_SIZE),
    [filteredPackages, page.packages]
  );

  const totalPages = {
    categories: Math.max(1, Math.ceil(filteredCategories.length / PAGE_SIZE)),
    tests: Math.max(1, Math.ceil(filteredTests.length / PAGE_SIZE)),
    packages: Math.max(1, Math.ceil(filteredPackages.length / PAGE_SIZE)),
  };

  const handleSearch = (tab, value) => {
    setSearch((prev) => ({ ...prev, [tab]: value }));
    setPage((prev) => ({ ...prev, [tab]: 1 }));
  };

  const handleDelete = (type, id, label) => {
    setDeleteTarget({ id, label });
    setDeleteType(type);
  };

  const confirmDelete = () => {
    if (!deleteTarget || !deleteType) return;
    if (deleteType === "category" && onDeleteCategory) onDeleteCategory(deleteTarget.id);
    if (deleteType === "test" && onDeleteTest) onDeleteTest(deleteTarget.id);
    if (deleteType === "package" && onDeletePackage) onDeletePackage(deleteTarget.id);
    setDeleteTarget(null);
    setDeleteType(null);
  };

  const tabStyle = (isActive) => ({
    padding: "12px 4px",
    background: "none",
    border: "none",
    borderBottom: isActive ? "2.5px solid var(--brand-action, var(--primary))" : "2.5px solid transparent",
    color: isActive ? "var(--brand-action, var(--primary))" : "var(--text-muted)",
    fontWeight: isActive ? "700" : "500",
    fontSize: "14px",
    cursor: "pointer",
    transition: "all 0.2s",
  });

  return (
    <div className="module-page">
      <div style={{ display: "flex", gap: "24px", marginBottom: "28px", borderBottom: "1px solid var(--border-light)", padding: "0 4px" }}>
        <button onClick={() => { setActiveListTab("categories"); setPage({ categories: 1, tests: 1, packages: 1 }); }} style={tabStyle(activeListTab === "categories")}>
          Categories List
        </button>
        <button onClick={() => { setActiveListTab("tests"); setPage({ categories: 1, tests: 1, packages: 1 }); }} style={tabStyle(activeListTab === "tests")}>
          Tests List
        </button>
        <button onClick={() => { setActiveListTab("packages"); setPage({ categories: 1, tests: 1, packages: 1 }); }} style={tabStyle(activeListTab === "packages")}>
          Packages List
        </button>
      </div>

      {activeListTab === "categories" && (
        <>
          <div className="list-toolbar">
            <input
              className="lims-input"
              placeholder="Search categories..."
              maxLength={35}
              value={search.categories}
              onChange={(e) => handleSearch("categories", e.target.value)}
            />
            <span className="list-count">{categories.length} categories</span>
          </div>
          <aside className="module-panel">
            <div className="list-table">
              {paginatedCategories.map((cat) => (
                <div
                  key={cat._id}
                  className={`list-row ${editingCategoryId === cat._id ? "active" : ""}`}
                  onClick={() => { if (editCategory) editCategory(cat); }}
                >
                  <div className="list-row-top">
                    <h3>{cat.name}</h3>
                    <div className="list-row-side">
                      <em className={cat.status}>{cat.status}</em>
                      {editCategory && (
                        <button type="button" className="btn-icon-edit" title="Edit category"
                          onClick={(e) => { e.stopPropagation(); editCategory(cat); }}>{Icons.edit}</button>
                      )}
                      {onDeleteCategory && (
                        <button type="button" className="btn-icon-delete" title="Delete category"
                          onClick={(e) => { e.stopPropagation(); handleDelete("category", cat._id, cat.name); }}>{Icons.trash}</button>
                      )}
                    </div>
                  </div>
                  {cat.description && <p className="list-desc">{cat.description}</p>}
                  <div className="list-meta">
                    <span className="list-meta-item"><strong>Used In:</strong> {categoryUsageCounts.get(cat._id) || 0} tests</span>
                  </div>
                </div>
              ))}
            </div>
            {!paginatedCategories.length && <p className="list-empty">No categories found.</p>}
          <PaginationControls page={page.categories} totalPages={totalPages.categories} onPageChange={(p) => setPage((prev) => ({ ...prev, categories: p }))} />
        </aside>
        </>
      )}

      {activeListTab === "tests" && (
        <>
          <div className="list-toolbar">
            <input
              className="lims-input"
              placeholder="Search tests..."
              maxLength={35}
              value={search.tests}
              onChange={(e) => handleSearch("tests", e.target.value)}
            />
            <span className="list-count">{tests.length} tests</span>
          </div>
          <aside className="module-panel">
            <div className="list-table">
              {paginatedTests.map((test) => (
                <div
                  key={test._id}
                  className={`list-row ${editingId === test._id ? "active" : ""}`}
                  onClick={() => { if (canEditTests) editTest(test); }}
                >
                  <div className="list-row-top">
                    <h3>{test.name}</h3>
                    <div className="list-row-side">
                      <em className={test.status}>{test.status}</em>
                      {canEditTests && (
                        <button type="button" className="btn-icon-edit" title="Edit test"
                          onClick={(e) => { e.stopPropagation(); editTest(test); }}>{Icons.edit}</button>
                      )}
                      {onDeleteTest && (
                        <button type="button" className="btn-icon-delete" title="Delete test"
                          onClick={(e) => { e.stopPropagation(); handleDelete("test", test._id, test.name); }}>{Icons.trash}</button>
                      )}
                    </div>
                  </div>
                  <div className="list-meta">
                    <span className="list-meta-item"><strong>Category:</strong> {test.category?.name || "Uncategorized"}</span>
                    <span className="list-meta-item"><strong>Sample:</strong> {test.sampleType || "—"}</span>
                    <span className="list-meta-item"><strong>Price:</strong> ₹{test.price ?? "—"}</span>
                    <span className="list-meta-item"><strong>Parameters:</strong> {test.parameters?.length || 0}</span>
                  </div>
                </div>
              ))}
            </div>
            {!paginatedTests.length && <p className="list-empty">No tests found.</p>}
          <PaginationControls page={page.tests} totalPages={totalPages.tests} onPageChange={(p) => setPage((prev) => ({ ...prev, tests: p }))} />
        </aside>
        </>
      )}

      {activeListTab === "packages" && (
        <>
          <div className="list-toolbar">
            <input
              className="lims-input"
              placeholder="Search packages..."
              maxLength={35}
              value={search.packages}
              onChange={(e) => handleSearch("packages", e.target.value)}
            />
            <span className="list-count">{packages.length} packages</span>
          </div>
          <aside className="module-panel">
            <div className="list-table">
              {paginatedPackages.map((pkg) => (
                <div
                  key={pkg._id}
                  className={`list-row ${editingPackageId === pkg._id ? "active" : ""}`}
                  onClick={() => { if (canEditTests) editPackage(pkg); }}
                >
                  <div className="list-row-top">
                    <h3>{pkg.name}{pkg.code ? <small>{pkg.code}</small> : null}</h3>
                    <div className="list-row-side">
                      <em className={pkg.status}>{pkg.status}</em>
                      {canEditTests && (
                        <button type="button" className="btn-icon-edit" title="Edit package"
                          onClick={(e) => { e.stopPropagation(); editPackage(pkg); }}>{Icons.edit}</button>
                      )}
                      {onDeletePackage && (
                        <button type="button" className="btn-icon-delete" title="Delete package"
                          onClick={(e) => { e.stopPropagation(); handleDelete("package", pkg._id, pkg.name); }}>{Icons.trash}</button>
                      )}
                    </div>
                  </div>
                  <div className="list-meta">
                    <span className="list-meta-item"><strong>Tests:</strong> {pkg.tests?.length || 0} included</span>
                    <span className="list-meta-item"><strong>Price:</strong> ₹{pkg.price}</span>
                  </div>
                </div>
              ))}
            </div>
            {!paginatedPackages.length && <p className="list-empty">No packages found.</p>}
          <PaginationControls page={page.packages} totalPages={totalPages.packages} onPageChange={(p) => setPage((prev) => ({ ...prev, packages: p }))} />
        </aside>
        </>
      )}

      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => { setDeleteTarget(null); setDeleteType(null); }}
        onConfirm={confirmDelete}
        label={deleteTarget?.label || ""}
        type={deleteType}
      />
    </div>
  );
}