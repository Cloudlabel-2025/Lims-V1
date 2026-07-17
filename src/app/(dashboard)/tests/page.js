"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Icons } from "@/app/components/Icons";
import SuccessDialog from "@/app/components/SuccessDialog";
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
const ListsTab = dynamic(() => import("./ListsTab"), {
  ssr: false,
  loading: () => <div className="module-panel">Loading lists...</div>,
});

const NAME_PATTERN = /^[A-Za-z0-9-]+$/;
const CODE_PATTERN = /^[A-Za-z0-9_-]+$/;
const UNIT_PATTERN = /^[0-9]+(\.[0-9]+)?$/;
const URL_RE = /https?:\/\/|www\./i;

function isValidField(value, pattern) {
  return value && pattern.test(value);
}

function rejectUrl(value) {
  return URL_RE.test(value);
}

function isExponential(value) {
  return typeof value === "string" && /[eE]/.test(value);
}

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

const blankRequiredItem = {
  item: "",
  quantityPerTest: "",
  uom: "",
};

const blankForm = {
  name: "",
  code: "",
  category: "",
  sampleType: "",
  price: "",
  status: "active",
  parameters: [{ ...blankParameter }],
  requiredInventoryItems: [],
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
  const [activeTab, setActiveTab] = useState("categories"); // categories, tests, packages, lists
  const [categories, setCategories] = useState([]);
  const [tests, setTests] = useState([]);
  const [packages, setPackages] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [inventoryUoms, setInventoryUoms] = useState([]);
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
  const [success, setSuccess] = useState("");

  const canSave = useMemo(
    () =>
      form.name &&
      form.code &&
      form.category &&
      form.sampleType &&
      form.price !== "" &&
      form.price !== undefined &&
      form.parameters.length > 0 &&
      form.parameters.every((p) => p.name.trim() && p.unit.trim()),
    [form]
  );

  const canSavePackage = useMemo(
    () =>
      packageForm.name &&
      packageForm.code &&
      packageForm.tests.length > 0 &&
      packageForm.price !== "" &&
      packageForm.price !== undefined,
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
  const canDeleteTests = hasPermission(user, "tests.delete");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const [categoryResponse, testResponse, packageResponse, inventoryResponse] = await Promise.all([
        cachedJsonFetch("/api/tests/categories", { ttl: 30_000 }),
        cachedJsonFetch("/api/tests/definitions", { ttl: 30_000 }),
        cachedJsonFetch("/api/tests/packages", { ttl: 30_000 }),
        cachedJsonFetch("/api/inventory?limit=9999", { ttl: 30_000 }),
      ]);
      const categoryData = categoryResponse.data;
      const testData = testResponse.data;
      const packageData = packageResponse.data;
      const inventoryData = inventoryResponse.data;

      if (!categoryResponse.response.ok) throw new Error(categoryData.error || "Unable to load categories");
      if (!testResponse.response.ok) throw new Error(testData.error || "Unable to load tests");
      if (!packageResponse.response.ok) throw new Error(packageData.error || "Unable to load packages");

      setCategories(categoryData.categories || []);
      setTests(testData.tests || []);
      setPackages(packageData.packages || []);
      setInventoryItems(inventoryData.items || []);
      setInventoryUoms(inventoryData.uoms || []);
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

  function addRequiredItem() {
    setForm((current) => ({
      ...current,
      requiredInventoryItems: [...current.requiredInventoryItems, { ...blankRequiredItem }],
    }));
  }

  function removeRequiredItem(index) {
    setForm((current) => ({
      ...current,
      requiredInventoryItems: current.requiredInventoryItems.filter((_, i) => i !== index),
    }));
  }

  function updateRequiredItem(index, name, value) {
    setForm((current) => ({
      ...current,
      requiredInventoryItems: current.requiredInventoryItems.map((entry, i) =>
        i === index ? { ...entry, [name]: value } : entry
      ),
    }));
  }

  async function saveCategory(event) {
    event.preventDefault();
    const name = categoryName.trim();
    if (!name) { setError("Category name is required"); return; }
    if (name.length > 25) { setError("Category name must be 25 characters or less"); return; }
    if (!isValidField(name, NAME_PATTERN)) {
      setError("Category name can only contain letters, numbers, and hyphens");
      return;
    }
    if (rejectUrl(name)) {
      setError("Category name cannot contain a URL");
      return;
    }

    setError("");
    try {
      const method = editingCategoryId ? "PUT" : "POST";
      const url = editingCategoryId ? `/api/tests/categories/${editingCategoryId}` : "/api/tests/categories";
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: categoryName }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || (editingCategoryId ? "Unable to update category" : "Unable to create category"));

      clearCachedApi("/api/tests/categories");
      if (editingCategoryId) {
        setCategories((current) => current.map((c) => (c._id === data.category._id ? data.category : c)));
        setEditingCategoryId("");
      } else {
        setCategories((current) => [...current, data.category].sort((a, b) => a.name.localeCompare(b.name)));
        setForm((current) => ({ ...current, category: data.category._id }));
      }
      setCategoryName("");
      setSuccess(`Category "${data.category.name}" ${editingCategoryId ? "updated" : "created"} successfully.`);
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveTest(event) {
    event.preventDefault();
    setError("");

    if (!form.name || !form.name.trim()) { setError("Test name is required"); return; }
    if (!form.code || !form.code.trim()) { setError("Test code is required"); return; }

    if (form.name.trim().length > 25) { setError("Test name must be 25 characters or less"); return; }
    if (!isValidField(form.name, NAME_PATTERN)) {
      setError("Test name can only contain letters, numbers, and hyphens");
      return;
    }
    if ((form.name.match(/-/g) || []).length > 1) {
      setError("Test name can contain only one hyphen");
      return;
    }
    if (rejectUrl(form.name)) {
      setError("Test name cannot contain a URL");
      return;
    }
    if (form.code.trim().length > 20) { setError("Test code must be 20 characters or less"); return; }
    if (!/^[A-Z0-9]+$/.test(form.code.trim())) {
      setError("Test code can only contain uppercase letters and numbers");
      return;
    }
    if (rejectUrl(form.code)) {
      setError("Test code cannot contain a URL");
      return;
    }
    if (!form.sampleType.trim()) {
      setError("Sample type is required");
      return;
    }
    if (form.sampleType.trim().length > 20) { setError("Sample type must be 20 characters or less"); return; }
    if (!/^[A-Za-z0-9]+$/.test(form.sampleType.trim())) {
      setError("Sample type can only contain letters and numbers");
      return;
    }
    if (rejectUrl(form.sampleType)) {
      setError("Sample type cannot contain a URL");
      return;
    }
    if (form.price === "" || form.price === null || form.price === undefined) {
      setError("Price is required");
      return;
    }
    if (isExponential(form.price)) {
      setError("Price contains an invalid value");
      return;
    }
    if (Number(form.price) < 0) {
      setError("Price cannot be negative");
      return;
    }

    for (let i = 0; i < form.parameters.length; i++) {
      const p = form.parameters[i];
      if (!p.name.trim()) {
        setError(`Parameter ${i + 1} name is required`);
        return;
      }
      if (!isValidField(p.name, NAME_PATTERN)) {
        setError(`Parameter ${i + 1} name contains invalid characters`);
        return;
      }
      if (rejectUrl(p.name)) {
        setError(`Parameter ${i + 1} name cannot contain a URL`);
        return;
      }
      if (!p.unit.trim()) {
        setError(`Parameter ${i + 1} unit is required`);
        return;
      }
      if (!isValidField(p.unit, UNIT_PATTERN)) {
        setError(`Parameter ${i + 1} unit should be only measured in numerals`);
        return;
      }
      if (rejectUrl(p.unit)) {
        setError(`Parameter ${i + 1} unit cannot contain a URL`);
        return;
      }
      if (isExponential(p.normalMin) || isExponential(p.normalMax) ||
          isExponential(p.maleMin) || isExponential(p.maleMax) ||
          isExponential(p.femaleMin) || isExponential(p.femaleMax)) {
        setError(`Parameter ${i + 1} range contains an invalid value`);
        return;
      }

      const toNum = (v) => (v === "" || v === null || v === undefined ? NaN : Number(v));
      const cMin = toNum(p.normalMin), cMax = toNum(p.normalMax);
      if (Number.isFinite(cMin) && Number.isFinite(cMax) && cMin >= cMax) {
        setError(`Parameter ${i + 1} common range min must be less than max`);
        return;
      }
      const mMn = toNum(p.maleMin), mMx = toNum(p.maleMax);
      if (Number.isFinite(mMn) && Number.isFinite(mMx) && mMn >= mMx) {
        setError(`Parameter ${i + 1} male range min must be less than max`);
        return;
      }
      const fMn = toNum(p.femaleMin), fMx = toNum(p.femaleMax);
      if (Number.isFinite(fMn) && Number.isFinite(fMx) && fMn >= fMx) {
        setError(`Parameter ${i + 1} female range min must be less than max`);
        return;
      }
    }

    setSaving(true);
    setSuccess("");
    const wasEditing = Boolean(editingId);

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
      setSuccess(`Test "${data.test.name}" ${wasEditing ? "updated" : "created"} successfully.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function savePackage(event) {
    event.preventDefault();
    setError("");

    if (!packageForm.name || !packageForm.name.trim()) { setError("Package name is required"); return; }
    if (!packageForm.code || !packageForm.code.trim()) { setError("Package code is required"); return; }
    if (!packageForm.tests || packageForm.tests.length === 0) { setError("At least one test must be selected"); return; }

    if (packageForm.name.trim().length > 25) { setError("Package name must be 25 characters or less"); return; }
    if (!/^[A-Za-z0-9\-]+$/.test(packageForm.name.trim())) {
      setError("Package name can only contain letters, numbers, and hyphens");
      return;
    }
    if ((packageForm.name.match(/-/g) || []).length > 1) {
      setError("Package name can contain only one hyphen");
      return;
    }
    if (rejectUrl(packageForm.name)) {
      setError("Package name cannot contain a URL");
      return;
    }
    if (packageForm.code.trim().length > 20) { setError("Package code must be 20 characters or less"); return; }
    if (!/^[A-Z0-9]+$/.test(packageForm.code.trim())) {
      setError("Package code can only contain uppercase letters and numbers");
      return;
    }
    if (rejectUrl(packageForm.code)) {
      setError("Package code cannot contain a URL");
      return;
    }
    if (packageForm.price === "" || packageForm.price === null || packageForm.price === undefined) {
      setError("Package price is required");
      return;
    }
    if (isExponential(packageForm.price)) {
      setError("Package price contains an invalid value");
      return;
    }
    if (!/^\d{1,8}$/.test(String(packageForm.price).trim())) {
      setError("Package price must be a number with up to 8 digits");
      return;
    }
    if (Number(packageForm.price) < 0) {
      setError("Package price cannot be negative");
      return;
    }

    setSaving(true);
    setSuccess("");
    const wasEditing = Boolean(editingPackageId);

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
      setSuccess(`Package "${data.package.name}" ${wasEditing ? "updated" : "created"} successfully.`);
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
      price: pkg.price ?? "",
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
      requiredInventoryItems: test.requiredInventoryItems?.map(ri => ({
        item: ri.item?._id || ri.item || "",
        quantityPerTest: ri.quantityPerTest ?? "",
        uom: ri.uom?._id || ri.uom || "",
      })) || [],
    });
  }

  function resetForm() {
    setEditingId("");
    setForm({
      ...blankForm,
      category: categories[0]?._id || "",
      parameters: [{ ...blankParameter }],
      requiredInventoryItems: [],
    });
  }

  async function deleteCategory(categoryId) {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/tests/categories/${categoryId}`, { method: "DELETE", credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to delete category");
      clearCachedApi("/api/tests/categories");
      setCategories((prev) => prev.filter((c) => c._id !== categoryId));
      setSuccess("Category deleted successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteTest(testId) {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/tests/definitions/${testId}`, { method: "DELETE", credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to delete test");
      clearCachedApi("/api/tests/definitions");
      setTests((prev) => prev.filter((t) => t._id !== testId));
      setSuccess("Test deleted successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deletePackage(packageId, { skipConfirm = false } = {}) {
    if (!skipConfirm && !confirm("Delete this package? This action cannot be undone.")) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/tests/packages/${packageId}`, { method: "DELETE", credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to delete package");
      clearCachedApi("/api/tests/packages");
      setPackages((prev) => prev.filter((p) => p._id !== packageId));
      setSuccess("Package deleted successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
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

      <SuccessDialog message={success} onClose={() => setSuccess("")} />
      <div className="module-tabs" style={{ display: "flex", gap: "24px", marginBottom: "28px", borderBottom: "1px solid var(--border-light)", padding: "0 4px" }}>
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
          onClick={() => setActiveTab("lists")}
          style={{
            padding: "12px 4px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "lists" ? "2.5px solid var(--brand-action, var(--primary))" : "2.5px solid transparent",
            color: activeTab === "lists" ? "var(--brand-action, var(--primary))" : "var(--text-muted)",
            fontWeight: activeTab === "lists" ? "700" : "500",
            fontSize: "14px",
            cursor: "pointer",
            transition: "all 0.2s"
          }}
        >
          View Lists
        </button>
      </div>

      {error && <div className="module-alert">{error}</div>}

      {activeTab === "categories" && (
        <CategoriesTab
          canEditTests={canEditTests}
          editingCategoryId={editingCategoryId}
          saveCategory={saveCategory}
          categoryName={categoryName}
          setCategoryName={setCategoryName}
          saving={saving}
          onCancelEdit={() => { setEditingCategoryId(""); setCategoryName(""); }}
        />
      )}

      {activeTab === "tests" && (
        <div>
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
                  <input value={form.name} onChange={(e) => updateField("name", e.target.value)} placeholder="Enter test name" required maxLength={25} pattern="[A-Za-z0-9\-]+" title="Only letters, numbers, and hyphens allowed (max 25 characters, only one hyphen)" />
                </label>
                <label>
                  Code
                  <input value={form.code} onChange={(e) => updateField("code", e.target.value.toUpperCase())} placeholder="Enter test code" required maxLength={20} pattern="[A-Z0-9]+" title="Only uppercase letters and numbers allowed (max 20 characters)" />
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
                  <input value={form.sampleType} onChange={(e) => updateField("sampleType", e.target.value)} placeholder="Enter sample type" required maxLength={20} pattern="[A-Za-z0-9]+" title="Only letters and numbers allowed (max 20 characters)" />
                </label>
                <label>
                  Price
                  <input type="number" min="0" max="999999999" value={form.price} onChange={(e) => updateField("price", e.target.value)} placeholder="Enter price" required />
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
                      alignItems: "center",
                      flexWrap: "wrap"
                    }}>
                      <div style={{ flex: "1 1 200px" }}>
                        <input 
                          className="lims-input"
                          value={parameter.name} 
                          onChange={(e) => updateParameter(index, "name", e.target.value)} 
                          placeholder="Enter parameter name" 
                          required 
                          pattern="[A-Za-z][A-Za-z0-9 .&'\/,-]*"
                          title="Only letters, numbers, spaces, and . &amp; ' / , - allowed"
                          style={{ width: "100%" }}
                        />
                      </div>
                      <div style={{ flex: "1 1 120px" }}>
                        <input 
                          className="lims-input"
                          value={parameter.unit} 
                          onChange={(e) => updateParameter(index, "unit", e.target.value)} 
                          placeholder="Enter unit" 
                          required
                          pattern="[0-9]+(\.[0-9]+)?"
                          title="Unit should be only measured in numerals"
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
                      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", 
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

              <div className="module-subhead">
                <h3>Required Inventory Items</h3>
                <button type="button" className="module-icon-btn" onClick={addRequiredItem} title="Add required inventory item">
                  {Icons.plus}
                </button>
              </div>

              {form.requiredInventoryItems.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {form.requiredInventoryItems.map((entry, index) => (
                    <div key={index} style={{
                      display: "flex",
                      gap: "12px",
                      alignItems: "center",
                      padding: "14px",
                      background: "var(--surface)",
                      borderRadius: "var(--radius-lg)",
                      border: "1px solid var(--border)",
                      flexWrap: "wrap",
                    }}>
                      <div style={{ flex: "2 1 200px" }}>
                        <select
                          className="lims-input"
                          value={entry.item}
                          onChange={(e) => updateRequiredItem(index, "item", e.target.value)}
                          required
                          style={{ width: "100%" }}
                        >
                          <option value="">Select inventory item</option>
                          {inventoryItems.map((item) => (
                            <option key={item._id} value={item._id}>{item.itemCode} - {item.name}</option>
                          ))}
                        </select>
                      </div>
                      <div style={{ flex: "1 1 100px" }}>
                        <input
                          className="lims-input"
                          type="number"
                          step="any"
                          min="0"
                          value={entry.quantityPerTest}
                          onChange={(e) => updateRequiredItem(index, "quantityPerTest", e.target.value)}
                          placeholder="Qty per test"
                          required
                          style={{ width: "100%" }}
                        />
                      </div>
                      <div style={{ flex: "1 1 120px" }}>
                        <select
                          className="lims-input"
                          value={entry.uom}
                          onChange={(e) => updateRequiredItem(index, "uom", e.target.value)}
                          required
                          style={{ width: "100%" }}
                        >
                          <option value="">Select UOM</option>
                          {inventoryUoms.filter(u => u.status === "active").map((uom) => (
                            <option key={uom._id} value={uom._id}>{uom.name} ({uom.symbol})</option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        className="module-icon-btn danger"
                        onClick={() => removeRequiredItem(index)}
                        title="Remove"
                        style={{
                          width: "38px",
                          height: "38px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: "var(--radius-sm)",
                          flexShrink: 0,
                        }}
                      >
                        {Icons.trash}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button type="submit" className="dash-btn-primary module-save" disabled={!canSave || saving}>
                {saving ? "Saving..." : editingId ? "Update Test" : "Create Test"}
              </button>
            </form>
          </section>
          )}
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
          showList={false}
          canDeleteTests={canDeleteTests}
          onDeletePackage={canDeleteTests ? deletePackage : null}
        />
      )}

      {activeTab === "lists" && (
        <ListsTab
          categories={categories}
          categoryUsageCounts={categoryUsageCounts}
          tests={tests}
          packages={packages}
          canEditTests={canEditTests}
          editingId={editingId}
          editingPackageId={editingPackageId}
          editTest={editTest}
          editPackage={editPackage}
          canDeleteTests={canDeleteTests}
          onDeleteCategory={canDeleteTests ? deleteCategory : null}
          onDeleteTest={canDeleteTests ? deleteTest : null}
          onDeletePackage={canDeleteTests ? (id) => deletePackage(id, { skipConfirm: true }) : null}
        />
      )}
    </div>
  );
}
