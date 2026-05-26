"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Icons } from "@/app/components/Icons";
import { hasPermission } from "@/app/lib/client-rbac";
import { cachedJsonFetch, clearCachedApi, useCurrentUser } from "@/app/lib/use-current-user";

const PackagesTab = dynamic(() => import("./PackagesTab"), {
  ssr: false,
  loading: () => <div className="module-panel">Loading packages...</div>,
});
const CategoriesTab = dynamic(() => import("./CategoriesTab"), {
  ssr: false,
  loading: () => <div className="module-panel">Loading categories...</div>,
});

const blankParameter = {
  name: "",
  unit: "",
  normalMin: "",
  normalMax: "",
  maleMin: "",
  maleMax: "",
  femaleMin: "",
  femaleMax: "",
  required: true,
};

const blankForm = {
  name: "",
  code: "",
  category: "",
  sampleType: "",
  price: "",
  status: "active",
  parameters: [{ ...blankParameter }],
};

const blankPackageForm = {
  name: "",
  code: "",
  description: "",
  price: "",
  status: "active",
  tests: [],
};

export default function TestsPage() {
  const user = useCurrentUser();
  const [activeTab, setActiveTab] = useState("tests"); // tests, packages, categories
  const [categories, setCategories] = useState([]);
  const [tests, setTests] = useState([]);
  const [packages, setPackages] = useState([]);
  const [form, setForm] = useState(blankForm);
  const [packageForm, setPackageForm] = useState(blankPackageForm);
  const [categoryName, setCategoryName] = useState("");
  const [categoryForm, setCategoryForm] = useState({ name: "", description: "", status: "active" });
  const [editingId, setEditingId] = useState("");
  const [editingPackageId, setEditingPackageId] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const canSave = useMemo(
    () => form.name && form.category && form.parameters.some((parameter) => parameter.name.trim()),
    [form]
  );

  const canSavePackage = useMemo(
    () => packageForm.name && packageForm.tests.length > 0 && packageForm.price !== "",
    [packageForm]
  );

  const selectedTestsTotal = useMemo(() => {
    return packageForm.tests.reduce((acc, testId) => {
      const test = tests.find(t => t._id === testId);
      return acc + (Number(test?.price) || 0);
    }, 0);
  }, [packageForm.tests, tests]);
  const packageTestOptions = useMemo(
    () => tests.map((test) => ({ value: test._id, label: test.name, sublabel: test.category?.name || "No Category" })),
    [tests]
  );
  const categoryUsageCounts = useMemo(() => {
    const counts = new Map();
    tests.forEach((test) => {
      const categoryId = test.category?._id || test.category;
      if (categoryId) counts.set(categoryId, (counts.get(categoryId) || 0) + 1);
    });
    return counts;
  }, [tests]);

  const canEditTests = hasPermission(user, "tests.edit");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [categoryResponse, testResponse, packageResponse] = await Promise.all([
        cachedJsonFetch("/api/tests/categories", { ttl: 30_000 }),
        cachedJsonFetch("/api/tests/definitions", { ttl: 30_000 }),
        cachedJsonFetch("/api/tests/packages", { ttl: 30_000 }),
      ]);
      const categoryData = categoryResponse.data;
      const testData = testResponse.data;
      const packageData = packageResponse.data;

      if (!categoryResponse.response.ok) throw new Error(categoryData.error || "Unable to load categories");
      if (!testResponse.response.ok) throw new Error(testData.error || "Unable to load tests");
      if (!packageResponse.response.ok) throw new Error(packageData.error || "Unable to load packages");

      setCategories(categoryData.categories || []);
      setTests(testData.tests || []);
      setPackages(packageData.packages || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!form.category && categories[0]?._id) {
      setForm((current) => ({ ...current, category: categories[0]._id }));
    }
  }, [categories, form.category]);

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function updateParameter(index, name, value) {
    setForm((current) => ({
      ...current,
      parameters: current.parameters.map((parameter, parameterIndex) =>
        parameterIndex === index ? { ...parameter, [name]: value } : parameter
      ),
    }));
  }

  function addParameter() {
    setForm((current) => ({
      ...current,
      parameters: [...current.parameters, { ...blankParameter }],
    }));
  }

  function removeParameter(index) {
    setForm((current) => ({
      ...current,
      parameters:
        current.parameters.length === 1
          ? [{ ...blankParameter }]
          : current.parameters.filter((_, parameterIndex) => parameterIndex !== index),
    }));
  }

  async function createCategory(event) {
    event.preventDefault();
    if (!categoryName.trim()) return;

    setError("");
    try {
      const response = await fetch("/api/tests/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: categoryName }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to create category");

      clearCachedApi("/api/tests/categories");
      setCategories((current) => [...current, data.category].sort((a, b) => a.name.localeCompare(b.name)));
      setForm((current) => ({ ...current, category: data.category._id }));
      setCategoryName("");
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveTest(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const response = await fetch(
        editingId ? `/api/tests/definitions/${editingId}` : "/api/tests/definitions",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(form),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.details || "Unable to save test");

      clearCachedApi("/api/tests/definitions");
      clearCachedApi("/api/tests/definitions?status=active");
      setTests((current) => {
        const existing = current.some((test) => test._id === data.test._id);
        return existing
          ? current.map((test) => (test._id === data.test._id ? data.test : test))
          : [data.test, ...current];
      });
      resetForm();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function savePackage(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const response = await fetch(
        editingPackageId ? `/api/tests/packages/${editingPackageId}` : "/api/tests/packages",
        {
          method: editingPackageId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(packageForm),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.details || "Unable to save package");

      clearCachedApi("/api/tests/packages");
      setPackages((current) => {
        const existing = current.some((pkg) => pkg._id === data.package._id);
        return existing
          ? current.map((pkg) => (pkg._id === data.package._id ? data.package : pkg))
          : [data.package, ...current];
      });
      resetPackageForm();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function editPackage(pkg) {
    setEditingPackageId(pkg._id);
    setPackageForm({
      name: pkg.name || "",
      code: pkg.code || "",
      description: pkg.description || "",
      price: pkg.price || "",
      status: pkg.status || "active",
      tests: pkg.tests?.map(t => t._id || t) || [],
    });
  }

  function resetPackageForm() {
    setEditingPackageId("");
    setPackageForm(blankPackageForm);
  }

  function editTest(test) {
    setEditingId(test._id);
    setForm({
      name: test.name || "",
      code: test.code || "",
      category: test.category?._id || test.category || "",
      sampleType: test.sampleType || "",
      price: test.price || "",
      status: test.status || "active",
      parameters: test.parameters?.length ? test.parameters.map(p => ({
        name: p.name || "",
        unit: p.unit || "",
        normalMin: p.normalMin ?? "",
        normalMax: p.normalMax ?? "",
        maleMin: p.maleMin ?? "",
        maleMax: p.maleMax ?? "",
        femaleMin: p.femaleMin ?? "",
        femaleMax: p.femaleMax ?? "",
        required: p.required !== false,
      })) : [{ ...blankParameter }],
    });
  }

  function resetForm() {
    setEditingId("");
    setForm({
      ...blankForm,
      category: categories[0]?._id || "",
      parameters: [{ ...blankParameter }],
    });
  }

  if (loading) return <div className="module-page">Loading tests...</div>;

  return (
    <div className="module-page">
      <div className="module-header">
        <div>
          <p className="module-kicker">Test Master Configuration</p>
          <h1>Test Master</h1>
          <span>Configure tests, parameters, categories, and health packages.</span>
        </div>
        <div className="module-header-actions">
          {activeTab === "tests" && canEditTests && (
            <button className="dash-btn-secondary" type="button" onClick={resetForm}>
              {Icons.plus} New Test
            </button>
          )}
          {activeTab === "packages" && canEditTests && (
            <button className="dash-btn-secondary" type="button" onClick={resetPackageForm}>
              {Icons.plus} New Package
            </button>
          )}
        </div>
      </div>

      <div className="module-tabs" style={{ display: "flex", gap: "24px", marginBottom: "28px", borderBottom: "1px solid var(--border-light)", padding: "0 4px" }}>
        <button 
          onClick={() => setActiveTab("tests")} 
          style={{ 
            padding: "12px 4px", 
            background: "none", 
            border: "none", 
            borderBottom: activeTab === "tests" ? "2.5px solid var(--brand-action, var(--primary))" : "2.5px solid transparent",
            color: activeTab === "tests" ? "var(--brand-action, var(--primary))" : "var(--text-muted)",
            fontWeight: activeTab === "tests" ? "700" : "500",
            fontSize: "14px",
            cursor: "pointer",
            transition: "all 0.2s"
          }}
        >
          Tests & Parameters
        </button>
        <button 
          onClick={() => setActiveTab("packages")} 
          style={{ 
            padding: "12px 4px", 
            background: "none", 
            border: "none", 
            borderBottom: activeTab === "packages" ? "2.5px solid var(--brand-action, var(--primary))" : "2.5px solid transparent",
            color: activeTab === "packages" ? "var(--brand-action, var(--primary))" : "var(--text-muted)",
            fontWeight: activeTab === "packages" ? "700" : "500",
            fontSize: "14px",
            cursor: "pointer",
            transition: "all 0.2s"
          }}
        >
          Test Packages
        </button>
        <button 
          onClick={() => setActiveTab("categories")} 
          style={{ 
            padding: "12px 4px", 
            background: "none", 
            border: "none", 
            borderBottom: activeTab === "categories" ? "2.5px solid var(--brand-action, var(--primary))" : "2.5px solid transparent",
            color: activeTab === "categories" ? "var(--brand-action, var(--primary))" : "var(--text-muted)",
            fontWeight: activeTab === "categories" ? "700" : "500",
            fontSize: "14px",
            cursor: "pointer",
            transition: "all 0.2s"
          }}
        >
          Categories
        </button>
      </div>

      {error && <div className="module-alert">{error}</div>}

      {activeTab === "tests" && (
        <div className="module-grid">
          {canEditTests && (
          <section className="module-panel">
            <div className="module-panel-header">
              <h2>{editingId ? "Edit Test" : "Create Test"}</h2>
              <p>Parameters here drive result entry and reporting.</p>
            </div>

            <form onSubmit={saveTest} className="module-form">
              <div className="module-form-grid">
                <label>
                  Test Name
                  <input value={form.name} onChange={(e) => updateField("name", e.target.value)} placeholder="Enter test name" required />
                </label>
                <label>
                  Code
                  <input value={form.code} onChange={(e) => updateField("code", e.target.value)} placeholder="Enter test code" />
                </label>
                <label>
                  Category
                  <select value={form.category} onChange={(e) => updateField("category", e.target.value)} required>
                    <option value="">Select category</option>
                    {categories.map((category) => (
                      <option key={category._id} value={category._id}>{category.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Sample Type
                  <input value={form.sampleType} onChange={(e) => updateField("sampleType", e.target.value)} placeholder="Enter sample type" />
                </label>
                <label>
                  Price
                  <input type="number" min="0" value={form.price} onChange={(e) => updateField("price", e.target.value)} placeholder="Enter price" />
                </label>
                <label>
                  Status
                  <select value={form.status} onChange={(e) => updateField("status", e.target.value)}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
              </div>

              <div className="module-subhead">
                <h3>Parameters</h3>
                <button type="button" className="module-icon-btn" onClick={addParameter} title="Add parameter">
                  {Icons.plus}
                </button>
              </div>

              <div className="parameter-list" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                {form.parameters.map((parameter, index) => (
                  <div key={index} className="parameter-group" style={{ 
                    padding: "20px", 
                    background: "var(--surface)", 
                    borderRadius: "var(--radius-lg)",
                    border: "1px solid var(--border)",
                    boxShadow: "var(--shadow-sm)"
                  }}>
                    <div className="parameter-row-main" style={{ 
                      display: "flex", 
                      gap: "16px", 
                      marginBottom: "20px", 
                      alignItems: "center" 
                    }}>
                      <div style={{ flex: 2 }}>
                        <input 
                          className="lims-input"
                          value={parameter.name} 
                          onChange={(e) => updateParameter(index, "name", e.target.value)} 
                          placeholder="Enter parameter name" 
                          required 
                          style={{ width: "100%" }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <input 
                          className="lims-input"
                          value={parameter.unit} 
                          onChange={(e) => updateParameter(index, "unit", e.target.value)} 
                          placeholder="Enter unit" 
                          style={{ width: "100%" }}
                        />
                      </div>
                      <label className="parameter-check" style={{ 
                        display: "flex", 
                        alignItems: "center", 
                        gap: "8px", 
                        whiteSpace: "nowrap", 
                        fontSize: "13px",
                        fontWeight: "600",
                        color: "var(--text)",
                        cursor: "pointer",
                        userSelect: "none"
                      }}>
                        <input 
                          type="checkbox" 
                          checked={parameter.required !== false} 
                          onChange={(e) => updateParameter(index, "required", e.target.checked)} 
                          style={{ width: "16px", height: "16px", cursor: "pointer" }}
                        />
                        Required
                      </label>
                      <button 
                        type="button" 
                        className="module-icon-btn danger" 
                        onClick={() => removeParameter(index)} 
                        title="Remove"
                        style={{ 
                          width: "38px", 
                          height: "38px", 
                          display: "flex", 
                          alignItems: "center", 
                          justifyContent: "center",
                          borderRadius: "var(--radius-sm)",
                          flexShrink: 0
                        }}
                      >
                        {Icons.trash}
                      </button>
                    </div>
                    
                    <div className="parameter-ranges-grid" style={{ 
                      display: "grid", 
                      gridTemplateColumns: "1fr 1fr 1fr", 
                      gap: "24px" 
                    }}>
                      <div className="range-col">
                        <label style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", marginBottom: "8px", display: "block", letterSpacing: "0.5px" }}>COMMON RANGE</label>
                        <div style={{ display: "flex", gap: "10px" }}>
                          <input className="lims-input" type="number" step="any" value={parameter.normalMin ?? ""} onChange={(e) => updateParameter(index, "normalMin", e.target.value)} placeholder="Enter min" style={{ width: "100%", textAlign: "center" }} />
                          <input className="lims-input" type="number" step="any" value={parameter.normalMax ?? ""} onChange={(e) => updateParameter(index, "normalMax", e.target.value)} placeholder="Enter max" style={{ width: "100%", textAlign: "center" }} />
                        </div>
                      </div>
                      
                      <div className="range-col">
                        <label style={{ fontSize: "11px", fontWeight: "700", color: "#2563eb", marginBottom: "8px", display: "block", letterSpacing: "0.5px" }}>MALE RANGE</label>
                        <div style={{ display: "flex", gap: "10px" }}>
                          <input className="lims-input" type="number" step="any" value={parameter.maleMin ?? ""} onChange={(e) => updateParameter(index, "maleMin", e.target.value)} placeholder="Enter min" style={{ width: "100%", textAlign: "center", borderColor: "#bfdbfe" }} />
                          <input className="lims-input" type="number" step="any" value={parameter.maleMax ?? ""} onChange={(e) => updateParameter(index, "maleMax", e.target.value)} placeholder="Enter max" style={{ width: "100%", textAlign: "center", borderColor: "#bfdbfe" }} />
                        </div>
                      </div>

                      <div className="range-col">
                        <label style={{ fontSize: "11px", fontWeight: "700", color: "#db2777", marginBottom: "8px", display: "block", letterSpacing: "0.5px" }}>FEMALE RANGE</label>
                        <div style={{ display: "flex", gap: "10px" }}>
                          <input className="lims-input" type="number" step="any" value={parameter.femaleMin ?? ""} onChange={(e) => updateParameter(index, "femaleMin", e.target.value)} placeholder="Enter min" style={{ width: "100%", textAlign: "center", borderColor: "#fbcfe8" }} />
                          <input className="lims-input" type="number" step="any" value={parameter.femaleMax ?? ""} onChange={(e) => updateParameter(index, "femaleMax", e.target.value)} placeholder="Enter max" style={{ width: "100%", textAlign: "center", borderColor: "#fbcfe8" }} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button type="submit" className="dash-btn-primary module-save" disabled={!canSave || saving}>
                {saving ? "Saving..." : editingId ? "Update Test" : "Create Test"}
              </button>
            </form>
          </section>
          )}

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
                  onClick={() => {
                    if (canEditTests) editTest(test);
                  }}
                >
                  <div>
                    <h3>{test.name}</h3>
                    <span>{test.category?.name || "Uncategorized"} · {test.parameters?.length || 0} parameters</span>
                  </div>
                  <strong>{test.status}</strong>
                </article>
              ))}
            </div>
          </aside>
        </div>
      )}

      {activeTab === "packages" && (
        <PackagesTab
          canEditTests={canEditTests}
          packageForm={packageForm}
          setPackageForm={setPackageForm}
          savePackage={savePackage}
          canSavePackage={canSavePackage}
          saving={saving}
          editingPackageId={editingPackageId}
          selectedTestsTotal={selectedTestsTotal}
          packageTestOptions={packageTestOptions}
          packages={packages}
          editPackage={editPackage}
        />
      )}

      {activeTab === "categories" && (
        <CategoriesTab
          canEditTests={canEditTests}
          editingCategoryId={editingCategoryId}
          createCategory={createCategory}
          categoryName={categoryName}
          setCategoryName={setCategoryName}
          saving={saving}
          categories={categories}
          categoryUsageCounts={categoryUsageCounts}
        />
      )}
    </div>
  );
}
