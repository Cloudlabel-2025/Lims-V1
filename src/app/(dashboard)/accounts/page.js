"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Icons } from "@/app/components/Icons";
import SuccessDialog from "@/app/components/SuccessDialog";

const emptyAccount = { code: "", name: "", type: "asset", subtype: "" };
const emptyExpense = { category: "reagent", vendorName: "", amount: "", taxAmount: "", paidFrom: "vendor-payable", attachmentUrl: "" };
const emptyCorporate = { name: "", contactPerson: "", creditLimit: "", statementCycle: "monthly" };
const emptyJournal = {
  description: "",
  lines: [
    { accountId: "", debit: "", credit: "" },
    { accountId: "", debit: "", credit: "" },
  ],
};

function money(value) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function isExponential(value) {
  return typeof value === "string" && /[eE]/.test(value);
}

function hasUrl(value) {
  return /https?:\/\//.test(value);
}

function isValidName(value) {
  return /^[A-Za-z0-9 .&'\/,()@_-]*$/.test(value);
}

function inputStyle() {
  return { height: 38, fontSize: 13 };
}

function Field({ label, children }) {
  return (
    <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>
      {label}
      {children}
    </label>
  );
}

function Badge({ children, tone = "neutral" }) {
  const colors = {
    neutral: ["var(--surface)", "var(--text-secondary)"],
    good: ["#ecfdf5", "#047857"],
    warn: ["#fffbeb", "#b45309"],
    info: ["#eff6ff", "#1d4ed8"],
  };
  const [background, color] = colors[tone] || colors.neutral;
  return (
    <span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 6, background, color, fontSize: 12, fontWeight: 800 }}>
      {children}
    </span>
  );
}

function StatCard({ label, value, icon }) {
  return (
    <div className="form-card" style={{ padding: 18, borderRadius: 8, minHeight: 98 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 800 }}>{label}</div>
          <div style={{ marginTop: 8, fontSize: 23, fontWeight: 900, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
        </div>
        <div style={{ width: 42, height: 42, borderRadius: 8, display: "grid", placeItems: "center", border: "1px solid var(--border)", color: "var(--brand-action, var(--primary))" }}>
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function AccountsPage() {
  const [activeTab, setActiveTab] = useState("accounts");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [journalEntries, setJournalEntries] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [corporates, setCorporates] = useState([]);
  const [pl, setPl] = useState(null);
  const [plFilter, setPlFilter] = useState({ from: "", to: "" });
  const [plLoading, setPlLoading] = useState(false);
  const [accountForm, setAccountForm] = useState(emptyAccount);
  const [expenseForm, setExpenseForm] = useState(emptyExpense);
  const [corporateForm, setCorporateForm] = useState(emptyCorporate);
  const [journalForm, setJournalForm] = useState(emptyJournal);
  const [ledgerFilter, setLedgerFilter] = useState({ sourceType: "all", accountId: "" });
  const [ledgerPage, setLedgerPage] = useState(1);
  const [expensePage, setExpensePage] = useState(1);
  const [ledgerPagination, setLedgerPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });
  const [expensePagination, setExpensePagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });
  const [editingCorporate, setEditingCorporate] = useState(null);
  const [editingExpense, setEditingExpense] = useState(null);
  const [corporateFormEdit, setCorporateFormEdit] = useState(emptyCorporate);
  const [expenseFormEdit, setExpenseFormEdit] = useState(emptyExpense);
  const [accountFormErrors, setAccountFormErrors] = useState({});
  const [expenseFormErrors, setExpenseFormErrors] = useState({});
  const [corporateFormErrors, setCorporateFormErrors] = useState({});
  const [plError, setPlError] = useState("");

  const accountById = useMemo(() => new Map(accounts.map((account) => [account._id, account])), [accounts]);
  const totals = useMemo(
    () =>
      accounts.reduce(
        (sum, account) => {
          sum[account.type] = (sum[account.type] || 0) + Number(account.balance || 0);
          return sum;
        },
        { asset: 0, liability: 0, revenue: 0, expense: 0 }
      ),
    [accounts]
  );
  const manualDebit = journalForm.lines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
  const manualCredit = journalForm.lines.reduce((sum, line) => sum + Number(line.credit || 0), 0);
  const manualBalanced = manualDebit > 0 && Math.round(manualDebit * 100) === Math.round(manualCredit * 100);

  async function fetchJson(url, options) {
    const response = await fetch(url, { cache: "no-store", ...options });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  const loadAccountsData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const ledgerQuery = new URLSearchParams();
      if (ledgerFilter.sourceType !== "all") ledgerQuery.set("sourceType", ledgerFilter.sourceType);
      if (ledgerFilter.accountId) ledgerQuery.set("accountId", ledgerFilter.accountId);
      ledgerQuery.set("page", ledgerPage);
      ledgerQuery.set("limit", "50");
      const [accountData, ledgerData, expenseData, corporateData] = await Promise.all([
        fetchJson("/api/accounting/accounts"),
        fetchJson(`/api/accounting/journal-entries?${ledgerQuery.toString()}`),
        fetchJson(`/api/expenses?page=${expensePage}&limit=50`),
        fetchJson("/api/corporate-accounts"),
      ]);
      setAccounts(accountData.accounts || []);
      setJournalEntries(ledgerData.journalEntries || []);
      setExpenses(expenseData.expenses || []);
      setCorporates(corporateData.corporateAccounts || []);
      setLedgerPagination(ledgerData.pagination || { page: ledgerPage, limit: 50, total: ledgerData.journalEntries?.length || 0, totalPages: 1 });
      setExpensePagination(expenseData.pagination || { page: expensePage, limit: 50, total: expenseData.expenses?.length || 0, totalPages: 1 });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [expensePage, ledgerFilter.accountId, ledgerFilter.sourceType, ledgerPage]);

  useEffect(() => {
    loadAccountsData();
  }, [loadAccountsData]);

  async function submitForm(event, url, payload, reset, successMessage = "Action completed successfully.") {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await fetchJson(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      reset();
      setSuccess(successMessage);
      await loadAccountsData();
    } catch (err) {
      console.error("Submit error:", err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteAccount(accountId) {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await fetchJson(`/api/accounting/accounts/${accountId}`, { method: "DELETE" });
      setSuccess("Account deleted successfully.");
      await loadAccountsData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function updateCorporate(corporateId, payload) {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await fetchJson(`/api/corporate-accounts/${corporateId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      setEditingCorporate(null);
      setSuccess("Corporate account updated successfully.");
      await loadAccountsData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteCorporate(corporateId, name) {
    if (!confirm(`Delete corporate account "${name}"? This action cannot be undone.`)) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await fetchJson(`/api/corporate-accounts/${corporateId}`, { method: "DELETE" });
      setSuccess("Corporate account deleted successfully.");
      await loadAccountsData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function updateExpense(expenseId, payload) {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await fetchJson(`/api/expenses/${expenseId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      setEditingExpense(null);
      setSuccess("Expense updated successfully.");
      await loadAccountsData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteExpense(expenseId) {
    if (!confirm("Delete this expense? This action cannot be undone.")) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await fetchJson(`/api/expenses/${expenseId}`, { method: "DELETE" });
      setSuccess("Expense deleted successfully.");
      await loadAccountsData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function updateJournalLine(index, patch) {
    setJournalForm((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)),
    }));
  }

  function removeJournalLine(index) {
    setJournalForm((current) => ({
      ...current,
      lines: current.lines.filter((_, i) => i !== index),
    }));
  }

  async function loadPl(from, to) {
    setPlError("");
    if (from && to && new Date(from) > new Date(to)) {
      setPlError("To date must be after From date");
      return;
    }
    setPlLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const data = await fetchJson(`/api/accounting/pl?${params.toString()}`);
      setPl(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setPlLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === "pl" && !pl) loadPl("", "");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const tabs = [
    ["accounts", "Chart", Icons.grid],
    ["ledger", "Ledger", Icons.list],
    ["pl", "P&L", Icons.barChart],
    ["manual", "Manual", Icons.edit],
    ["expenses", "Expenses", Icons.activity],
    ["corporate", "Corporate", Icons.users],
  ];

  return (
    <div className="patients-page" style={{ paddingBottom: 40 }}>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 18, flexWrap: "wrap", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div className="page-header-icon" style={{ background: "var(--brand-surface, #e6f0fa)", color: "var(--brand-action, var(--primary))", padding: 12, borderRadius: 8 }}>
            {Icons.barChart}
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: 20, color: "var(--text-main)" }}>Accounts</h4>
            <small style={{ color: "var(--text-muted)" }}>Chart of accounts, journals, expenses, and corporate ledgers</small>
          </div>
        </div>
        <button type="button" className="btn-lims-secondary" onClick={loadAccountsData} style={{ height: 38, padding: "0 14px", borderRadius: 8 }}>
          Refresh
        </button>
      </div>

      {error && <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 8, background: "#fef2f2", color: "#b91c1c", fontSize: 13, fontWeight: 800 }}>{error}</div>}
      <SuccessDialog message={success} onClose={() => setSuccess("")} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14, marginBottom: 18 }}>
        <StatCard label="Assets" value={`Rs ${money(totals.asset)}`} icon={Icons.barChart} />
        <StatCard label="Liabilities" value={`Rs ${money(totals.liability)}`} icon={Icons.list} />
        <StatCard label="Revenue" value={`Rs ${money(totals.revenue)}`} icon={Icons.activity} />
        <StatCard label="Expenses" value={`Rs ${money(totals.expense)}`} icon={Icons.flask} />
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        {tabs.map(([key, label, icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={activeTab === key ? "btn-lims-primary" : "btn-lims-secondary"}
            style={{ height: 38, padding: "0 12px", display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 8, fontSize: 13 }}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="form-card" style={{ padding: 28, borderRadius: 8 }}>Loading accounts...</div>
      ) : (
        <>
          {activeTab === "accounts" && (
            <TwoColumn
              left={
                <form className="form-card" onSubmit={(event) => submitForm(event, "/api/accounting/accounts", accountForm, () => { setAccountForm(emptyAccount); setAccountFormErrors({}); }, "Account created successfully.")} style={{ padding: 20, borderRadius: 8, display: "grid", gap: 12 }}>
                  <h5 style={{ margin: 0, fontSize: 16 }}>Add Account</h5>
                  <Field label="Code">
                    <input required className="lims-input" value={accountForm.code} onChange={(e) => { const v = e.target.value; if (isExponential(v)) { setAccountFormErrors((p) => ({ ...p, code: "Exponential notation is not allowed" })); return; } if (v && !isValidName(v)) { setAccountFormErrors((p) => ({ ...p, code: "Code contains invalid characters" })); return; } setAccountFormErrors((p) => ({ ...p, code: "" })); setAccountForm({ ...accountForm, code: v }); }} style={inputStyle()} />
                    {accountFormErrors.code && <small style={{ color: "var(--error)", fontSize: 10, display: "block", marginTop: 2 }}>{accountFormErrors.code}</small>}
                  </Field>
                  <Field label="Name">
                    <input required className="lims-input" value={accountForm.name} onChange={(e) => { const v = e.target.value; if (hasUrl(v)) { setAccountFormErrors((p) => ({ ...p, name: "URLs are not allowed" })); return; } if (v && !isValidName(v)) { setAccountFormErrors((p) => ({ ...p, name: "Name contains invalid characters" })); return; } setAccountFormErrors((p) => ({ ...p, name: "" })); setAccountForm({ ...accountForm, name: v }); }} style={inputStyle()} />
                    {accountFormErrors.name && <small style={{ color: "var(--error)", fontSize: 10, display: "block", marginTop: 2 }}>{accountFormErrors.name}</small>}
                  </Field>
                  <Field label="Type">
                    <select className="lims-input" value={accountForm.type} onChange={(event) => setAccountForm({ ...accountForm, type: event.target.value })} style={inputStyle()}>
                      {["asset", "liability", "equity", "revenue", "expense"].map((type) => <option key={type} value={type}>{type}</option>)}
                    </select>
                  </Field>
                  <Field label="Subtype">
                    <input required className="lims-input" value={accountForm.subtype} onChange={(e) => { const v = e.target.value; if (hasUrl(v)) { setAccountFormErrors((p) => ({ ...p, subtype: "URLs are not allowed" })); return; } if (v && !isValidName(v)) { setAccountFormErrors((p) => ({ ...p, subtype: "Subtype contains invalid characters" })); return; } setAccountFormErrors((p) => ({ ...p, subtype: "" })); setAccountForm({ ...accountForm, subtype: v }); }} style={inputStyle()} />
                    {accountFormErrors.subtype && <small style={{ color: "var(--error)", fontSize: 10, display: "block", marginTop: 2 }}>{accountFormErrors.subtype}</small>}
                  </Field>
                  <button className="btn-lims-primary" disabled={saving} style={{ height: 38 }}>{saving ? "Saving..." : "Create Account"}</button>
                </form>
              }
              right={<AccountsTable accounts={accounts} onDelete={deleteAccount} />}
            />
          )}

          {activeTab === "ledger" && (
            <div style={{ display: "grid", gap: 14 }}>
              <div className="form-card" style={{ padding: 14, borderRadius: 8, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                <Field label="Source">
                  <select className="lims-input" value={ledgerFilter.sourceType} onChange={(event) => { setLedgerFilter({ ...ledgerFilter, sourceType: event.target.value }); setLedgerPage(1); }} style={inputStyle()}>
                    {["all", "billing", "payment", "refund", "commission", "expense", "manual"].map((source) => <option key={source} value={source}>{source}</option>)}
                  </select>
                </Field>
                <Field label="Account">
                  <select className="lims-input" value={ledgerFilter.accountId} onChange={(event) => { setLedgerFilter({ ...ledgerFilter, accountId: event.target.value }); setLedgerPage(1); }} style={inputStyle()}>
                    <option value="">All accounts</option>
                    {accounts.map((account) => <option key={account._id} value={account._id}>{account.code} - {account.name}</option>)}
                  </select>
                </Field>
              </div>
              <LedgerTable entries={journalEntries} />
              <PaginationControls pagination={ledgerPagination} loading={loading} onPageChange={setLedgerPage} />
            </div>
          )}

          {activeTab === "pl" && (
            <div style={{ display: "grid", gap: 14 }}>
              <div className="form-card" style={{ padding: 14, borderRadius: 8, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, alignItems: "end" }}>
                <Field label="From">
                  <input type="date" className="lims-input" value={plFilter.from} onChange={(e) => { setPlFilter({ ...plFilter, from: e.target.value }); setPlError(""); }} style={inputStyle()} />
                </Field>
                <Field label="To">
                  <input type="date" className="lims-input" value={plFilter.to} onChange={(e) => { setPlFilter({ ...plFilter, to: e.target.value }); setPlError(""); }} style={inputStyle()} />
                </Field>
                <button type="button" className="btn-lims-primary" onClick={() => loadPl(plFilter.from, plFilter.to)} style={{ height: 38 }}>
                  {plLoading ? "Loading..." : "Apply"}
                </button>
              </div>
              {plError && <div style={{ padding: "10px 14px", borderRadius: 8, background: "#fef2f2", color: "#b91c1c", fontSize: 13, fontWeight: 700 }}>{plError}</div>}
              {pl && <PlStatement pl={pl} />}
            </div>
          )}

          {activeTab === "manual" && (
            <form className="form-card" onSubmit={(event) => submitForm(event, "/api/accounting/journal-entries", journalForm, () => setJournalForm(emptyJournal), "Manual journal posted successfully.")} style={{ padding: 20, borderRadius: 8, display: "grid", gap: 14 }}>
              <h5 style={{ margin: 0, fontSize: 16 }}>Manual Journal</h5>
              <Field label="Description"><input required className="lims-input" value={journalForm.description} onChange={(event) => setJournalForm({ ...journalForm, description: event.target.value })} style={inputStyle()} /></Field>
              <div style={{ display: "grid", gap: 10 }}>
                {journalForm.lines.map((line, index) => (
                  <div key={index} style={{ display: "grid", gridTemplateColumns: "minmax(220px, 1fr) 140px 140px 40px", gap: 10, alignItems: "center" }}>
                    <select required className="lims-input" value={line.accountId} onChange={(event) => updateJournalLine(index, { accountId: event.target.value })} style={inputStyle()}>
                      <option value="">Select account</option>
                      {accounts.map((account) => <option key={account._id} value={account._id}>{account.code} - {account.name}</option>)}
                    </select>
                    <input className="lims-input" type="number" min="0" step="0.01" placeholder="Debit" value={line.debit} onChange={(event) => updateJournalLine(index, { debit: event.target.value })} style={inputStyle()} />
                    <input className="lims-input" type="number" min="0" step="0.01" placeholder="Credit" value={line.credit} onChange={(event) => updateJournalLine(index, { credit: event.target.value })} style={inputStyle()} />
                    {journalForm.lines.length > 2 && (
                      <button type="button" onClick={() => removeJournalLine(index)} style={{ height: 30, width: 30, border: "none", background: "transparent", cursor: "pointer", color: "#e11d48", display: "grid", placeItems: "center", padding: 0 }}>{Icons.trash}</button>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
                <button type="button" className="btn-lims-secondary" onClick={() => setJournalForm({ ...journalForm, lines: [...journalForm.lines, { accountId: "", debit: "", credit: "" }] })} style={{ height: 36 }}>
                  {Icons.plus} Line
                </button>
                <div style={{ fontSize: 13, fontWeight: 800 }}>
                  Debit Rs {money(manualDebit)} / Credit Rs {money(manualCredit)} <Badge tone={manualBalanced ? "good" : "warn"}>{manualBalanced ? "Balanced" : "Open"}</Badge>
                </div>
              </div>
              <button className="btn-lims-primary" disabled={saving || !manualBalanced} style={{ height: 38 }}>{saving ? "Posting..." : "Post Journal"}</button>
            </form>
          )}

          {activeTab === "expenses" && (
            <div style={{ display: "grid", gap: 18 }}>
              <TwoColumn
                left={
                  <form className="form-card" onSubmit={(event) => submitForm(event, "/api/expenses", expenseForm, () => { setExpenseForm(emptyExpense); setExpenseFormErrors({}); }, "Expense recorded successfully.")} style={{ padding: 20, borderRadius: 8, display: "grid", gap: 12 }}>
                    <h5 style={{ margin: 0, fontSize: 16 }}>Record Expense</h5>
                    <Field label="Category">
                      <select className="lims-input" value={expenseForm.category} onChange={(event) => setExpenseForm({ ...expenseForm, category: event.target.value })} style={inputStyle()}>
                        {["reagent", "staff", "equipment", "overhead"].map((category) => <option key={category} value={category}>{category}</option>)}
                      </select>
                    </Field>
                    <Field label="Vendor">
                      <input required className="lims-input" value={expenseForm.vendorName} onChange={(e) => { const v = e.target.value; if (hasUrl(v)) { setExpenseFormErrors((p) => ({ ...p, vendorName: "URLs are not allowed" })); return; } if (v && !isValidName(v)) { setExpenseFormErrors((p) => ({ ...p, vendorName: "Vendor name contains invalid characters" })); return; } setExpenseFormErrors((p) => ({ ...p, vendorName: "" })); setExpenseForm({ ...expenseForm, vendorName: v }); }} style={inputStyle()} />
                      {expenseFormErrors.vendorName && <small style={{ color: "var(--error)", fontSize: 10, display: "block", marginTop: 2 }}>{expenseFormErrors.vendorName}</small>}
                    </Field>
                    <Field label="Amount">
                      <input required className="lims-input" type="number" min="0.01" step="0.01" value={expenseForm.amount} onChange={(e) => { const v = e.target.value; if (isExponential(v)) { setExpenseFormErrors((p) => ({ ...p, amount: "Exponential notation is not allowed" })); return; } setExpenseFormErrors((p) => ({ ...p, amount: "" })); setExpenseForm({ ...expenseForm, amount: v }); }} style={inputStyle()} />
                      {expenseFormErrors.amount && <small style={{ color: "var(--error)", fontSize: 10, display: "block", marginTop: 2 }}>{expenseFormErrors.amount}</small>}
                    </Field>
                    <Field label="Tax">
                      <input required className="lims-input" type="number" min="0" step="0.01" value={expenseForm.taxAmount} onChange={(e) => { const v = e.target.value; if (isExponential(v)) { setExpenseFormErrors((p) => ({ ...p, taxAmount: "Exponential notation is not allowed" })); return; } setExpenseFormErrors((p) => ({ ...p, taxAmount: "" })); setExpenseForm({ ...expenseForm, taxAmount: v }); }} style={inputStyle()} />
                      {expenseFormErrors.taxAmount && <small style={{ color: "var(--error)", fontSize: 10, display: "block", marginTop: 2 }}>{expenseFormErrors.taxAmount}</small>}
                    </Field>
                    <Field label="Credit">
                      <select className="lims-input" value={expenseForm.paidFrom} onChange={(event) => setExpenseForm({ ...expenseForm, paidFrom: event.target.value })} style={inputStyle()}>
                        <option value="vendor-payable">Vendor Payable</option>
                        <option value="cash">Cash</option>
                        <option value="bank">Bank</option>
                      </select>
                    </Field>
                    <Field label="Receipt URL"><input className="lims-input" value={expenseForm.attachmentUrl} onChange={(event) => setExpenseForm({ ...expenseForm, attachmentUrl: event.target.value })} style={inputStyle()} /></Field>
                    <button className="btn-lims-primary" disabled={saving} style={{ height: 38 }}>{saving ? "Posting..." : "Record Expense"}</button>
                  </form>
                }
                right={
                  <div style={{ display: "grid", gap: 12 }}>
                    <ExpensesTable
                      expenses={expenses}
                      onEdit={(exp) => { setExpenseFormEdit(exp); setEditingExpense(exp._id); }}
                      onDelete={deleteExpense}
                    />
                    <PaginationControls pagination={expensePagination} loading={loading} onPageChange={setExpensePage} />
                  </div>
                }
              />
              {editingExpense && (
                <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "grid", placeItems: "center", zIndex: 1000 }} onClick={() => setEditingExpense(null)}>
                  <div className="form-card" style={{ padding: 24, borderRadius: 12, maxWidth: 440, width: "90%", display: "grid", gap: 12 }} onClick={(e) => e.stopPropagation()}>
                    <h5 style={{ margin: 0, fontSize: 16 }}>Edit Expense</h5>
                    <Field label="Category">
                      <select className="lims-input" value={expenseFormEdit.category} onChange={(e) => setExpenseFormEdit({ ...expenseFormEdit, category: e.target.value })} style={inputStyle()}>
                        {["reagent", "staff", "equipment", "overhead"].map((category) => <option key={category} value={category}>{category}</option>)}
                      </select>
                    </Field>
                    <Field label="Vendor"><input required className="lims-input" value={expenseFormEdit.vendorName} onChange={(e) => setExpenseFormEdit({ ...expenseFormEdit, vendorName: e.target.value })} style={inputStyle()} /></Field>
                    <Field label="Amount"><input required className="lims-input" type="number" min="0.01" step="0.01" value={expenseFormEdit.amount} onChange={(e) => setExpenseFormEdit({ ...expenseFormEdit, amount: e.target.value })} style={inputStyle()} /></Field>
                    <Field label="Tax"><input required className="lims-input" type="number" min="0" step="0.01" value={expenseFormEdit.taxAmount} onChange={(e) => setExpenseFormEdit({ ...expenseFormEdit, taxAmount: e.target.value })} style={inputStyle()} /></Field>
                    <Field label="Credit">
                      <select className="lims-input" value={expenseFormEdit.paidFrom} onChange={(e) => setExpenseFormEdit({ ...expenseFormEdit, paidFrom: e.target.value })} style={inputStyle()}>
                        <option value="vendor-payable">Vendor Payable</option>
                        <option value="cash">Cash</option>
                        <option value="bank">Bank</option>
                      </select>
                    </Field>
                    <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                      <button type="button" className="btn-lims-secondary" onClick={() => setEditingExpense(null)} style={{ flex: 1, height: 38 }}>Cancel</button>
                      <button type="button" className="btn-lims-primary" disabled={saving} onClick={() => updateExpense(editingExpense, { category: expenseFormEdit.category, vendorName: expenseFormEdit.vendorName, amount: expenseFormEdit.amount, taxAmount: expenseFormEdit.taxAmount, paidFrom: expenseFormEdit.paidFrom })} style={{ flex: 1, height: 38 }}>{saving ? "Saving..." : "Save"}</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "corporate" && (
            <div style={{ display: "grid", gap: 18 }}>
              <TwoColumn
                left={
                  <form className="form-card" onSubmit={(event) => submitForm(event, "/api/corporate-accounts", corporateForm, () => { setCorporateForm(emptyCorporate); setCorporateFormErrors({}); }, "Corporate account created successfully.")} style={{ padding: 20, borderRadius: 8, display: "grid", gap: 12 }}>
                    <h5 style={{ margin: 0, fontSize: 16 }}>Corporate Account</h5>
                    <Field label="Name">
                      <input required className="lims-input" value={corporateForm.name} onChange={(e) => { const v = e.target.value; if (hasUrl(v)) { setCorporateFormErrors((p) => ({ ...p, name: "URLs are not allowed" })); return; } if (v && !isValidName(v)) { setCorporateFormErrors((p) => ({ ...p, name: "Name contains invalid characters" })); return; } setCorporateFormErrors((p) => ({ ...p, name: "" })); setCorporateForm({ ...corporateForm, name: v }); }} style={inputStyle()} />
                      {corporateFormErrors.name && <small style={{ color: "var(--error)", fontSize: 10, display: "block", marginTop: 2 }}>{corporateFormErrors.name}</small>}
                    </Field>
                    <Field label="Contact Person">
                      <input required className="lims-input" value={corporateForm.contactPerson} onChange={(e) => { const v = e.target.value; if (hasUrl(v)) { setCorporateFormErrors((p) => ({ ...p, contactPerson: "URLs are not allowed" })); return; } if (v && !isValidName(v)) { setCorporateFormErrors((p) => ({ ...p, contactPerson: "Contact person contains invalid characters" })); return; } setCorporateFormErrors((p) => ({ ...p, contactPerson: "" })); setCorporateForm({ ...corporateForm, contactPerson: v }); }} style={inputStyle()} />
                      {corporateFormErrors.contactPerson && <small style={{ color: "var(--error)", fontSize: 10, display: "block", marginTop: 2 }}>{corporateFormErrors.contactPerson}</small>}
                    </Field>
                    <Field label="Credit Limit">
                      <input required className="lims-input" type="number" min="0" step="0.01" value={corporateForm.creditLimit} onChange={(e) => { const v = e.target.value; if (isExponential(v)) { setCorporateFormErrors((p) => ({ ...p, creditLimit: "Exponential notation is not allowed" })); return; } setCorporateFormErrors((p) => ({ ...p, creditLimit: "" })); setCorporateForm({ ...corporateForm, creditLimit: v }); }} style={inputStyle()} />
                      {corporateFormErrors.creditLimit && <small style={{ color: "var(--error)", fontSize: 10, display: "block", marginTop: 2 }}>{corporateFormErrors.creditLimit}</small>}
                    </Field>
                    <Field label="Statement Cycle">
                      <select className="lims-input" value={corporateForm.statementCycle} onChange={(event) => setCorporateForm({ ...corporateForm, statementCycle: event.target.value })} style={inputStyle()}>
                        <option value="monthly">Monthly</option>
                        <option value="weekly">Weekly</option>
                      </select>
                    </Field>
                    <button className="btn-lims-primary" disabled={saving} style={{ height: 38 }}>{saving ? "Saving..." : "Create Corporate"}</button>
                  </form>
                }
                right={
                  <CorporateTable
                    corporates={corporates}
                    onEdit={(corp) => { setCorporateFormEdit(corp); setEditingCorporate(corp._id); }}
                    onDelete={deleteCorporate}
                  />
                }
              />
              {editingCorporate && (
                <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "grid", placeItems: "center", zIndex: 1000 }} onClick={() => setEditingCorporate(null)}>
                  <div className="form-card" style={{ padding: 24, borderRadius: 12, maxWidth: 440, width: "90%", display: "grid", gap: 12 }} onClick={(e) => e.stopPropagation()}>
                    <h5 style={{ margin: 0, fontSize: 16 }}>Edit Corporate Account</h5>
                    <Field label="Name">
                      <input required className="lims-input" value={corporateFormEdit.name} onChange={(e) => setCorporateFormEdit({ ...corporateFormEdit, name: e.target.value })} style={inputStyle()} />
                    </Field>
                    <Field label="Contact Person">
                      <input required className="lims-input" value={corporateFormEdit.contactPerson} onChange={(e) => setCorporateFormEdit({ ...corporateFormEdit, contactPerson: e.target.value })} style={inputStyle()} />
                    </Field>
                    <Field label="Credit Limit">
                      <input required className="lims-input" type="number" min="0" step="0.01" value={corporateFormEdit.creditLimit} onChange={(e) => setCorporateFormEdit({ ...corporateFormEdit, creditLimit: e.target.value })} style={inputStyle()} />
                    </Field>
                    <Field label="Statement Cycle">
                      <select className="lims-input" value={corporateFormEdit.statementCycle} onChange={(e) => setCorporateFormEdit({ ...corporateFormEdit, statementCycle: e.target.value })} style={inputStyle()}>
                        <option value="monthly">Monthly</option>
                        <option value="weekly">Weekly</option>
                      </select>
                    </Field>
                    <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                      <button type="button" className="btn-lims-secondary" onClick={() => setEditingCorporate(null)} style={{ flex: 1, height: 38 }}>Cancel</button>
                      <button type="button" className="btn-lims-primary" disabled={saving} onClick={() => updateCorporate(editingCorporate, { name: corporateFormEdit.name, contactPerson: corporateFormEdit.contactPerson, creditLimit: corporateFormEdit.creditLimit, statementCycle: corporateFormEdit.statementCycle })} style={{ flex: 1, height: 38 }}>{saving ? "Saving..." : "Save"}</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TwoColumn({ left, right }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(300px, 400px) 1fr", gap: 18, alignItems: "start" }}>
      {left}
      {right}
    </div>
  );
}

function AccountsTable({ accounts, onDelete }) {
  return (
    <Table
      minWidth={780}
      headings={["Code", "Name", "Type", "Subtype", "Balance", "System", "Action"]}
      empty="No accounts found."
      rows={accounts.map((account) => [
        account.code,
        account.name,
        account.type,
        account.subtype || "-",
        `Rs ${money(account.balance)}`,
        <Badge key="system" tone={account.isSystem ? "info" : "neutral"}>{account.isSystem ? "System" : "Custom"}</Badge>,
        account.isSystem ? "-" : <button key="delete" type="button" className="btn-lims-secondary" onClick={() => onDelete(account._id)} style={{ height: 30, padding: "0 9px" }}>{Icons.trash}</button>,
      ])}
    />
  );
}

function LedgerTable({ entries }) {
  const rows = entries.flatMap((entry) =>
    (entry.lines || []).map((line, index) => [
      index === 0 ? entry.entryNumber : "",
      index === 0 ? formatDate(entry.date) : "",
      line.accountId ? `${line.accountId.code} - ${line.accountId.name}` : "-",
      line.debit ? `Rs ${money(line.debit)}` : "-",
      line.credit ? `Rs ${money(line.credit)}` : "-",
      index === 0 ? entry.sourceType : "",
      index === 0 ? entry.description : "",
    ])
  );
  return <Table minWidth={900} headings={["Entry", "Date", "Account", "Debit", "Credit", "Source", "Description"]} rows={rows} empty="No journal entries found." />;
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
          <button type="button" className="btn-lims-secondary" onClick={() => onEdit(expense)} style={{ height: 30, padding: "0 9px", fontSize: 12 }}>{Icons.edit}</button>
          <button type="button" className="btn-lims-secondary" onClick={() => onDelete(expense._id)} style={{ height: 30, padding: "0 9px", fontSize: 12, color: "#e11d48" }}>{Icons.trash}</button>
        </div>,
      ])}
    />
  );
}

function CorporateTable({ corporates, onEdit, onDelete }) {
  return (
    <Table
      minWidth={780}
      headings={["Name", "Contact", "Credit Limit", "Outstanding", "Cycle", "Action"]}
      empty="No corporate accounts found."
      rows={corporates.map((corporate) => [
        corporate.name,
        corporate.contactPerson || "-",
        `Rs ${money(corporate.creditLimit)}`,
        `Rs ${money(corporate.outstandingBalance)}`,
        corporate.statementCycle,
        <div key="actions" style={{ display: "flex", gap: 4 }}>
          <button type="button" className="btn-lims-secondary" onClick={() => onEdit(corporate)} style={{ height: 30, padding: "0 9px", fontSize: 12 }}>{Icons.edit}</button>
          <button type="button" className="btn-lims-secondary" onClick={() => onDelete(corporate._id, corporate.name)} style={{ height: 30, padding: "0 9px", fontSize: 12, color: "#e11d48" }}>{Icons.trash}</button>
        </div>,
      ])}
    />
  );
}

function PlStatement({ pl }) {
  const { revenue, expenses, totalRevenue, totalExpenses, netProfit } = pl;
  const isProfit = netProfit >= 0;
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        <div className="form-card" style={{ padding: 18, borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 800 }}>TOTAL REVENUE</div>
          <div style={{ marginTop: 8, fontSize: 22, fontWeight: 900, color: "#047857", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Rs {money(totalRevenue)}</div>
        </div>
        <div className="form-card" style={{ padding: 18, borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 800 }}>TOTAL EXPENSES</div>
          <div style={{ marginTop: 8, fontSize: 22, fontWeight: 900, color: "#b91c1c", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Rs {money(totalExpenses)}</div>
        </div>
        <div className="form-card" style={{ padding: 18, borderRadius: 8, background: isProfit ? "#ecfdf5" : "#fef2f2" }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 800 }}>NET {isProfit ? "PROFIT" : "LOSS"}</div>
          <div style={{ marginTop: 8, fontSize: 22, fontWeight: 900, color: isProfit ? "#047857" : "#b91c1c", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Rs {money(Math.abs(netProfit))}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div className="form-card" style={{ padding: 0, borderRadius: 8, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", background: "var(--surface)", borderBottom: "1px solid var(--border)", fontSize: 13, fontWeight: 800 }}>Revenue</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <tbody>
              {revenue.map((a) => (
                <tr key={a.code} style={{ borderBottom: "1px solid var(--border-light)" }}>
                  <td style={{ padding: "10px 16px", color: "var(--text-secondary)" }}>{a.code}</td>
                  <td style={{ padding: "10px 16px" }}>{a.name}</td>
                  <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 700, color: "#047857" }}>Rs {money(a.balance)}</td>
                </tr>
              ))}
              {revenue.length === 0 && <tr><td colSpan={3} style={{ padding: 20, textAlign: "center", color: "var(--text-muted)" }}>No revenue entries</td></tr>}
              <tr style={{ background: "var(--surface)", borderTop: "2px solid var(--border)" }}>
                <td colSpan={2} style={{ padding: "10px 16px", fontWeight: 800 }}>Total Revenue</td>
                <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 900, color: "#047857" }}>Rs {money(totalRevenue)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="form-card" style={{ padding: 0, borderRadius: 8, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", background: "var(--surface)", borderBottom: "1px solid var(--border)", fontSize: 13, fontWeight: 800 }}>Expenses</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <tbody>
              {expenses.map((a) => (
                <tr key={a.code} style={{ borderBottom: "1px solid var(--border-light)", background: a.subtype === "referral-commission-expense" ? "#fffbeb" : "transparent" }}>
                  <td style={{ padding: "10px 16px", color: "var(--text-secondary)" }}>{a.code}</td>
                  <td style={{ padding: "10px 16px" }}>
                    {a.name}
                    {a.subtype === "referral-commission-expense" && (
                      <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 800, color: "#b45309", background: "#fef3c7", padding: "2px 6px", borderRadius: 4 }}>Doctor Payout</span>
                    )}
                  </td>
                  <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 700, color: "#b91c1c" }}>Rs {money(a.balance)}</td>
                </tr>
              ))}
              {expenses.length === 0 && <tr><td colSpan={3} style={{ padding: 20, textAlign: "center", color: "var(--text-muted)" }}>No expense entries</td></tr>}
              <tr style={{ background: "var(--surface)", borderTop: "2px solid var(--border)" }}>
                <td colSpan={2} style={{ padding: "10px 16px", fontWeight: 800 }}>Total Expenses</td>
                <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 900, color: "#b91c1c" }}>Rs {money(totalExpenses)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Table({ headings, rows, empty, minWidth = 700 }) {
  return (
    <div className="form-card" style={{ padding: 0, overflowX: "auto", borderRadius: 8 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth }}>
        <thead>
          <tr style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
            {headings.map((heading) => (
              <th key={heading} style={{ padding: "12px 14px", textAlign: "left", color: "var(--text-secondary)", fontWeight: 800 }}>{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} style={{ borderBottom: "1px solid var(--border-light)" }}>
              {row.map((cell, cellIndex) => <td key={cellIndex} style={{ padding: "12px 14px", verticalAlign: "top" }}>{cell}</td>)}
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={headings.length} style={{ padding: 28, textAlign: "center", color: "var(--text-muted)" }}>{empty}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function PaginationControls({ pagination, loading, onPageChange }) {
  if (!pagination || pagination.totalPages <= 1) return null;

  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <span style={{ color: "var(--text-muted)", fontSize: 13, fontWeight: 700 }}>
        Page {pagination.page} of {pagination.totalPages}
      </span>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="btn-lims-secondary" disabled={loading || pagination.page <= 1} onClick={() => onPageChange(Math.max(1, pagination.page - 1))} style={{ height: 34, padding: "0 12px" }}>Previous</button>
        <button type="button" className="btn-lims-secondary" disabled={loading || pagination.page >= pagination.totalPages} onClick={() => onPageChange(Math.min(pagination.totalPages, pagination.page + 1))} style={{ height: 34, padding: "0 12px" }}>Next</button>
      </div>
    </div>
  );
}
