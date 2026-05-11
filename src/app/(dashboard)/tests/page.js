"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Icons } from "@/app/components/Icons";
import { hasPermission } from "@/app/lib/client-rbac";
import { useCurrentUser } from "@/app/lib/use-current-user";

const blankParameter = {
  name: "",
  unit: "",
  normalMin: "",
  normalMax: "",
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

export default function TestsPage() {
  const user = useCurrentUser();
  const [categories, setCategories] = useState([]);
  const [tests, setTests] = useState([]);
  const [form, setForm] = useState(blankForm);
  const [categoryName, setCategoryName] = useState("");
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const canSave = useMemo(
    () => form.name && form.category && form.parameters.some((parameter) => parameter.name.trim()),
    [form]
  );
  const canEditTests = hasPermission(user, "tests.edit");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [categoryResponse, testResponse] = await Promise.all([
        fetch("/api/tests/categories", { credentials: "include" }),
        fetch("/api/tests/definitions", { credentials: "include" }),
      ]);
      const [categoryData, testData] = await Promise.all([
        categoryResponse.json(),
        testResponse.json(),
      ]);

      if (!categoryResponse.ok) throw new Error(categoryData.error || "Unable to load categories");
      if (!testResponse.ok) throw new Error(testData.error || "Unable to load tests");

      setCategories(categoryData.categories || []);
      setTests(testData.tests || []);
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

  function editTest(test) {
    setEditingId(test._id);
    setForm({
      name: test.name || "",
      code: test.code || "",
      category: test.category?._id || test.category || "",
      sampleType: test.sampleType || "",
      price: test.price || "",
      status: test.status || "active",
      parameters: test.parameters?.length ? test.parameters : [{ ...blankParameter }],
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
          <p className="module-kicker">Dynamic Test Definition</p>
          <h1>Test Master</h1>
          <span>Build each lab&apos;s own test structure and parameters.</span>
        </div>
        {canEditTests && (
          <button className="dash-btn-secondary" type="button" onClick={resetForm}>
            {Icons.plus} New Test
          </button>
        )}
      </div>

      {error && <div className="module-alert">{error}</div>}

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

            <div className="parameter-list">
              {form.parameters.map((parameter, index) => (
                <div key={index} className="parameter-row">
                  <input value={parameter.name} onChange={(e) => updateParameter(index, "name", e.target.value)} placeholder="Hemoglobin" required />
                  <input value={parameter.unit} onChange={(e) => updateParameter(index, "unit", e.target.value)} placeholder="g/dL" />
                  <input type="number" value={parameter.normalMin ?? ""} onChange={(e) => updateParameter(index, "normalMin", e.target.value)} placeholder="Min" />
                  <input type="number" value={parameter.normalMax ?? ""} onChange={(e) => updateParameter(index, "normalMax", e.target.value)} placeholder="Max" />
                  <label className="parameter-check">
                    <input type="checkbox" checked={parameter.required !== false} onChange={(e) => updateParameter(index, "required", e.target.checked)} />
                    Required
                  </label>
                  <button type="button" className="module-icon-btn danger" onClick={() => removeParameter(index)} title="Remove parameter">
                    {Icons.trash}
                  </button>
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
            <h2>Categories</h2>
            <p>Group tests by lab department.</p>
          </div>
          {canEditTests && (
            <form className="category-inline-form" onSubmit={createCategory}>
              <input value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder="Biochemistry" />
              <button className="dash-btn-secondary" type="submit">{Icons.plus}</button>
            </form>
          )}

          <div className="module-panel-header compact">
            <h2>Defined Tests</h2>
            <p>{tests.length} tests configured</p>
          </div>
          <div className="test-card-list">
            {tests.map((test) => (
              <article
                key={test._id}
                className="test-card"
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
    </div>
  );
}
