"use client";

import { Icons } from "@/app/components/Icons";

export default function TestDefinitionEditor({
  editingId,
  form,
  categories,
  inventoryItems,
  inventoryUoms,
  saving,
  canSave,
  updateField,
  updateParameter,
  addParameter,
  removeParameter,
  addRequiredItem,
  updateRequiredItem,
  removeRequiredItem,
  saveTest,
  resetForm,
}) {
  return (
    <section className="test-master-editor">
      <header className="test-master-panel-header">
        <div>
          <span>{editingId ? "Editing definition" : "New test definition"}</span>
          <h2>{editingId ? form.name || "Edit test" : "Create laboratory test"}</h2>
          <p>Define billing details, result parameters, reference ranges, and inventory consumption.</p>
        </div>
        {editingId ? <em>Unsaved changes</em> : <em className="neutral">Draft</em>}
      </header>

      <form onSubmit={saveTest} className="test-definition-form">
        <section className="test-editor-section">
          <header>
            <span>01</span>
            <div>
              <h3>Test identity and billing</h3>
              <p>Information staff use when ordering and billing this test.</p>
            </div>
          </header>
          <div className="test-editor-field-grid">
            <label>
              Test name
              <input value={form.name} onChange={(e) => updateField("name", e.target.value)} placeholder="e.g. Complete-Blood-Count" required maxLength={25} pattern="[A-Za-z0-9\-]+" title="Only letters, numbers, and hyphens allowed" />
            </label>
            <label>
              Test code
              <input value={form.code} onChange={(e) => updateField("code", e.target.value.toUpperCase())} placeholder="e.g. CBC" required maxLength={20} pattern="[A-Z0-9]+" title="Only uppercase letters and numbers allowed" />
            </label>
            <label>
              Category
              <select value={form.category} onChange={(e) => updateField("category", e.target.value)} required>
                <option value="">Select category</option>
                {categories.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}
              </select>
            </label>
            <label>
              Sample type
              <input value={form.sampleType} onChange={(e) => updateField("sampleType", e.target.value)} placeholder="e.g. Blood" required maxLength={20} pattern="[A-Za-z0-9]+" title="Only letters and numbers allowed" />
            </label>
            <label>
              Patient price (₹)
              <input type="number" min="0" max="999999999" value={form.price} onChange={(e) => updateField("price", e.target.value)} placeholder="0.00" required />
            </label>
            <label>
              Availability
              <select value={form.status} onChange={(e) => updateField("status", e.target.value)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
          </div>
        </section>

        <section className="test-editor-section">
          <header>
            <span>02</span>
            <div>
              <h3>Result parameters</h3>
              <p>Configure every value captured during result entry and reporting.</p>
            </div>
            <button type="button" className="test-master-secondary-action" onClick={addParameter}>
              {Icons.plus} Add parameter
            </button>
          </header>

          <div className="test-parameter-stack">
            {form.parameters.map((parameter, index) => (
              <article key={index} className="test-parameter-card">
                <header>
                  <div>
                    <span>Parameter {String(index + 1).padStart(2, "0")}</span>
                    <strong>{parameter.name || "Unnamed parameter"}</strong>
                  </div>
                  <label className="test-parameter-required">
                    <input type="checkbox" checked={parameter.required !== false} onChange={(e) => updateParameter(index, "required", e.target.checked)} />
                    Required result
                  </label>
                  <button type="button" className="test-master-icon-action danger" onClick={() => removeParameter(index)} aria-label={`Remove parameter ${index + 1}`}>
                    {Icons.trash}
                  </button>
                </header>

                <div className="test-parameter-identity">
                  <label>
                    Parameter name
                    <input value={parameter.name} onChange={(e) => updateParameter(index, "name", e.target.value)} placeholder="e.g. Haemoglobin" required pattern="[A-Za-z][A-Za-z0-9 .&'/,\-]*" />
                  </label>
                  <label>
                    Measurement unit
                    <input value={parameter.unit} onChange={(e) => updateParameter(index, "unit", e.target.value)} placeholder="e.g. g/dL, %" required pattern="[A-Za-z0-9 .&'\/,()@_#%µ\-]*" />
                  </label>
                </div>

                <div className="test-reference-grid">
                  <fieldset>
                    <legend>Common reference range</legend>
                    <div><input type="number" step="any" value={parameter.normalMin ?? ""} onChange={(e) => updateParameter(index, "normalMin", e.target.value)} placeholder="Minimum" /><span>to</span><input type="number" step="any" value={parameter.normalMax ?? ""} onChange={(e) => updateParameter(index, "normalMax", e.target.value)} placeholder="Maximum" /></div>
                  </fieldset>
                  <fieldset>
                    <legend>Male reference range</legend>
                    <div><input type="number" step="any" value={parameter.maleMin ?? ""} onChange={(e) => updateParameter(index, "maleMin", e.target.value)} placeholder="Minimum" /><span>to</span><input type="number" step="any" value={parameter.maleMax ?? ""} onChange={(e) => updateParameter(index, "maleMax", e.target.value)} placeholder="Maximum" /></div>
                  </fieldset>
                  <fieldset>
                    <legend>Female reference range</legend>
                    <div><input type="number" step="any" value={parameter.femaleMin ?? ""} onChange={(e) => updateParameter(index, "femaleMin", e.target.value)} placeholder="Minimum" /><span>to</span><input type="number" step="any" value={parameter.femaleMax ?? ""} onChange={(e) => updateParameter(index, "femaleMax", e.target.value)} placeholder="Maximum" /></div>
                  </fieldset>
                </div>
              </article>
            ))}
          </div>
        </section>



        <footer className="test-editor-actions">
          <div><strong>{form.parameters.length}</strong> result parameter{form.parameters.length === 1 ? "" : "s"} configured</div>
          <button type="button" className="btn-lims-secondary" onClick={resetForm}>{editingId ? "Cancel editing" : "Clear form"}</button>
          <button type="submit" className="dash-btn-primary" disabled={!canSave || saving}>{saving ? "Saving…" : editingId ? "Update test" : "Create test"}</button>
        </footer>
      </form>
    </section>
  );
}
