"use client";

import { useMemo, useState } from "react";
import { Icons } from "@/app/components/Icons";

const PAGE_SIZE = 20;

function PaginationControls({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;
  return (
    <footer className="test-catalog-pagination">
      <span>Page {page} of {totalPages}</span>
      <div>
        <button type="button" className="btn-lims-secondary" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Previous</button>
        <button type="button" className="btn-lims-secondary" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>Next</button>
      </div>
    </footer>
  );
}

function DeleteConfirmModal({ target, type, onClose, onConfirm }) {
  if (!target) return null;
  const labels = { category: "category", test: "test", package: "package" };
  return (
    <div className="test-delete-overlay" onClick={onClose} role="presentation">
      <section className="test-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-master-title" onClick={(event) => event.stopPropagation()}>
        <span>{Icons.trash}</span>
        <div><small>Permanent action</small><h2 id="delete-master-title">Delete {labels[type] || "record"}?</h2><p><strong>{target.label}</strong> will be removed from the test master. This action cannot be undone.</p></div>
        <footer><button type="button" className="btn-lims-secondary" onClick={onClose}>Cancel</button><button type="button" className="test-master-danger-action" onClick={onConfirm}>Delete permanently</button></footer>
      </section>
    </div>
  );
}

function CatalogEmpty({ search, label }) {
  return <div className="test-master-empty-state"><span>{search ? Icons.search : Icons.list}</span><strong>{search ? `No matching ${label}` : `No ${label} configured`}</strong><p>{search ? "Try a different name or clear the search field." : "New master records will appear here after they are created."}</p></div>;
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
  onDeleteCategory,
  onDeleteTest,
  onDeletePackage,
  editCategory,
  editingCategoryId = "",
}) {
  const [activeListTab, setActiveListTab] = useState("categories");
  const [page, setPage] = useState({ categories: 1, tests: 1, packages: 1 });
  const [search, setSearch] = useState({ categories: "", tests: "", packages: "" });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteType, setDeleteType] = useState(null);

  const datasets = useMemo(() => {
    const filter = (items, query) => query ? items.filter((item) => `${item.name || ""} ${item.code || ""}`.toLowerCase().includes(query.toLowerCase())) : items;
    return {
      categories: filter(categories, search.categories),
      tests: filter(tests, search.tests),
      packages: filter(packages, search.packages),
    };
  }, [categories, tests, packages, search]);

  const currentItems = datasets[activeListTab];
  const currentPage = page[activeListTab];
  const totalPages = Math.max(1, Math.ceil(currentItems.length / PAGE_SIZE));
  const paginatedItems = currentItems.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const listTabs = [
    { id: "categories", label: "Categories", count: categories.length },
    { id: "tests", label: "Tests", count: tests.length },
    { id: "packages", label: "Packages", count: packages.length },
  ];

  function changeTab(tab) {
    setActiveListTab(tab);
    setPage((current) => ({ ...current, [tab]: 1 }));
  }

  function handleSearch(value) {
    setSearch((current) => ({ ...current, [activeListTab]: value }));
    setPage((current) => ({ ...current, [activeListTab]: 1 }));
  }

  function requestDelete(type, id, label) {
    setDeleteTarget({ id, label });
    setDeleteType(type);
  }

  function confirmDelete() {
    if (deleteType === "category") onDeleteCategory?.(deleteTarget.id);
    if (deleteType === "test") onDeleteTest?.(deleteTarget.id);
    if (deleteType === "package") onDeletePackage?.(deleteTarget.id);
    setDeleteTarget(null);
    setDeleteType(null);
  }

  return (
    <section className="test-catalog-workspace">
      <header className="test-master-panel-header">
        <div><span>Master data directory</span><h2>Search and maintain catalog</h2><p>Review status, pricing, relationships, and configuration coverage from one place.</p></div>
      </header>

      <nav className="test-catalog-tabs" aria-label="Catalog record type">
        {listTabs.map((tab) => <button key={tab.id} type="button" className={activeListTab === tab.id ? "active" : ""} onClick={() => changeTab(tab.id)}><strong>{tab.label}</strong><em>{tab.count}</em></button>)}
      </nav>

      <div className="test-catalog-toolbar">
        <label><span>{Icons.search}</span><input value={search[activeListTab]} onChange={(event) => handleSearch(event.target.value)} placeholder={`Search ${activeListTab} by name${activeListTab === "categories" ? "" : " or code"}…`} maxLength={35} /></label>
        <p>Showing <strong>{paginatedItems.length}</strong> of <strong>{currentItems.length}</strong> {activeListTab}</p>
      </div>

      <div className="test-catalog-list">
        {activeListTab === "categories" && paginatedItems.map((category) => (
          <article key={category._id} className={editingCategoryId === category._id ? "active" : ""}>
            <span className="test-catalog-record-icon">{Icons.grid}</span>
            <div className="test-catalog-record-main"><header><strong>{category.name}</strong><em className={category.status}>{category.status}</em></header><p>{category.description || "No category description provided."}</p><dl><div><dt>Linked tests</dt><dd>{categoryUsageCounts.get(category._id) || 0}</dd></div></dl></div>
            <div className="test-catalog-row-actions">{editCategory && <button type="button" onClick={() => editCategory(category)} aria-label={`Edit ${category.name}`}>{Icons.edit}</button>}{onDeleteCategory && <button type="button" className="danger" onClick={() => requestDelete("category", category._id, category.name)} aria-label={`Delete ${category.name}`}>{Icons.trash}</button>}</div>
          </article>
        ))}

        {activeListTab === "tests" && paginatedItems.map((test) => (
          <article key={test._id} className={editingId === test._id ? "active" : ""}>
            <span className="test-catalog-record-icon">{Icons.flask}</span>
            <div className="test-catalog-record-main"><header><strong>{test.name}</strong><code>{test.code}</code><em className={test.status}>{test.status}</em></header><dl><div><dt>Category</dt><dd>{test.category?.name || "Uncategorized"}</dd></div><div><dt>Sample</dt><dd>{test.sampleType || "—"}</dd></div><div><dt>Price</dt><dd>₹{test.price ?? "—"}</dd></div><div><dt>Parameters</dt><dd>{test.parameters?.length || 0}</dd></div></dl></div>
            <div className="test-catalog-row-actions">{canEditTests && <button type="button" onClick={() => editTest(test)} aria-label={`Edit ${test.name}`}>{Icons.edit}</button>}{onDeleteTest && <button type="button" className="danger" onClick={() => requestDelete("test", test._id, test.name)} aria-label={`Delete ${test.name}`}>{Icons.trash}</button>}</div>
          </article>
        ))}

        {activeListTab === "packages" && paginatedItems.map((pkg) => (
          <article key={pkg._id} className={editingPackageId === pkg._id ? "active" : ""}>
            <span className="test-catalog-record-icon">{Icons.list}</span>
            <div className="test-catalog-record-main"><header><strong>{pkg.name}</strong><code>{pkg.code || "NO CODE"}</code><em className={pkg.status}>{pkg.status}</em></header><p>{pkg.description || "No package description provided."}</p><dl><div><dt>Included tests</dt><dd>{pkg.tests?.length || 0}</dd></div><div><dt>Package price</dt><dd>₹{pkg.price}</dd></div></dl></div>
            <div className="test-catalog-row-actions">{canEditTests && <button type="button" onClick={() => editPackage(pkg)} aria-label={`Edit ${pkg.name}`}>{Icons.edit}</button>}{onDeletePackage && <button type="button" className="danger" onClick={() => requestDelete("package", pkg._id, pkg.name)} aria-label={`Delete ${pkg.name}`}>{Icons.trash}</button>}</div>
          </article>
        ))}

        {!paginatedItems.length && <CatalogEmpty search={search[activeListTab]} label={activeListTab} />}
      </div>

      <PaginationControls page={currentPage} totalPages={totalPages} onPageChange={(nextPage) => setPage((current) => ({ ...current, [activeListTab]: nextPage }))} />
      <DeleteConfirmModal target={deleteTarget} type={deleteType} onClose={() => { setDeleteTarget(null); setDeleteType(null); }} onConfirm={confirmDelete} />
    </section>
  );
}
