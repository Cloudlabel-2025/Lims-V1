"use client";

import { useState } from "react";

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
        <button onClick={() => setActiveListTab("categories")} style={tabStyle(activeListTab === "categories")}>
          Categories List
        </button>
        <button onClick={() => setActiveListTab("tests")} style={tabStyle(activeListTab === "tests")}>
          Tests List
        </button>
        <button onClick={() => setActiveListTab("packages")} style={tabStyle(activeListTab === "packages")}>
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
            {categories.map((cat) => (
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
        </aside>
      )}

      {activeListTab === "tests" && (
        <aside className="module-panel">
          <div className="module-panel-header">
            <h2>Defined Tests</h2>
            <p>{tests.length} tests configured</p>
          </div>
          <div className="test-card-list">
            {tests.map((test) => (
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
        </aside>
      )}

      {activeListTab === "packages" && (
        <aside className="module-panel">
          <div className="module-panel-header">
            <h2>Defined Packages</h2>
            <p>{packages.length} packages configured</p>
          </div>
          <div className="test-card-list">
            {packages.map((pkg) => (
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
        </aside>
      )}
    </div>
  );
}
