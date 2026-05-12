"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Icons } from "@/app/components/Icons";
import MultiSelect from "@/app/components/MultiSelect";
import { hasPermission } from "@/app/lib/client-rbac";
import { useCurrentUser } from "@/app/lib/use-current-user";

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

  const canEditTests = hasPermission(user, "tests.edit");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [categoryResponse, testResponse, packageResponse] = await Promise.all([
        fetch("/api/tests/categories", { credentials: "include" }),
        fetch("/api/tests/definitions", { credentials: "include" }),
        fetch("/api/tests/packages", { credentials: "include" }),
      ]);
      const [categoryData, testData, packageData] = await Promise.all([
        categoryResponse.json(),
        testResponse.json(),
        packageResponse.json(),
      ]);

      if (!categoryResponse.ok) throw new Error(categoryData.error || "Unable to load categories");
      if (!testResponse.ok) throw new Error(testData.error || "Unable to load tests");
      if (!packageResponse.ok) throw new Error(packageData.error || "Unable to load packages");

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
            borderBottom: activeTab === "tests" ? "2.5px solid var(--primary)" : "2.5px solid transparent",
            color: activeTab === "tests" ? "var(--primary)" : "var(--text-muted)",
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
            borderBottom: activeTab === "packages" ? "2.5px solid var(--primary)" : "2.5px solid transparent",
            color: activeTab === "packages" ? "var(--primary)" : "var(--text-muted)",
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
            borderBottom: activeTab === "categories" ? "2.5px solid var(--primary)" : "2.5px solid transparent",
            color: activeTab === "categories" ? "var(--primary)" : "var(--text-muted)",
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
                  <input value={form.name} onChange={(e) => updateField("name", e.target.value)} placeholder="Complete Blood Count" required />
                </label>
                <label>
                  Code
                  <input value={form.code} onChange={(e) => updateField("code", e.target.value)} placeholder="CBC" />
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
                  <input value={form.sampleType} onChange={(e) => updateField("sampleType", e.target.value)} placeholder="Blood / Serum" />
                </label>
                <label>
                  Price
                  <input type="number" min="0" value={form.price} onChange={(e) => updateField("price", e.target.value)} placeholder="0" />
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
                          placeholder="Parameter Name (e.g. Hemoglobin)" 
                          required 
                          style={{ width: "100%" }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <input 
                          className="lims-input"
                          value={parameter.unit} 
                          onChange={(e) => updateParameter(index, "unit", e.target.value)} 
                          placeholder="Unit (g/dL)" 
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
                          <input className="lims-input" type="number" step="any" value={parameter.normalMin ?? ""} onChange={(e) => updateParameter(index, "normalMin", e.target.value)} placeholder="Min" style={{ width: "100%", textAlign: "center" }} />
                          <input className="lims-input" type="number" step="any" value={parameter.normalMax ?? ""} onChange={(e) => updateParameter(index, "normalMax", e.target.value)} placeholder="Max" style={{ width: "100%", textAlign: "center" }} />
                        </div>
                      </div>
                      
                      <div className="range-col">
                        <label style={{ fontSize: "11px", fontWeight: "700", color: "#2563eb", marginBottom: "8px", display: "block", letterSpacing: "0.5px" }}>MALE RANGE</label>
                        <div style={{ display: "flex", gap: "10px" }}>
                          <input className="lims-input" type="number" step="any" value={parameter.maleMin ?? ""} onChange={(e) => updateParameter(index, "maleMin", e.target.value)} placeholder="Min" style={{ width: "100%", textAlign: "center", borderColor: "#bfdbfe" }} />
                          <input className="lims-input" type="number" step="any" value={parameter.maleMax ?? ""} onChange={(e) => updateParameter(index, "maleMax", e.target.value)} placeholder="Max" style={{ width: "100%", textAlign: "center", borderColor: "#bfdbfe" }} />
                        </div>
                      </div>

                      <div className="range-col">
                        <label style={{ fontSize: "11px", fontWeight: "700", color: "#db2777", marginBottom: "8px", display: "block", letterSpacing: "0.5px" }}>FEMALE RANGE</label>
                        <div style={{ display: "flex", gap: "10px" }}>
                          <input className="lims-input" type="number" step="any" value={parameter.femaleMin ?? ""} onChange={(e) => updateParameter(index, "femaleMin", e.target.value)} placeholder="Min" style={{ width: "100%", textAlign: "center", borderColor: "#fbcfe8" }} />
                          <input className="lims-input" type="number" step="any" value={parameter.femaleMax ?? ""} onChange={(e) => updateParameter(index, "femaleMax", e.target.value)} placeholder="Max" style={{ width: "100%", textAlign: "center", borderColor: "#fbcfe8" }} />
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
        <div className="module-grid">
          {canEditTests && (
            <section className="module-panel">
              <div className="module-panel-header">
                <h2>{editingPackageId ? "Edit Package" : "Create Package"}</h2>
                <p>Bundle multiple tests together.</p>
              </div>

              <form onSubmit={savePackage} className="module-form">
                <div className="module-form-grid">
                  <label>
                    Package Name
                    <input 
                      value={packageForm.name} 
                      onChange={(e) => setPackageForm(p => ({ ...p, name: e.target.value }))} 
                      placeholder="Executive Health Checkup" 
                      required 
                    />
                  </label>
                  <label>
                    Code
                    <input 
                      value={packageForm.code} 
                      onChange={(e) => setPackageForm(p => ({ ...p, code: e.target.value }))} 
                      placeholder="PKG-EXEC" 
                    />
                  </label>
                  <label className="full-width">
                    Description
                    <textarea 
                      value={packageForm.description} 
                      onChange={(e) => setPackageForm(p => ({ ...p, description: e.target.value }))} 
                      placeholder="Comprehensive health screening including major vital tests..." 
                      style={{ width: "100%", height: "80px", padding: "10px", borderRadius: "var(--radius-sm)", border: "1.5px solid var(--border)", fontSize: "13.5px" }}
                    />
                  </label>
                  <label>
                    Package Price (₹)
                    <div style={{ position: "relative" }}>
                      <input 
                        type="number" 
                        value={packageForm.price} 
                        onChange={(e) => setPackageForm(p => ({ ...p, price: e.target.value }))} 
                        placeholder="0" 
                        required 
                        className="lims-input"
                      />
                      {packageForm.tests.length > 0 && (
                        <div style={{ 
                          position: "absolute", 
                          right: "12px", 
                          top: "50%", 
                          transform: "translateY(-50%)", 
                          fontSize: "11px", 
                          color: "var(--text-muted)",
                          pointerEvents: "none"
                        }}>
                          Individual Sum: ₹{selectedTestsTotal}
                        </div>
                      )}
                    </div>
                  </label>
                  <label>
                    Status
                    <select 
                      value={packageForm.status} 
                      onChange={(e) => setPackageForm(p => ({ ...p, status: e.target.value }))}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </label>
                  <label className="full-width">
                    Select Tests
                    <MultiSelect 
                      options={tests.map(t => ({ value: t._id, label: t.name, sublabel: t.category?.name || "No Category" }))}
                      value={packageForm.tests}
                      onChange={(e) => setPackageForm(p => ({ ...p, tests: e.target.value }))}
                      placeholder="Search and add tests..."
                    />
                  </label>
                </div>

                <button type="submit" className="dash-btn-primary module-save" disabled={!canSavePackage || saving} style={{ marginTop: "24px" }}>
                  {saving ? "Saving..." : editingPackageId ? "Update Package" : "Create Package"}
                </button>
              </form>
            </section>
          )}

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
                  onClick={() => {
                    if (canEditTests) editPackage(pkg);
                  }}
                >
                  <div>
                    <h3>{pkg.name}</h3>
                    <span>{pkg.tests?.length || 0} tests included · ₹{pkg.price}</span>
                  </div>
                  <strong>{pkg.status}</strong>
                </article>
              ))}
            </div>
          </aside>
        </div>
      )}

      {activeTab === "categories" && (
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
                      placeholder="Hematology" 
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

          <aside className="module-panel">
            <div className="module-panel-header">
              <h2>Department Categories</h2>
              <p>{categories.length} categories available</p>
            </div>
            <div className="test-card-list">
              {categories.map((cat) => (
                <article
                  key={cat._id}
                  className={`test-card ${editingCategoryId === cat._id ? 'active' : ''}`}
                >
                  <div>
                    <h3>{cat.name}</h3>
                    <span>Used in {tests.filter(t => t.category?._id === cat._id || t.category === cat._id).length} tests</span>
                  </div>
                </article>
              ))}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
