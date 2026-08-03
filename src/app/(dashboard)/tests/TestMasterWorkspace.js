"use client";

import dynamic from "next/dynamic";
import { Icons } from "@/app/components/Icons";
import SuccessDialog from "@/app/components/SuccessDialog";
import TestDefinitionEditor from "./TestDefinitionEditor";

const CategoriesTab = dynamic(() => import("./CategoriesTab"), { ssr: false });
const PackagesTab = dynamic(() => import("./PackagesTab"), { ssr: false });
const ListsTab = dynamic(() => import("./ListsTab"), { ssr: false });

export function TestMasterLoading() {
  return (
    <div className="test-master-page" aria-busy="true" aria-label="Loading test master">
      <div className="test-master-loading-heading"><span /><div><i /><i /></div></div>
      <div className="test-master-loading-metrics">{[1, 2, 3, 4].map((item) => <span key={item} />)}</div>
      <div className="test-master-loading-panel"><i /><i /><i /><i /></div>
    </div>
  );
}

export default function TestMasterWorkspace({
  activeTab,
  setActiveTab,
  categories,
  tests,
  packages,
  inventoryItems,
  inventoryUoms,
  form,
  packageForm,
  setPackageForm,
  categoryForm,
  setCategoryForm,
  editingId,
  editingPackageId,
  editingCategoryId,
  setEditingCategoryId,
  saving,
  error,
  success,
  setSuccess,
  canSave,
  canSavePackage,
  selectedTestsTotal,
  packageTestOptions,
  categoryUsageCounts,
  canEditTests,
  canDeleteTests,
  loadData,
  updateField,
  updateParameter,
  addParameter,
  removeParameter,
  addRequiredItem,
  removeRequiredItem,
  updateRequiredItem,
  saveCategory,
  saveTest,
  savePackage,
  editPackage,
  resetPackageForm,
  editTest,
  resetForm,
  editCategory,
  deleteCategory,
  deleteTest,
  deletePackage,
}) {
  const activeCategoryCount = categories.filter((category) => category.status === "active").length;
  const activeTestCount = tests.filter((test) => test.status === "active").length;
  const activePackageCount = packages.filter((pkg) => pkg.status === "active").length;
  const parameterCount = tests.reduce((total, test) => total + (test.parameters?.length || 0), 0);
  const tabs = [
    { id: "categories", label: "Categories", description: "Departments", count: categories.length, icon: Icons.grid },
    { id: "tests", label: "Tests & parameters", description: "Result definitions", count: tests.length, icon: Icons.flask },
    { id: "packages", label: "Test packages", description: "Bundled offerings", count: packages.length, icon: Icons.list },
    { id: "lists", label: "Master catalog", description: "Search and maintain", count: categories.length + tests.length + packages.length, icon: Icons.search },
  ];

  const clearCategoryEditor = () => {
    setEditingCategoryId("");
    setCategoryForm({ name: "", description: "", status: "active" });
  };

  return (
    <div className="test-master-page">
      <header className="test-master-heading">
        <div>
          <p>Laboratory configuration</p>
          <h1>Test Master</h1>
          <span>Manage the clinical catalog used for ordering, billing, result entry, reporting, and inventory consumption.</span>
        </div>
        <div className="test-master-heading-actions">
          <span className="test-master-health"><i /> Catalog operational</span>
          {activeTab === "tests" && canEditTests && <button className="dash-btn-primary" type="button" onClick={resetForm}>{Icons.plus} New test</button>}
          {activeTab === "packages" && canEditTests && <button className="dash-btn-primary" type="button" onClick={resetPackageForm}>{Icons.plus} New package</button>}
          {activeTab === "categories" && canEditTests && editingCategoryId && <button className="dash-btn-primary" type="button" onClick={clearCategoryEditor}>{Icons.plus} New category</button>}
        </div>
      </header>

      <section className="test-master-metrics" aria-label="Test catalog overview">
        <article><span>{Icons.grid}</span><div><small>Categories</small><strong>{categories.length}</strong><p>{activeCategoryCount} active departments</p></div></article>
        <article><span>{Icons.flask}</span><div><small>Test definitions</small><strong>{tests.length}</strong><p>{activeTestCount} available to order</p></div></article>
        <article><span>{Icons.activity}</span><div><small>Result parameters</small><strong>{parameterCount}</strong><p>Across all configured tests</p></div></article>
        <article><span>{Icons.list}</span><div><small>Health packages</small><strong>{packages.length}</strong><p>{activePackageCount} active offerings</p></div></article>
      </section>

      <SuccessDialog message={success} onClose={() => setSuccess("")} />

      <nav className="test-master-tabs" aria-label="Test master sections">
        {tabs.map((tab) => (
          <button key={tab.id} type="button" className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)} aria-current={activeTab === tab.id ? "page" : undefined}>
            <span>{tab.icon}</span>
            <div><strong>{tab.label}</strong><small>{tab.description}</small></div>
            <em>{tab.count}</em>
          </button>
        ))}
      </nav>

      {error && <div className="test-master-alert" role="alert"><span>{Icons.alertCircle}</span><div><strong>Unable to complete the request</strong><p>{error}</p></div><button type="button" onClick={loadData}>{Icons.refresh} Retry</button></div>}

      {!canEditTests && activeTab !== "lists" && (
        <div className="test-master-readonly-note"><span>{Icons.shield}</span><div><strong>Read-only catalog access</strong><p>Your role can review master data but cannot create or update definitions.</p></div><button type="button" onClick={() => setActiveTab("lists")}>Open master catalog</button></div>
      )}

      {activeTab === "categories" && (
        <CategoriesTab canEditTests={canEditTests} editingCategoryId={editingCategoryId} saveCategory={saveCategory} categoryForm={categoryForm} setCategoryForm={setCategoryForm} saving={saving} onCancelEdit={clearCategoryEditor} categories={categories} categoryUsageCounts={categoryUsageCounts} editCategory={editCategory} />
      )}

      {activeTab === "tests" && canEditTests && (
        <TestDefinitionEditor editingId={editingId} form={form} categories={categories} inventoryItems={inventoryItems} inventoryUoms={inventoryUoms} saving={saving} canSave={canSave} updateField={updateField} updateParameter={updateParameter} addParameter={addParameter} removeParameter={removeParameter} addRequiredItem={addRequiredItem} updateRequiredItem={updateRequiredItem} removeRequiredItem={removeRequiredItem} saveTest={saveTest} resetForm={resetForm} />
      )}

      {activeTab === "packages" && (
        <PackagesTab canEditTests={canEditTests} packageForm={packageForm} setPackageForm={setPackageForm} savePackage={savePackage} canSavePackage={canSavePackage} saving={saving} editingPackageId={editingPackageId} selectedTestsTotal={selectedTestsTotal} packageTestOptions={packageTestOptions} packages={packages} editPackage={editPackage} canDeleteTests={canDeleteTests} onDeletePackage={canDeleteTests ? deletePackage : null} onCancelEdit={resetPackageForm} />
      )}

      {activeTab === "lists" && (
        <ListsTab categories={categories} categoryUsageCounts={categoryUsageCounts} tests={tests} packages={packages} canEditTests={canEditTests} editingId={editingId} editingPackageId={editingPackageId} editTest={(test) => { editTest(test); setActiveTab("tests"); }} editPackage={(pkg) => { editPackage(pkg); setActiveTab("packages"); }} editCategory={editCategory} editingCategoryId={editingCategoryId} onDeleteCategory={canDeleteTests ? deleteCategory : null} onDeleteTest={canDeleteTests ? deleteTest : null} onDeletePackage={canDeleteTests ? (id) => deletePackage(id, { skipConfirm: true }) : null} />
      )}
    </div>
  );
}
