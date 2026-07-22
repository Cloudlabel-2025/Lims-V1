"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { Icons } from "@/app/components/Icons";
import SuccessDialog from "@/app/components/SuccessDialog";
import { money, formatDate, inputStyle, sanitizeVendorName, sanitizeAmountInput, isValidUrl } from "../_components/helpers";
import Field from "../_components/Field";
import Table from "../_components/Table";
import PaginationControls from "../_components/PaginationControls";
import DownloadDropdown from "../_components/DownloadDropdown";

const emptyExpense = { category: "reagent", vendorName: "", amount: "", taxPercentage: "", paidFrom: "vendor-payable", attachmentUrl: "" };

function ExpensesTable({ expenses, onEdit, onDelete }) {
  return (
    <Table
      minWidth={1100}
      headings={["Date", "Category", "Vendor", "Amount", "Tax %", "Tax Amt", "Total", "Credit Mode", "Receipt URL", "Journal", "Action"]}
      empty="No expenses found."
      rows={expenses.map((expense) => {
        const taxPct = expense.amount && Number(expense.amount) > 0 ? Math.round((Number(expense.taxAmount || 0) / Number(expense.amount)) * 100) : 0;
        const total = Number(expense.amount || 0) + Number(expense.taxAmount || 0);
        return [
          formatDate(expense.date),
          expense.category,
          expense.vendorName || "-",
          `Rs ${money(Number(expense.amount || 0))}`,
          `${taxPct}%`,
          `Rs ${money(Number(expense.taxAmount || 0))}`,
          <strong>Rs {money(total)}</strong>,
          expense.paidFrom,
          expense.attachmentUrl ? (
            <a href={expense.attachmentUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--brand-action)", fontSize: 12, textDecoration: "underline" }}>
              View
            </a>
          ) : (
            "-"
          ),
          expense.journalEntryId?.entryNumber || "-",
          <div key="actions" style={{ display: "flex", gap: 4 }}>
            <button type="button" className="btn-lims-secondary" onClick={() => onEdit(expense)} style={{ height: 36, padding: "0 10px", fontSize: 12 }}>{Icons.edit}</button>
            <button type="button" className="btn-icon-delete" onClick={() => onDelete(expense._id)}>{Icons.trash}</button>
          </div>,
        ];
      })}
    />
  );
}

function CategorySelectWithActions({ categories, value, onChange, onCategoriesChange, loadingCategories, savingCategory }) {
  const [showInput, setShowInput] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (showInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showInput]);

  const handleAdd = async () => {
    const name = inputValue.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (!name) return;
    if (categories.some((c) => c.name.toLowerCase() === name)) return;

    setSavingCategory(true);
    try {
      const res = await fetch("/api/expenses/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create");
      onCategoriesChange((prev) => [...prev, { _id: data.category._id, name }].sort((a, b) => a.name.localeCompare(b.name)));
      setShowInput(false);
      setInputValue("");
      onChange(name);
    } catch (e) {
      alert(e.message);
    } finally {
      setSavingCategory(false);
    }
  };

  const handleSaveEdit = async () => {
    const name = inputValue.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (!name || !editingCategoryId) return;
    if (categories.some((c) => c.name.toLowerCase() === name && c._id !== editingCategoryId)) return;

    setSavingCategory(true);
    try {
      const res = await fetch(`/api/expenses/categories/${editingCategoryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update");
      onCategoriesChange((prev) => prev.map((c) => (c._id === editingCategoryId ? { ...c, name } : c)).sort((a, b) => a.name.localeCompare(b.name)));
      setShowInput(false);
      setEditingCategoryId(null);
      setInputValue("");
      onChange(name);
    } catch (e) {
      alert(e.message);
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDelete = async (catName) => {
    if (categories.length <= 1) return;
    if (!confirm(`Delete category "${catName}"? This cannot be undone.`)) return;

    setSavingCategory(true);
    try {
      const cat = categories.find((c) => c.name === catName);
      const res = await fetch(`/api/expenses/categories/${cat._id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      onCategoriesChange((prev) => prev.filter((c) => c.name !== catName));
      if (value === catName) onChange(categories[0]?.name || "");
    } catch (e) {
      alert(e.message);
    } finally {
      setSavingCategory(false);
    }
  };

  const startAdd = () => {
    setShowInput(true);
    setEditingCategoryId(null);
    setInputValue("");
  };

  const startEdit = (cat) => {
    setShowInput(true);
    setEditingCategoryId(cat._id);
    setInputValue(cat.name);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <select className="lims-input" value={value} onChange={(e) => onChange(e.target.value)} style={{ ...inputStyle(), flex: 1, minWidth: 0 }}>
          {categories.map((cat) => (
            <option key={cat._id} value={cat.name}>
              {cat.name}
            </option>
          ))}
        </select>
        <button type="button" onClick={startAdd} disabled={savingCategory} style={{ width: 30, height: 30, borderRadius: 6, border: "1px solid #a7f3d0", background: "#ecfdf5", color: "#065f46", cursor: "pointer", fontSize: 16, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
        <button type="button" onClick={() => startEdit(categories.find((c) => c.name === value))} disabled={!value || savingCategory} style={{ width: 30, height: 30, borderRadius: 6, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1e40af", cursor: "pointer", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center" }}>✎</button>
        <button type="button" onClick={() => handleDelete(value)} disabled={!value || categories.length <= 1 || savingCategory} style={{ width: 30, height: 30, borderRadius: 6, border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", cursor: "pointer", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
      </div>
      {showInput && (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                editingCategoryId ? handleSaveEdit() : handleAdd();
              }
              if (e.key === "Escape") {
                setShowInput(false);
                setEditingCategoryId(null);
                setInputValue("");
              }
            }}
            className="lims-input"
            placeholder={editingCategoryId ? "Edit category name" : "New category name"}
            style={{ ...inputStyle(), flex: 1, minWidth: 0 }}
            maxLength={50}
          />
          <button type="button" className="btn-lims-primary" disabled={!inputValue.trim() || savingCategory} onClick={editingCategoryId ? handleSaveEdit : handleAdd} style={{ height: 38, padding: "0 12px", fontSize: 12, flexShrink: 0 }}>
            {editingCategoryId ? "Save" : "Add"}
          </button>
          <button type="button" className="btn-lims-secondary" onClick={() => { setShowInput(false); setEditingCategoryId(null); setInputValue(""); }} style={{ height: 38, padding: "0 12px", fontSize: 12, flexShrink: 0 }}>Cancel</button>
        </div>
      )}
    </div>
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
  const [formErrorsEdit, setFormErrorsEdit] = useState({});
  const [viewMode, setViewMode] = useState("form");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [creditFilter, setCreditFilter] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [savingCategory, setSavingCategory] = useState(false);

  async function fetchJson(url, options) {
    const response = await fetch(url, { cache: "no-store", ...options });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  const loadCategories = useCallback(async () => {
    setLoadingCategories(true);
    try {
      const data = await fetchJson("/api/expenses/categories");
      const cats = data.categories || [];
      if (cats.length > 0) {
        setCategories(cats);
      }
    } catch (err) {
      console.error("Failed to load categories", err);
    } finally {
      setLoadingCategories(false);
    }
  }, []);

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

  useEffect(() => {
    loadCategories();
    loadData();
  }, [loadCategories, loadData]);

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
      setDeleteTarget(null);
    }
  }

  const filteredExpenses = expenses.filter((expense) => {
    const q = searchQuery.trim().toLowerCase();
    const vendor = String(expense.vendorName || "").toLowerCase();
    const category = String(expense.category || "").toLowerCase();
    const journal = String(expense.journalEntryId?.entryNumber || "").toLowerCase();

    if (q && !vendor.includes(q) && !category.includes(q) && !journal.includes(q)) return false;
    if (categoryFilter && expense.category !== categoryFilter) return false;
    if (creditFilter && expense.paidFrom !== creditFilter) return false;
    return true;
  });

  return (
    <div style={{ display: "grid", gap: 18 }}>
      {error && <div style={{ padding: "10px 14px", borderRadius: 8, background: "#fef2f2", color: "#b91c1c", fontSize: 13, fontWeight: 700 }}>{error}</div>}
      <SuccessDialog message={success} onClose={() => setSuccess("")} />

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>View:</span>
        <div style={{ display: "flex", background: "var(--border-light)", padding: 3, borderRadius: 8 }}>
          <button type="button" onClick={() => setViewMode("form")} style={{ padding: "6px 12px", borderRadius: 6, border: "none", background: viewMode === "form" ? "#fff" : "transparent", color: viewMode === "form" ? "var(--brand-action)" : "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, transition: "all 0.2s", boxShadow: viewMode === "form" ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18" /><path d="M3 9h18" /></svg>
            Form
          </button>
          <button type="button" onClick={() => setViewMode("list")} style={{ padding: "6px 12px", borderRadius: 6, border: "none", background: viewMode === "list" ? "#fff" : "transparent", color: viewMode === "list" ? "var(--brand-action)" : "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, transition: "all 0.2s", boxShadow: viewMode === "list" ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>
            List
          </button>
        </div>
      </div>

      {viewMode === "form" && (
        <form className="form-card" onSubmit={handleSubmit} style={{ padding: 20, borderRadius: 8, display: "grid", gap: 12, gridTemplateColumns: "repeat(2, 1fr)" }}>
          <h5 style={{ margin: 0, fontSize: 16, gridColumn: "1 / -1" }}>Record Expense</h5>

          <Field label="Category" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <CategorySelectWithActions
              categories={categories}
              value={form.category}
              onChange={(v) => setForm({ ...form, category: v })}
              onCategoriesChange={setCategories}
              loadingCategories={loadingCategories}
              savingCategory={savingCategory}
            />
            {categories.length === 0 && <small style={{ color: "var(--text-muted)", fontSize: 11 }}>Loading categories...</small>}
          </Field>

          <Field label="Vendor" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <input required className="lims-input" minLength={3} maxLength={30} value={form.vendorName} onChange={(e) => { const v = sanitizeVendorName(e.target.value); setFormErrors((p) => ({ ...p, vendorName: "" })); setForm({ ...form, vendorName: v }); }} style={inputStyle()} />
            {formErrors.vendorName && <small style={{ color: "var(--error)", fontSize: 10, display: "block", marginTop: 2 }}>{formErrors.vendorName}</small>}
          </Field>

          <Field label="Amount" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <input required className="lims-input no-spinner" inputMode="numeric" maxLength={7} value={form.amount} onChange={(e) => { const v = sanitizeAmountInput(e.target.value); setFormErrors((p) => ({ ...p, amount: "" })); setForm({ ...form, amount: v }); }} style={inputStyle()} />
            {formErrors.amount && <small style={{ color: "var(--error)", fontSize: 10, display: "block", marginTop: 2 }}>{formErrors.amount}</small>}
          </Field>

          <Field label="Tax (%)" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <input className="lims-input no-spinner" inputMode="numeric" maxLength={2} value={form.taxPercentage} onChange={(e) => { const v = sanitizeAmountInput(e.target.value); if (Number(v) > 90) return; setFormErrors((p) => ({ ...p, taxPercentage: "" })); setForm({ ...form, taxPercentage: v }); }} style={inputStyle()} placeholder="0-90" />
            {form.taxPercentage && form.amount ? <small style={{ color: "var(--text-secondary)", fontSize: 10, display: "block", marginTop: 2 }}>Tax Amount: Rs {Math.round(Number(form.amount) * Number(form.taxPercentage) / 100)}</small> : null}
            {formErrors.taxPercentage && <small style={{ color: "var(--error)", fontSize: 10, display: "block", marginTop: 2 }}>{formErrors.taxPercentage}</small>}
          </Field>

          <Field label="Credit Mode" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <select className="lims-input" value={form.paidFrom} onChange={(e) => setForm({ ...form, paidFrom: e.target.value })} style={inputStyle()}>
              <option value="vendor-payable">Vendor Payable</option>
              <option value="cash">Cash</option>
              <option value="bank">Bank</option>
            </select>
          </Field>

          <Field label="Receipt URL" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <input className="lims-input" type="url" maxLength={500} value={form.attachmentUrl} onChange={(e) => { const v = e.target.value; if (v && !isValidUrl(v)) { setFormErrors((p) => ({ ...p, attachmentUrl: "Enter a valid URL (http:// or https://)" })); } else { setFormErrors((p) => ({ ...p, attachmentUrl: "" })); } setForm({ ...form, attachmentUrl: v }); }} style={inputStyle()} placeholder="https://" />
            {formErrors.attachmentUrl && <small style={{ color: "var(--error)", fontSize: 10, display: "block", marginTop: 2 }}>{formErrors.attachmentUrl}</small>}
          </Field>

          <button className="btn-lims-primary" disabled={saving} style={{ height: 38, gridColumn: "1 / -1" }}>{saving ? "Posting..." : "Record Expense"}</button>
        </form>
      )}

      {viewMode === "list" && (
        loading ? (
          <div className="form-card" style={{ padding: 28, borderRadius: 8 }}>Loading expenses...</div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
              <div style={{ position: "relative", minWidth: 280, flex: "0 1 360px" }}>
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}>{Icons.search}</span>
                <input className="lims-input" placeholder="Search by vendor, category, or journal..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ ...inputStyle(), paddingLeft: 38 }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
              <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 600 }}>Category:</span>
              <select className="lims-input" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{ ...inputStyle(), width: "auto", minWidth: 140 }}>
                <option value="">All</option>
                {categories.map((cat) => <option key={cat._id} value={cat.name}>{cat.name}</option>)}
              </select>
              <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 600 }}>Credit Mode:</span>
              <select className="lims-input" value={creditFilter} onChange={(e) => setCreditFilter(e.target.value)} style={{ ...inputStyle(), width: "auto", minWidth: 160 }}>
                <option value="">All</option>
                <option value="vendor-payable">Vendor Payable</option>
                <option value="cash">Cash</option>
                <option value="bank">Bank</option>
              </select>
              <DownloadDropdown
                onDownload={async (format) => {
                  const params = new URLSearchParams({ export: format });
                  if (categoryFilter) params.set("category", categoryFilter);
                  if (creditFilter) params.set("paidFrom", creditFilter);
                  const res = await fetch(`/api/expenses?${params}`, { credentials: "include" });
                  if (!res.ok) throw new Error("Download failed");
                  const blob = await res.blob();
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = `expenses.${format}`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(a.href);
                }}
              />
            </div>
            <ExpensesTable
              expenses={filteredExpenses}
              onEdit={(exp) => {
                const taxPct = exp.amount && Number(exp.amount) > 0 ? Math.round((Number(exp.taxAmount || 0) / Number(exp.amount)) * 100) : 0;
                setEditForm({ ...exp, amount: String(exp.amount ?? ""), taxPercentage: taxPct > 0 ? String(taxPct) : "" });
                setEditingId(exp._id);
              }}
              onDelete={(id) => {
                const expense = expenses.find((item) => item._id === id);
                setDeleteTarget({ _id: id, label: expense?.vendorName || expense?.category || "this expense" });
              }}
            />
            <PaginationControls pagination={pagination} loading={loading} onPageChange={setPage} />
          </>
        )
      )}

      {editingId && (
        <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "grid", placeItems: "center", zIndex: 1000 }} onClick={() => setEditingId(null)}>
          <div className="form-card" style={{ padding: 24, borderRadius: 12, maxWidth: 500, width: "90%", display: "grid", gap: 12 }} onClick={(e) => e.stopPropagation()}>
            <h5 style={{ margin: 0, fontSize: 16 }}>Edit Expense</h5>
            <Field label="Category" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <select className="lims-input" value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} style={inputStyle()}>
                {categories.map((cat) => <option key={cat._id} value={cat.name}>{cat.name}</option>)}
              </select>
            </Field>
            <Field label="Vendor" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <input required className="lims-input" minLength={3} maxLength={30} value={editForm.vendorName} onChange={(e) => { const v = sanitizeVendorName(e.target.value); setFormErrorsEdit((p) => ({ ...p, vendorName: "" })); setEditForm({ ...editForm, vendorName: v }); }} style={inputStyle()} />
              {formErrorsEdit.vendorName && <small style={{ color: "var(--error)", fontSize: 10, display: "block", marginTop: 2 }}>{formErrorsEdit.vendorName}</small>}
            </Field>
            <Field label="Amount" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <input required className="lims-input no-spinner" inputMode="numeric" maxLength={7} value={editForm.amount} onChange={(e) => { const v = sanitizeAmountInput(e.target.value); setFormErrorsEdit((p) => ({ ...p, amount: "" })); setEditForm({ ...editForm, amount: v }); }} style={inputStyle()} />
              {formErrorsEdit.amount && <small style={{ color: "var(--error)", fontSize: 10, display: "block", marginTop: 2 }}>{formErrorsEdit.amount}</small>}
            </Field>
            <Field label="Tax (%)" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <input className="lims-input no-spinner" inputMode="numeric" maxLength={2} value={editForm.taxPercentage} onChange={(e) => { const v = sanitizeAmountInput(e.target.value); if (Number(v) > 90) return; setFormErrorsEdit((p) => ({ ...p, taxPercentage: "" })); setEditForm({ ...editForm, taxPercentage: v }); }} style={inputStyle()} placeholder="0-90" />
              {editForm.taxPercentage && editForm.amount ? <small style={{ color: "var(--text-secondary)", fontSize: 10, display: "block", marginTop: 2 }}>Tax Amount: Rs {Math.round(Number(editForm.amount) * Number(editForm.taxPercentage) / 100)}</small> : null}
              {formErrorsEdit.taxPercentage && <small style={{ color: "var(--error)", fontSize: 10, display: "block", marginTop: 2 }}>{formErrorsEdit.taxPercentage}</small>}
            </Field>
            <Field label="Credit Mode" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <select className="lims-input" value={editForm.paidFrom} onChange={(e) => setEditForm({ ...editForm, paidFrom: e.target.value })} style={inputStyle()}>
                <option value="vendor-payable">Vendor Payable</option>
                <option value="cash">Cash</option>
                <option value="bank">Bank</option>
              </select>
            </Field>
            <Field label="Receipt URL" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <input className="lims-input" type="url" maxLength={500} value={editForm.attachmentUrl} onChange={(e) => { const v = e.target.value; if (v && !isValidUrl(v)) { setFormErrorsEdit((p) => ({ ...p, attachmentUrl: "Enter a valid URL (http:// or https://)" })); } else { setFormErrorsEdit((p) => ({ ...p, attachmentUrl: "" })); } setEditForm({ ...editForm, attachmentUrl: v }); }} style={inputStyle()} placeholder="https://" />
              {formErrorsEdit.attachmentUrl && <small style={{ color: "var(--error)", fontSize: 10, display: "block", marginTop: 2 }}>{formErrorsEdit.attachmentUrl}</small>}
            </Field>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button type="button" className="btn-lims-secondary" onClick={() => setEditingId(null)} style={{ flex: 1, height: 38 }}>Cancel</button>
              <button type="button" className="btn-lims-primary" disabled={saving} onClick={() => {
                const errs = {};
                if (!editForm.vendorName) errs.vendorName = "Vendor is required";
                else if (editForm.vendorName.length < 3) errs.vendorName = "Vendor name must be at least 3 characters";
                if (editForm.amount === "" || editForm.amount === undefined || editForm.amount === null) errs.amount = "Amount is required";
                if (editForm.attachmentUrl && !isValidUrl(editForm.attachmentUrl)) errs.attachmentUrl = "Enter a valid URL (http:// or https://)";
                setFormErrorsEdit((p) => ({ ...p, ...errs }));
                if (Object.keys(errs).length) return;
                const taxAmount = editForm.taxPercentage && editForm.amount ? Math.round(Number(editForm.amount) * Number(editForm.taxPercentage) / 100) : 0;
                updateExpense(editingId, { category: editForm.category, vendorName: editForm.vendorName, amount: editForm.amount, taxAmount: String(taxAmount), paidFrom: editForm.paidFrom, attachmentUrl: editForm.attachmentUrl });
              }} style={{ flex: 1, height: 38 }}>{saving ? "Saving..." : "Save"}</button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "grid", placeItems: "center", zIndex: 1000 }} onClick={() => { if (!saving) setDeleteTarget(null); }}>
          <div className="form-card" style={{ padding: 24, borderRadius: 12, maxWidth: 400, width: "90%", display: "grid", gap: 16, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 28, color: "var(--error, #b91c1c)" }}>{Icons.trash}</div>
            <div>
              <h5 style={{ margin: 0, fontSize: 16 }}>Delete Expense</h5>
              <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
                Are you sure you want to delete <strong>"{deleteTarget.label}"</strong>? This action cannot be undone.
              </p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn-lims-secondary" onClick={() => setDeleteTarget(null)} disabled={saving} style={{ flex: 1, height: 38 }}>Cancel</button>
              <button type="button" className="btn-lims-primary" style={{ flex: 1, height: 38, background: "var(--error, #b91c1c)", borderColor: "var(--error, #b91c1c)" }} disabled={saving} onClick={() => deleteExpense(deleteTarget._id)}>{saving ? "Deleting..." : "Delete"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}