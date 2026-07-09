"use client";
import { useCallback, useEffect, useState } from "react";
import { Icons } from "@/app/components/Icons";
import SuccessDialog from "@/app/components/SuccessDialog";
import { money, inputStyle, sanitizeCorporateName, sanitizeAmountInput } from "../_components/helpers";
import Field from "../_components/Field";
import Table from "../_components/Table";

const emptyCorporate = { name: "", contactPerson: "", creditLimit: "", statementCycle: "monthly" };

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
  const [viewMode, setViewMode] = useState("form");
  const [searchQuery, setSearchQuery] = useState("");
  const [cycleFilter, setCycleFilter] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

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
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await fetchJson(`/api/corporate-accounts/${id}`, { method: "DELETE" });
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
      setDeleteTarget(null);
    }
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      {error && <div style={{ padding: "10px 14px", borderRadius: 8, background: "#fef2f2", color: "#b91c1c", fontSize: 13, fontWeight: 700 }}>{error}</div>}
      <SuccessDialog message={success} onClose={() => setSuccess("")} />

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>View:</span>
        <div style={{ display: "flex", background: "var(--border-light)", padding: 3, borderRadius: 8 }}>
          <button onClick={() => setViewMode("form")} style={{ padding: "6px 12px", borderRadius: 6, border: "none", background: viewMode === "form" ? "#fff" : "transparent", color: viewMode === "form" ? "var(--brand-action)" : "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, transition: "all 0.2s", boxShadow: viewMode === "form" ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18" /><path d="M3 9h18" /></svg>
            Form
          </button>
          <button onClick={() => setViewMode("list")} style={{ padding: "6px 12px", borderRadius: 6, border: "none", background: viewMode === "list" ? "#fff" : "transparent", color: viewMode === "list" ? "var(--brand-action)" : "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, transition: "all 0.2s", boxShadow: viewMode === "list" ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>
            List
          </button>
        </div>
      </div>

      {viewMode === "form" && (
        <form className="form-card" onSubmit={handleSubmit} style={{ padding: 20, borderRadius: 8, display: "grid", gap: 12 }}>
          <h5 style={{ margin: 0, fontSize: 16 }}>Corporate Account</h5>
          <Field label="Name">
            <input required className="lims-input" minLength={3} maxLength={30} value={form.name} onChange={(e) => { const v = sanitizeCorporateName(e.target.value); setFormErrors((p) => ({ ...p, name: "" })); setForm({ ...form, name: v }); }} style={inputStyle()} />
            {formErrors.name && <small style={{ color: "var(--error)", fontSize: 10, display: "block", marginTop: 2 }}>{formErrors.name}</small>}
          </Field>
          <Field label="Contact Person">
            <input required className="lims-input" minLength={3} maxLength={25} value={form.contactPerson} onChange={(e) => { const v = e.target.value.replace(/[^A-Za-z ]/g, "").slice(0, 25); setFormErrors((p) => ({ ...p, contactPerson: "" })); setForm({ ...form, contactPerson: v }); }} style={inputStyle()} />
            {formErrors.contactPerson && <small style={{ color: "var(--error)", fontSize: 10, display: "block", marginTop: 2 }}>{formErrors.contactPerson}</small>}
          </Field>
          <Field label="Credit Limit">
            <input required className="lims-input" type="text" inputMode="numeric" maxLength={7} value={form.creditLimit} onChange={(e) => { const v = sanitizeAmountInput(e.target.value); setFormErrors((p) => ({ ...p, creditLimit: "" })); setForm({ ...form, creditLimit: v }); }} style={inputStyle()} />
            {formErrors.creditLimit && <small style={{ color: "var(--error)", fontSize: 10, display: "block", marginTop: 2 }}>{formErrors.creditLimit}</small>}
          </Field>
          <Field label="Statement Cycle">
            <select className="lims-input" value={form.statementCycle} onChange={(e) => setForm({ ...form, statementCycle: e.target.value })} style={inputStyle()}>
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
              <option value="quarterly">Quarterly</option>
              <option value="half-yearly">Half-Yearly</option>
              <option value="yearly">Yearly</option>
            </select>
          </Field>
          <button className="btn-lims-primary" disabled={saving} style={{ height: 38 }}>{saving ? "Saving..." : "Create Corporate"}</button>
        </form>
      )}

      {viewMode === "list" && (
        loading ? (
          <div className="form-card" style={{ padding: 28, borderRadius: 8 }}>Loading corporate accounts...</div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
              <div style={{ position: "relative", minWidth: 280, flex: "0 1 360px" }}>
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}>{Icons.search}</span>
                <input className="lims-input" placeholder="Search by name or contact..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ ...inputStyle(), paddingLeft: 38 }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
              <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 600 }}>Cycle:</span>
              <select className="lims-input" value={cycleFilter} onChange={(e) => setCycleFilter(e.target.value)} style={{ ...inputStyle(), width: "auto", minWidth: 140 }}>
                <option value="">All</option>
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
                <option value="quarterly">Quarterly</option>
                <option value="half-yearly">Half-Yearly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <CorporateTable
              corporates={corporates.filter((c) => {
                const q = searchQuery.toLowerCase();
                if (q && !c.name.toLowerCase().includes(q) && !(c.contactPerson || "").toLowerCase().includes(q)) return false;
                if (cycleFilter && c.statementCycle !== cycleFilter) return false;
                return true;
              })}
              onEdit={(corp) => { setEditForm(corp); setEditingId(corp._id); }}
              onDelete={(id, name) => setDeleteTarget({ _id: id, name })}
            />
          </>
        )
      )}

      {editingId && (
        <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "grid", placeItems: "center", zIndex: 1000 }} onClick={() => setEditingId(null)}>
          <div className="form-card" style={{ padding: 36, borderRadius: 12, maxWidth: 960, width: "95vw", display: "grid", gap: 20 }} onClick={(e) => e.stopPropagation()}>
            <h5 style={{ margin: 0, fontSize: 18 }}>Edit Corporate Account</h5>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <Field label="Name">
                <input required className="lims-input" minLength={3} maxLength={30} value={editForm.name} onChange={(e) => { const v = sanitizeCorporateName(e.target.value); setFormErrors((p) => ({ ...p, name: "" })); setEditForm({ ...editForm, name: v }); }} style={inputStyle()} />
                {formErrors.name && <small style={{ color: "var(--error)", fontSize: 10, display: "block", marginTop: 2 }}>{formErrors.name}</small>}
              </Field>
              <Field label="Contact Person">
                <input required className="lims-input" minLength={3} maxLength={25} value={editForm.contactPerson} onChange={(e) => { const v = e.target.value.replace(/[^A-Za-z ]/g, "").slice(0, 25); setFormErrors((p) => ({ ...p, contactPerson: "" })); setEditForm({ ...editForm, contactPerson: v }); }} style={inputStyle()} />
                {formErrors.contactPerson && <small style={{ color: "var(--error)", fontSize: 10, display: "block", marginTop: 2 }}>{formErrors.contactPerson}</small>}
              </Field>
              <Field label="Credit Limit">
                <input required className="lims-input" type="text" inputMode="numeric" maxLength={7} value={editForm.creditLimit} onChange={(e) => { const v = sanitizeAmountInput(e.target.value); setFormErrors((p) => ({ ...p, creditLimit: "" })); setEditForm({ ...editForm, creditLimit: v }); }} style={inputStyle()} />
                {formErrors.creditLimit && <small style={{ color: "var(--error)", fontSize: 10, display: "block", marginTop: 2 }}>{formErrors.creditLimit}</small>}
              </Field>
              <Field label="Statement Cycle">
                <select className="lims-input" value={editForm.statementCycle} onChange={(e) => setEditForm({ ...editForm, statementCycle: e.target.value })} style={inputStyle()}>
                  <option value="monthly">Monthly</option>
                  <option value="weekly">Weekly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="half-yearly">Half-Yearly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </Field>
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
              <button type="button" className="btn-lims-secondary" onClick={() => setEditingId(null)} style={{ flex: 1, height: 40 }}>Cancel</button>
              <button type="button" className="btn-lims-primary" disabled={saving} onClick={() => {
                const errs = {};
                if (!editForm.name) errs.name = "Name is required";
                else if (editForm.name.length < 3) errs.name = "Name must be at least 3 characters";
                if (!editForm.contactPerson) errs.contactPerson = "Contact person is required";
                else if (editForm.contactPerson.length < 3) errs.contactPerson = "Contact person must be at least 3 characters";
                if (editForm.creditLimit === "" || editForm.creditLimit === undefined || editForm.creditLimit === null) errs.creditLimit = "Credit limit is required";
                setFormErrors((p) => ({ ...p, ...errs }));
                if (Object.keys(errs).length) return;
                updateCorporate(editingId, { name: editForm.name, contactPerson: editForm.contactPerson, creditLimit: editForm.creditLimit, statementCycle: editForm.statementCycle });
              }} style={{ flex: 1, height: 40 }}>{saving ? "Saving..." : "Save"}</button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "grid", placeItems: "center", zIndex: 1000 }} onClick={() => { if (!saving) setDeleteTarget(null); }}>
          <div className="form-card" style={{ padding: 24, borderRadius: 12, maxWidth: 400, width: "90%", display: "grid", gap: 16, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 28, color: "var(--error, #b91c1c)" }}>{Icons.trash}</div>
            <div>
              <h5 style={{ margin: 0, fontSize: 16 }}>Delete Corporate Account</h5>
              <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
                Are you sure you want to delete <strong>"{deleteTarget.name}"</strong>? This action cannot be undone.
              </p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn-lims-secondary" onClick={() => setDeleteTarget(null)} disabled={saving} style={{ flex: 1, height: 38 }}>Cancel</button>
              <button type="button" className="btn-lims-primary" style={{ flex: 1, height: 38, background: "var(--error, #b91c1c)", borderColor: "var(--error, #b91c1c)" }} disabled={saving} onClick={() => deleteCorporate(deleteTarget._id, deleteTarget.name)}>{saving ? "Deleting..." : "Delete"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
