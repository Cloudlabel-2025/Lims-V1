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
  const [search, setSearch] = useState({ categories: "", tests: "", packages: "" });

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
          <div style={{ marginBottom: 12 }}>
            <input
              className="lims-input"
              placeholder="Search categories..."
              maxLength={35}
              value={search.categories}
              onChange={(e) => handleSearch("categories", e.target.value)}
              style={{ height: 34, fontSize: 13, paddingLeft: 10 }}
            />
          </div>
          <div className="test-card-list">
            {paginatedCategories.map((cat) => (
              <article key={cat._id} className="test-card">
                <div>
                  <h3>{cat.name}</h3>
                  <span>Used in {categoryUsageCounts.get(cat._id) || 0} tests</span>
                </div>
                {onDeleteCategory && (
                  <button type="button" className="test-card-delete" onClick={() => onDeleteCategory(cat._id)} title="Delete category">{Icons.trash}</button>
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
          <div style={{ marginBottom: 12 }}>
            <input
              className="lims-input"
              placeholder="Search tests..."
              maxLength={35}
              value={search.tests}
              onChange={(e) => handleSearch("tests", e.target.value)}
              style={{ height: 34, fontSize: 13, paddingLeft: 10 }}
            />
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
                    <button type="button" className="test-card-delete" onClick={(e) => { e.stopPropagation(); onDeleteTest(test._id); }} title="Delete test">{Icons.trash}</button>
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
          <div style={{ marginBottom: 12 }}>
            <input
              className="lims-input"
              placeholder="Search packages..."
              maxLength={35}
              value={search.packages}
              onChange={(e) => handleSearch("packages", e.target.value)}
              style={{ height: 34, fontSize: 13, paddingLeft: 10 }}
            />
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
                    <button type="button" className="test-card-delete" onClick={(e) => { e.stopPropagation(); onDeletePackage(pkg._id); }} title="Delete package">{Icons.trash}</button>
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
