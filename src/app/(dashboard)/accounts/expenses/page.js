"use client";
import { useCallback, useEffect, useState } from "react";
import { Icons } from "@/app/components/Icons";
import SuccessDialog from "@/app/components/SuccessDialog";
import { money, formatDate, inputStyle, sanitizeVendorName, sanitizeAmountInput, isValidUrl } from "../_components/helpers";
import Field from "../_components/Field";
import Table from "../_components/Table";
import PaginationControls from "../_components/PaginationControls";

const emptyExpense = { category: "reagent", vendorName: "", amount: "", taxPercentage: "", paidFrom: "vendor-payable", attachmentUrl: "" };

function TwoColumn({ left, right }) {
  return (
    <div className="two-col-form">
      {left}
      {right}
    </div>
  );
}

function ExpensesTable({ expenses, onEdit, onDelete }) {
  return (
    <Table
      minWidth={860}
      headings={["Date", "Category", "Vendor", "Amount", "Credit", "Journal", "Action"]}
      empty="No expenses found."
      rows={expenses.map((expense) => [
        formatDate(expense.date),
        expense.category,
        expense.vendorName || "-",
        `Rs ${money(Number(expense.amount || 0) + Number(expense.taxAmount || 0))}`,
        expense.paidFrom,
        expense.journalEntryId?.entryNumber || "-",
        <div key="actions" style={{ display: "flex", gap: 4 }}>
          <button type="button" className="btn-lims-secondary" onClick={() => onEdit(expense)} style={{ height: 36, padding: "0 10px", fontSize: 12 }}>{Icons.edit}</button>
          <button type="button" className="btn-icon-delete" onClick={() => onDelete(expense._id)}>{Icons.trash}</button>
        </div>,
      ])}
    />
  );
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState(emptyExpense);
  const [formErrors, setFormErrors] = useState({});
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(emptyExpense);

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
      const data = await fetchJson(`/api/expenses?page=${page}&limit=50`);
      setExpenses(data.expenses || []);
      setPagination(data.pagination || { page, limit: 50, total: data.expenses?.length || 0, totalPages: 1 });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      if (form.attachmentUrl && !isValidUrl(form.attachmentUrl)) { setError("Receipt URL is not valid"); setSaving(false); return; }
      const taxAmount = form.taxPercentage && form.amount ? Math.round(Number(form.amount) * Number(form.taxPercentage) / 100) : 0;
      await fetchJson("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, taxAmount: String(taxAmount) }),
      });
      setForm(emptyExpense);
      setFormErrors({});
      setSuccess("Expense recorded successfully.");
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function updateExpense(id, payload) {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await fetchJson(`/api/expenses/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      setEditingId(null);
      setSuccess("Expense updated successfully.");
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteExpense(id) {
    if (!confirm("Delete this expense? This action cannot be undone.")) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await fetchJson(`/api/expenses/${id}`, { method: "DELETE" });
      setSuccess("Expense deleted successfully.");
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
            <h5 style={{ margin: 0, fontSize: 16 }}>Record Expense</h5>
            <Field label="Category">
              <select className="lims-input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={inputStyle()}>
                {["reagent", "staff", "equipment", "overhead"].map((cat) => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </Field>
            <Field label="Vendor">
              <input required className="lims-input" minLength={3} maxLength={30} value={form.vendorName} onChange={(e) => { const v = sanitizeVendorName(e.target.value); setFormErrors((p) => ({ ...p, vendorName: "" })); setForm({ ...form, vendorName: v }); }} style={inputStyle()} />
              {formErrors.vendorName && <small style={{ color: "var(--error)", fontSize: 10, display: "block", marginTop: 2 }}>{formErrors.vendorName}</small>}
            </Field>
            <Field label="Amount">
              <input required className="lims-input no-spinner" inputMode="numeric" maxLength={7} value={form.amount} onChange={(e) => { const v = sanitizeAmountInput(e.target.value); setFormErrors((p) => ({ ...p, amount: "" })); setForm({ ...form, amount: v }); }} style={inputStyle()} />
              {formErrors.amount && <small style={{ color: "var(--error)", fontSize: 10, display: "block", marginTop: 2 }}>{formErrors.amount}</small>}
            </Field>
            <Field label="Tax (%)">
              <input className="lims-input no-spinner" inputMode="numeric" maxLength={2} value={form.taxPercentage} onChange={(e) => { const v = sanitizeAmountInput(e.target.value); if (Number(v) > 90) return; setFormErrors((p) => ({ ...p, taxPercentage: "" })); setForm({ ...form, taxPercentage: v }); }} style={inputStyle()} placeholder="0-90" />
              {form.taxPercentage && form.amount ? <small style={{ color: "var(--text-secondary)", fontSize: 10, display: "block", marginTop: 2 }}>Tax Amount: Rs {Math.round(Number(form.amount) * Number(form.taxPercentage) / 100)}</small> : null}
              {formErrors.taxPercentage && <small style={{ color: "var(--error)", fontSize: 10, display: "block", marginTop: 2 }}>{formErrors.taxPercentage}</small>}
            </Field>
            <Field label="Credit">
              <select className="lims-input" value={form.paidFrom} onChange={(e) => setForm({ ...form, paidFrom: e.target.value })} style={inputStyle()}>
                <option value="vendor-payable">Vendor Payable</option>
                <option value="cash">Cash</option>
                <option value="bank">Bank</option>
              </select>
            </Field>
            <Field label="Receipt URL"><input className="lims-input" type="url" maxLength={500} value={form.attachmentUrl} onChange={(e) => { const v = e.target.value; if (v && !isValidUrl(v)) { setFormErrors((p) => ({ ...p, attachmentUrl: "Enter a valid URL (http:// or https://)" })); } else { setFormErrors((p) => ({ ...p, attachmentUrl: "" })); } setForm({ ...form, attachmentUrl: v }); }} style={inputStyle()} placeholder="https://" />{formErrors.attachmentUrl && <small style={{ color: "var(--error)", fontSize: 10, display: "block", marginTop: 2 }}>{formErrors.attachmentUrl}</small>}</Field>
            <button className="btn-lims-primary" disabled={saving} style={{ height: 38 }}>{saving ? "Posting..." : "Record Expense"}</button>
          </form>
        }
        right={
          <div style={{ display: "grid", gap: 12 }}>
            {loading ? (
              <div className="form-card" style={{ padding: 28, borderRadius: 8 }}>Loading expenses...</div>
            ) : (
              <>
                <ExpensesTable
                  expenses={expenses}
                  onEdit={(exp) => { const taxPct = exp.amount && Number(exp.amount) > 0 ? Math.round((Number(exp.taxAmount || 0) / Number(exp.amount)) * 100) : 0; setEditForm({ ...exp, amount: String(exp.amount ?? ""), taxPercentage: taxPct > 0 ? String(taxPct) : "" }); setEditingId(exp._id); }}
                  onDelete={deleteExpense}
                />
                <PaginationControls pagination={pagination} loading={loading} onPageChange={setPage} />
              </>
            )}
          </div>
        }
      />

      {editingId && (
        <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "grid", placeItems: "center", zIndex: 1000 }} onClick={() => setEditingId(null)}>
          <div className="form-card" style={{ padding: 24, borderRadius: 12, maxWidth: 440, width: "90%", display: "grid", gap: 12 }} onClick={(e) => e.stopPropagation()}>
            <h5 style={{ margin: 0, fontSize: 16 }}>Edit Expense</h5>
            <Field label="Category">
              <select className="lims-input" value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} style={inputStyle()}>
                {["reagent", "staff", "equipment", "overhead"].map((cat) => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </Field>
            <Field label="Vendor"><input required className="lims-input" minLength={3} maxLength={30} value={editForm.vendorName} onChange={(e) => { const v = sanitizeVendorName(e.target.value); setFormErrors((p) => ({ ...p, vendorName: "" })); setEditForm({ ...editForm, vendorName: v }); }} style={inputStyle()} />{formErrors.vendorName && <small style={{ color: "var(--error)", fontSize: 10, display: "block", marginTop: 2 }}>{formErrors.vendorName}</small>}</Field>
            <Field label="Amount"><input required className="lims-input no-spinner" inputMode="numeric" maxLength={7} value={editForm.amount} onChange={(e) => { const v = sanitizeAmountInput(e.target.value); setFormErrors((p) => ({ ...p, amount: "" })); setEditForm({ ...editForm, amount: v }); }} style={inputStyle()} />{formErrors.amount && <small style={{ color: "var(--error)", fontSize: 10, display: "block", marginTop: 2 }}>{formErrors.amount}</small>}</Field>
            <Field label="Tax (%)"><input className="lims-input no-spinner" inputMode="numeric" maxLength={2} value={editForm.taxPercentage} onChange={(e) => { const v = sanitizeAmountInput(e.target.value); if (Number(v) > 90) return; setFormErrors((p) => ({ ...p, taxPercentage: "" })); setEditForm({ ...editForm, taxPercentage: v }); }} style={inputStyle()} placeholder="0-90" />{editForm.taxPercentage && editForm.amount ? <small style={{ color: "var(--text-secondary)", fontSize: 10, display: "block", marginTop: 2 }}>Tax Amount: Rs {Math.round(Number(editForm.amount) * Number(editForm.taxPercentage) / 100)}</small> : null}{formErrors.taxPercentage && <small style={{ color: "var(--error)", fontSize: 10, display: "block", marginTop: 2 }}>{formErrors.taxPercentage}</small>}</Field>
            <Field label="Credit">
              <select className="lims-input" value={editForm.paidFrom} onChange={(e) => setEditForm({ ...editForm, paidFrom: e.target.value })} style={inputStyle()}>
                <option value="vendor-payable">Vendor Payable</option>
                <option value="cash">Cash</option>
                <option value="bank">Bank</option>
              </select>
            </Field>
            <Field label="Receipt URL"><input className="lims-input" type="url" maxLength={500} value={editForm.attachmentUrl} onChange={(e) => { const v = e.target.value; if (v && !isValidUrl(v)) { setFormErrors((p) => ({ ...p, attachmentUrl: "Enter a valid URL (http:// or https://)" })); } else { setFormErrors((p) => ({ ...p, attachmentUrl: "" })); } setEditForm({ ...editForm, attachmentUrl: v }); }} style={inputStyle()} placeholder="https://" />{formErrors.attachmentUrl && <small style={{ color: "var(--error)", fontSize: 10, display: "block", marginTop: 2 }}>{formErrors.attachmentUrl}</small>}</Field>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button type="button" className="btn-lims-secondary" onClick={() => setEditingId(null)} style={{ flex: 1, height: 38 }}>Cancel</button>
              <button type="button" className="btn-lims-primary" disabled={saving} onClick={() => {
                const errs = {};
                if (!editForm.vendorName) errs.vendorName = "Vendor is required";
                else if (editForm.vendorName.length < 3) errs.vendorName = "Vendor name must be at least 3 characters";
                if (editForm.amount === "" || editForm.amount === undefined || editForm.amount === null) errs.amount = "Amount is required";
                if (editForm.attachmentUrl && !isValidUrl(editForm.attachmentUrl)) errs.attachmentUrl = "Enter a valid URL (http:// or https://)";
                setFormErrors((p) => ({ ...p, ...errs }));
                if (Object.keys(errs).length) return;
                const taxAmount = editForm.taxPercentage && editForm.amount ? Math.round(Number(editForm.amount) * Number(editForm.taxPercentage) / 100) : 0;
                updateExpense(editingId, { category: editForm.category, vendorName: editForm.vendorName, amount: editForm.amount, taxAmount: String(taxAmount), paidFrom: editForm.paidFrom });
              }} style={{ flex: 1, height: 38 }}>{saving ? "Saving..." : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
