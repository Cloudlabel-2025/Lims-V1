"use client";
import { useCallback, useEffect, useState } from "react";
import { Icons } from "@/app/components/Icons";
import SuccessDialog from "@/app/components/SuccessDialog";
import { money, isExponential, hasUrl, isValidName, inputStyle } from "../_components/helpers";
import Field from "../_components/Field";
import Table from "../_components/Table";

const emptyCorporate = { name: "", contactPerson: "", creditLimit: "", statementCycle: "monthly" };

function TwoColumn({ left, right }) {
  return (
    <div className="two-col-form">
      {left}
      {right}
    </div>
  );
}

function CorporateTable({ corporates, onEdit, onDelete }) {
  return (
    <Table
      minWidth={780}
      headings={["Name", "Contact", "Credit Limit", "Outstanding", "Cycle", "Action"]}
      empty="No corporate accounts found."
      rows={corporates.map((corp) => [
        corp.name,
        corp.contactPerson || "-",
        `Rs ${money(corp.creditLimit)}`,
        `Rs ${money(corp.outstandingBalance)}`,
        corp.statementCycle,
        <div key="actions" style={{ display: "flex", gap: 4 }}>
          <button type="button" className="btn-lims-secondary" onClick={() => onEdit(corp)} style={{ height: 36, padding: "0 10px", fontSize: 12 }}>{Icons.edit}</button>
          <button type="button" className="btn-icon-delete" onClick={() => onDelete(corp._id, corp.name)}>{Icons.trash}</button>
        </div>,
      ])}
    />
  );
}

export default function CorporatePage() {
  const [corporates, setCorporates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState(emptyCorporate);
  const [formErrors, setFormErrors] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(emptyCorporate);

  async function fetchJson(url, options) {
    const response = await fetch(url, { cache: "no-store", ...options });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchJson("/api/corporate-accounts");
      setCorporates(data.corporateAccounts || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await fetchJson("/api/corporate-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setForm(emptyCorporate);
      setFormErrors({});
      setSuccess("Corporate account created successfully.");
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function updateCorporate(id, payload) {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await fetchJson(`/api/corporate-accounts/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      setEditingId(null);
      setSuccess("Corporate account updated successfully.");
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteCorporate(id, name) {
    if (!confirm(`Delete corporate account "${name}"? This action cannot be undone.`)) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await fetchJson(`/api/corporate-accounts/${id}`, { method: "DELETE" });
      setSuccess("Corporate account deleted successfully.");
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      {error && <div style={{ padding: "10px 14px", borderRadius: 8, background: "#fef2f2", color: "#b91c1c", fontSize: 13, fontWeight: 700 }}>{error}</div>}
      <SuccessDialog message={success} onClose={() => setSuccess("")} />

      <TwoColumn
        left={
          <form className="form-card" onSubmit={handleSubmit} style={{ padding: 20, borderRadius: 8, display: "grid", gap: 12 }}>
            <h5 style={{ margin: 0, fontSize: 16 }}>Corporate Account</h5>
            <Field label="Name">
              <input required className="lims-input" minLength={3} maxLength={30} value={form.name} onChange={(e) => { const v = e.target.value; if (hasUrl(v)) { setFormErrors((p) => ({ ...p, name: "URLs are not allowed" })); return; } if (v && !isValidName(v)) { setFormErrors((p) => ({ ...p, name: "Name contains invalid characters" })); return; } setFormErrors((p) => ({ ...p, name: "" })); setForm({ ...form, name: v }); }} style={inputStyle()} />
              {formErrors.name && <small style={{ color: "var(--error)", fontSize: 10, display: "block", marginTop: 2 }}>{formErrors.name}</small>}
            </Field>
            <Field label="Contact Person">
              <input required className="lims-input" minLength={3} maxLength={30} value={form.contactPerson} onChange={(e) => { const v = e.target.value; if (hasUrl(v)) { setFormErrors((p) => ({ ...p, contactPerson: "URLs are not allowed" })); return; } if (v && !isValidName(v)) { setFormErrors((p) => ({ ...p, contactPerson: "Contact person contains invalid characters" })); return; } setFormErrors((p) => ({ ...p, contactPerson: "" })); setForm({ ...form, contactPerson: v }); }} style={inputStyle()} />
              {formErrors.contactPerson && <small style={{ color: "var(--error)", fontSize: 10, display: "block", marginTop: 2 }}>{formErrors.contactPerson}</small>}
            </Field>
            <Field label="Credit Limit">
              <input required className="lims-input" type="number" min="0" max="9999999999" step="0.01" value={form.creditLimit} onChange={(e) => { const v = e.target.value; if (isExponential(v)) { setFormErrors((p) => ({ ...p, creditLimit: "Exponential notation is not allowed" })); return; } setFormErrors((p) => ({ ...p, creditLimit: "" })); setForm({ ...form, creditLimit: v }); }} style={inputStyle()} />
              {formErrors.creditLimit && <small style={{ color: "var(--error)", fontSize: 10, display: "block", marginTop: 2 }}>{formErrors.creditLimit}</small>}
            </Field>
            <Field label="Statement Cycle">
              <select className="lims-input" value={form.statementCycle} onChange={(e) => setForm({ ...form, statementCycle: e.target.value })} style={inputStyle()}>
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
              </select>
            </Field>
            <button className="btn-lims-primary" disabled={saving} style={{ height: 38 }}>{saving ? "Saving..." : "Create Corporate"}</button>
          </form>
        }
        right={
          loading ? (
            <div className="form-card" style={{ padding: 28, borderRadius: 8 }}>Loading corporate accounts...</div>
          ) : (
            <CorporateTable
              corporates={corporates}
              onEdit={(corp) => { setEditForm(corp); setEditingId(corp._id); }}
              onDelete={deleteCorporate}
            />
          )
        }
      />

      {editingId && (
        <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "grid", placeItems: "center", zIndex: 1000 }} onClick={() => setEditingId(null)}>
          <div className="form-card" style={{ padding: 24, borderRadius: 12, maxWidth: 440, width: "90%", display: "grid", gap: 12 }} onClick={(e) => e.stopPropagation()}>
            <h5 style={{ margin: 0, fontSize: 16 }}>Edit Corporate Account</h5>
            <Field label="Name">
              <input required className="lims-input" minLength={3} maxLength={30} value={editForm.name} onChange={(e) => { const v = e.target.value; if (hasUrl(v)) { setFormErrors((p) => ({ ...p, name: "URLs are not allowed" })); return; } if (v && !isValidName(v)) { setFormErrors((p) => ({ ...p, name: "Name contains invalid characters" })); return; } setFormErrors((p) => ({ ...p, name: "" })); setEditForm({ ...editForm, name: v }); }} style={inputStyle()} />
              {formErrors.name && <small style={{ color: "var(--error)", fontSize: 10, display: "block", marginTop: 2 }}>{formErrors.name}</small>}
            </Field>
            <Field label="Contact Person">
              <input required className="lims-input" minLength={3} maxLength={30} value={editForm.contactPerson} onChange={(e) => { const v = e.target.value; if (hasUrl(v)) { setFormErrors((p) => ({ ...p, contactPerson: "URLs are not allowed" })); return; } if (v && !isValidName(v)) { setFormErrors((p) => ({ ...p, contactPerson: "Contact person contains invalid characters" })); return; } setFormErrors((p) => ({ ...p, contactPerson: "" })); setEditForm({ ...editForm, contactPerson: v }); }} style={inputStyle()} />
              {formErrors.contactPerson && <small style={{ color: "var(--error)", fontSize: 10, display: "block", marginTop: 2 }}>{formErrors.contactPerson}</small>}
            </Field>
            <Field label="Credit Limit">
              <input required className="lims-input" type="number" min="0" max="9999999999" step="0.01" value={editForm.creditLimit} onChange={(e) => { const v = e.target.value; if (isExponential(v)) { setFormErrors((p) => ({ ...p, creditLimit: "Exponential notation is not allowed" })); return; } setFormErrors((p) => ({ ...p, creditLimit: "" })); setEditForm({ ...editForm, creditLimit: v }); }} style={inputStyle()} />
              {formErrors.creditLimit && <small style={{ color: "var(--error)", fontSize: 10, display: "block", marginTop: 2 }}>{formErrors.creditLimit}</small>}
            </Field>
            <Field label="Statement Cycle">
              <select className="lims-input" value={editForm.statementCycle} onChange={(e) => setEditForm({ ...editForm, statementCycle: e.target.value })} style={inputStyle()}>
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
              </select>
            </Field>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button type="button" className="btn-lims-secondary" onClick={() => setEditingId(null)} style={{ flex: 1, height: 38 }}>Cancel</button>
              <button type="button" className="btn-lims-primary" disabled={saving} onClick={() => {
                const errs = {};
                if (!editForm.name) errs.name = "Name is required";
                else if (hasUrl(editForm.name)) errs.name = "URLs are not allowed";
                else if (!isValidName(editForm.name)) errs.name = "Name contains invalid characters";
                if (!editForm.contactPerson) errs.contactPerson = "Contact person is required";
                else if (hasUrl(editForm.contactPerson)) errs.contactPerson = "URLs are not allowed";
                else if (!isValidName(editForm.contactPerson)) errs.contactPerson = "Contact person contains invalid characters";
                if (editForm.creditLimit === "" || editForm.creditLimit === undefined || editForm.creditLimit === null) errs.creditLimit = "Credit limit is required";
                else if (isExponential(editForm.creditLimit)) errs.creditLimit = "Exponential notation is not allowed";
                setFormErrors((p) => ({ ...p, ...errs }));
                if (Object.keys(errs).length) return;
                updateCorporate(editingId, { name: editForm.name, contactPerson: editForm.contactPerson, creditLimit: editForm.creditLimit, statementCycle: editForm.statementCycle });
              }} style={{ flex: 1, height: 38 }}>{saving ? "Saving..." : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
