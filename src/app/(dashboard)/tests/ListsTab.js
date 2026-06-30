"use client";

import { useState, useMemo } from "react";

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
}) {
  const [activeListTab, setActiveListTab] = useState("categories");
  const [page, setPage] = useState({ categories: 1, tests: 1, packages: 1 });

  const paginatedCategories = useMemo(
    () => categories.slice((page.categories - 1) * PAGE_SIZE, page.categories * PAGE_SIZE),
    [categories, page.categories]
  );
  const paginatedTests = useMemo(
    () => tests.slice((page.tests - 1) * PAGE_SIZE, page.tests * PAGE_SIZE),
    [tests, page.tests]
  );
  const paginatedPackages = useMemo(
    () => packages.slice((page.packages - 1) * PAGE_SIZE, page.packages * PAGE_SIZE),
    [packages, page.packages]
  );

  const totalPages = {
    categories: Math.max(1, Math.ceil(categories.length / PAGE_SIZE)),
    tests: Math.max(1, Math.ceil(tests.length / PAGE_SIZE)),
    packages: Math.max(1, Math.ceil(packages.length / PAGE_SIZE)),
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
      <div className="module-header">
        <div>
          <p className="module-kicker">View Lists</p>
          <h1>Test Master Records</h1>
          <span>Browse all created categories, tests, and packages.</span>
        </div>
      </div>

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
        <aside className="module-panel">
          <div className="module-panel-header">
            <h2>Department Categories</h2>
            <p>{categories.length} categories available</p>
          </div>
          <div className="test-card-list">
            {paginatedCategories.map((cat) => (
              <article key={cat._id} className="test-card">
                <div>
                  <h3>{cat.name}</h3>
                  <span>Used in {categoryUsageCounts.get(cat._id) || 0} tests</span>
                </div>
                {onDeleteCategory && (
                  <button type="button" className="test-card-delete" onClick={() => onDeleteCategory(cat._id)} title="Delete category">🗑</button>
                )}
              </article>
            ))}
          </div>
          <PaginationControls page={page.categories} totalPages={totalPages.categories} onPageChange={(p) => setPage((prev) => ({ ...prev, categories: p }))} />
        </aside>
      )}

      {activeListTab === "tests" && (
        <aside className="module-panel">
          <div className="module-panel-header">
            <h2>Defined Tests</h2>
            <p>{tests.length} tests configured</p>
          </div>
          <div className="test-card-list">
            {paginatedTests.map((test) => (
              <article
                key={test._id}
                className={`test-card ${editingId === test._id ? 'active' : ''}`}
                onClick={() => { if (canEditTests) editTest(test); }}
              >
                <div>
                  <h3>{test.name}</h3>
                  <span>{test.category?.name || "Uncategorized"} · {test.parameters?.length || 0} parameters</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <strong>{test.status}</strong>
                  {onDeleteTest && (
                    <button type="button" className="test-card-delete" onClick={(e) => { e.stopPropagation(); onDeleteTest(test._id); }} title="Delete test">🗑</button>
                  )}
                </div>
              </article>
            ))}
          </div>
          <PaginationControls page={page.tests} totalPages={totalPages.tests} onPageChange={(p) => setPage((prev) => ({ ...prev, tests: p }))} />
        </aside>
      )}

      {activeListTab === "packages" && (
        <aside className="module-panel">
          <div className="module-panel-header">
            <h2>Defined Packages</h2>
            <p>{packages.length} packages configured</p>
          </div>
          <div className="test-card-list">
            {paginatedPackages.map((pkg) => (
              <article
                key={pkg._id}
                className={`test-card ${editingPackageId === pkg._id ? 'active' : ''}`}
                onClick={() => { if (canEditTests) editPackage(pkg); }}
              >
                <div>
                  <h3>{pkg.name}</h3>
                  <span>{pkg.tests?.length || 0} tests included · ₹{pkg.price}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <strong>{pkg.status}</strong>
                  {onDeletePackage && (
                    <button type="button" className="test-card-delete" onClick={(e) => { e.stopPropagation(); onDeletePackage(pkg._id); }} title="Delete package">🗑</button>
                  )}
                </div>
              </article>
            ))}
          </div>
          <PaginationControls page={page.packages} totalPages={totalPages.packages} onPageChange={(p) => setPage((prev) => ({ ...prev, packages: p }))} />
        </aside>
      )}
    </div>
  );
}
