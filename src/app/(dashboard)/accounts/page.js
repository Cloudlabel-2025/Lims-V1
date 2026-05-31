"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Icons } from "@/app/components/Icons";

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
          <div style={{ marginTop: 8, fontSize: 23, fontWeight: 900, color: "var(--text-primary)" }}>{value}</div>
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
      const [accountData, ledgerData, expenseData, corporateData] = await Promise.all([
        fetchJson("/api/accounting/accounts"),
        fetchJson(`/api/accounting/journal-entries?${ledgerQuery.toString()}`),
        fetchJson("/api/expenses"),
        fetchJson("/api/corporate-accounts"),
      ]);
      setAccounts(accountData.accounts || []);
      setJournalEntries(ledgerData.journalEntries || []);
      setExpenses(expenseData.expenses || []);
      setCorporates(corporateData.corporateAccounts || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [ledgerFilter.accountId, ledgerFilter.sourceType]);

  useEffect(() => {
    loadAccountsData();
  }, [loadAccountsData]);

  async function submitForm(event, url, payload, reset) {
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
      setSuccess("Saved successfully");
      await loadAccountsData();
    } catch (err) {
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
      setSuccess("Account deleted");
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

  async function loadPl(from, to) {
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
      {success && <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 8, background: "#ecfdf5", color: "#047857", fontSize: 13, fontWeight: 800 }}>{success}</div>}

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
                <form className="form-card" onSubmit={(event) => submitForm(event, "/api/accounting/accounts", accountForm, () => setAccountForm(emptyAccount))} style={{ padding: 20, borderRadius: 8, display: "grid", gap: 12 }}>
                  <h5 style={{ margin: 0, fontSize: 16 }}>Add Account</h5>
                  <Field label="Code"><input required className="lims-input" value={accountForm.code} onChange={(event) => setAccountForm({ ...accountForm, code: event.target.value })} style={inputStyle()} /></Field>
                  <Field label="Name"><input required className="lims-input" value={accountForm.name} onChange={(event) => setAccountForm({ ...accountForm, name: event.target.value })} style={inputStyle()} /></Field>
                  <Field label="Type">
                    <select className="lims-input" value={accountForm.type} onChange={(event) => setAccountForm({ ...accountForm, type: event.target.value })} style={inputStyle()}>
                      {["asset", "liability", "equity", "revenue", "expense"].map((type) => <option key={type} value={type}>{type}</option>)}
                    </select>
                  </Field>
                  <Field label="Subtype"><input className="lims-input" value={accountForm.subtype} onChange={(event) => setAccountForm({ ...accountForm, subtype: event.target.value })} style={inputStyle()} /></Field>
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
                  <select className="lims-input" value={ledgerFilter.sourceType} onChange={(event) => setLedgerFilter({ ...ledgerFilter, sourceType: event.target.value })} style={inputStyle()}>
                    {["all", "billing", "payment", "refund", "commission", "expense", "manual"].map((source) => <option key={source} value={source}>{source}</option>)}
                  </select>
                </Field>
                <Field label="Account">
                  <select className="lims-input" value={ledgerFilter.accountId} onChange={(event) => setLedgerFilter({ ...ledgerFilter, accountId: event.target.value })} style={inputStyle()}>
                    <option value="">All accounts</option>
                    {accounts.map((account) => <option key={account._id} value={account._id}>{account.code} - {account.name}</option>)}
                  </select>
                </Field>
              </div>
              <LedgerTable entries={journalEntries} />
            </div>
          )}

          {activeTab === "pl" && (
            <div style={{ display: "grid", gap: 14 }}>
              <div className="form-card" style={{ padding: 14, borderRadius: 8, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, alignItems: "end" }}>
                <Field label="From">
                  <input type="date" className="lims-input" value={plFilter.from} onChange={(e) => setPlFilter({ ...plFilter, from: e.target.value })} style={inputStyle()} />
                </Field>
                <Field label="To">
                  <input type="date" className="lims-input" value={plFilter.to} onChange={(e) => setPlFilter({ ...plFilter, to: e.target.value })} style={inputStyle()} />
                </Field>
                <button type="button" className="btn-lims-primary" onClick={() => loadPl(plFilter.from, plFilter.to)} style={{ height: 38 }}>
                  {plLoading ? "Loading..." : "Apply"}
                </button>
              </div>
              {pl && <PlStatement pl={pl} />}
            </div>
          )}

          {activeTab === "manual" && (
            <form className="form-card" onSubmit={(event) => submitForm(event, "/api/accounting/journal-entries", journalForm, () => setJournalForm(emptyJournal))} style={{ padding: 20, borderRadius: 8, display: "grid", gap: 14 }}>
              <h5 style={{ margin: 0, fontSize: 16 }}>Manual Journal</h5>
              <Field label="Description"><input required className="lims-input" value={journalForm.description} onChange={(event) => setJournalForm({ ...journalForm, description: event.target.value })} style={inputStyle()} /></Field>
              <div style={{ display: "grid", gap: 10 }}>
                {journalForm.lines.map((line, index) => (
                  <div key={index} style={{ display: "grid", gridTemplateColumns: "minmax(220px, 1fr) 140px 140px", gap: 10 }}>
                    <select required className="lims-input" value={line.accountId} onChange={(event) => updateJournalLine(index, { accountId: event.target.value })} style={inputStyle()}>
                      <option value="">Select account</option>
                      {accounts.map((account) => <option key={account._id} value={account._id}>{account.code} - {account.name}</option>)}
                    </select>
                    <input className="lims-input" type="number" min="0" step="0.01" placeholder="Debit" value={line.debit} onChange={(event) => updateJournalLine(index, { debit: event.target.value })} style={inputStyle()} />
                    <input className="lims-input" type="number" min="0" step="0.01" placeholder="Credit" value={line.credit} onChange={(event) => updateJournalLine(index, { credit: event.target.value })} style={inputStyle()} />
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
            <TwoColumn
              left={
                <form className="form-card" onSubmit={(event) => submitForm(event, "/api/expenses", expenseForm, () => setExpenseForm(emptyExpense))} style={{ padding: 20, borderRadius: 8, display: "grid", gap: 12 }}>
                  <h5 style={{ margin: 0, fontSize: 16 }}>Record Expense</h5>
                  <Field label="Category">
                    <select className="lims-input" value={expenseForm.category} onChange={(event) => setExpenseForm({ ...expenseForm, category: event.target.value })} style={inputStyle()}>
                      {["reagent", "staff", "equipment", "overhead"].map((category) => <option key={category} value={category}>{category}</option>)}
                    </select>
                  </Field>
                  <Field label="Vendor"><input className="lims-input" value={expenseForm.vendorName} onChange={(event) => setExpenseForm({ ...expenseForm, vendorName: event.target.value })} style={inputStyle()} /></Field>
                  <Field label="Amount"><input required className="lims-input" type="number" min="0.01" step="0.01" value={expenseForm.amount} onChange={(event) => setExpenseForm({ ...expenseForm, amount: event.target.value })} style={inputStyle()} /></Field>
                  <Field label="Tax"><input className="lims-input" type="number" min="0" step="0.01" value={expenseForm.taxAmount} onChange={(event) => setExpenseForm({ ...expenseForm, taxAmount: event.target.value })} style={inputStyle()} /></Field>
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
              right={<ExpensesTable expenses={expenses} />}
            />
          )}

          {activeTab === "corporate" && (
            <TwoColumn
              left={
                <form className="form-card" onSubmit={(event) => submitForm(event, "/api/corporate-accounts", corporateForm, () => setCorporateForm(emptyCorporate))} style={{ padding: 20, borderRadius: 8, display: "grid", gap: 12 }}>
                  <h5 style={{ margin: 0, fontSize: 16 }}>Corporate Account</h5>
                  <Field label="Name"><input required className="lims-input" value={corporateForm.name} onChange={(event) => setCorporateForm({ ...corporateForm, name: event.target.value })} style={inputStyle()} /></Field>
                  <Field label="Contact Person"><input className="lims-input" value={corporateForm.contactPerson} onChange={(event) => setCorporateForm({ ...corporateForm, contactPerson: event.target.value })} style={inputStyle()} /></Field>
                  <Field label="Credit Limit"><input className="lims-input" type="number" min="0" step="0.01" value={corporateForm.creditLimit} onChange={(event) => setCorporateForm({ ...corporateForm, creditLimit: event.target.value })} style={inputStyle()} /></Field>
                  <Field label="Statement Cycle">
                    <select className="lims-input" value={corporateForm.statementCycle} onChange={(event) => setCorporateForm({ ...corporateForm, statementCycle: event.target.value })} style={inputStyle()}>
                      <option value="monthly">Monthly</option>
                      <option value="weekly">Weekly</option>
                    </select>
                  </Field>
                  <button className="btn-lims-primary" disabled={saving} style={{ height: 38 }}>{saving ? "Saving..." : "Create Corporate"}</button>
                </form>
              }
              right={<CorporateTable corporates={corporates} />}
            />
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

function ExpensesTable({ expenses }) {
  return (
    <Table
      minWidth={760}
      headings={["Date", "Category", "Vendor", "Amount", "Credit", "Journal"]}
      empty="No expenses found."
      rows={expenses.map((expense) => [
        formatDate(expense.date),
        expense.category,
        expense.vendorName || "-",
        `Rs ${money(Number(expense.amount || 0) + Number(expense.taxAmount || 0))}`,
        expense.paidFrom,
        expense.journalEntryId?.entryNumber || "-",
      ])}
    />
  );
}

function CorporateTable({ corporates }) {
  return (
    <Table
      minWidth={680}
      headings={["Name", "Contact", "Credit Limit", "Outstanding", "Cycle"]}
      empty="No corporate accounts found."
      rows={corporates.map((corporate) => [
        corporate.name,
        corporate.contactPerson || "-",
        `Rs ${money(corporate.creditLimit)}`,
        `Rs ${money(corporate.outstandingBalance)}`,
        corporate.statementCycle,
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
          <div style={{ marginTop: 8, fontSize: 22, fontWeight: 900, color: "#047857" }}>Rs {money(totalRevenue)}</div>
        </div>
        <div className="form-card" style={{ padding: 18, borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 800 }}>TOTAL EXPENSES</div>
          <div style={{ marginTop: 8, fontSize: 22, fontWeight: 900, color: "#b91c1c" }}>Rs {money(totalExpenses)}</div>
        </div>
        <div className="form-card" style={{ padding: 18, borderRadius: 8, background: isProfit ? "#ecfdf5" : "#fef2f2" }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 800 }}>NET {isProfit ? "PROFIT" : "LOSS"}</div>
          <div style={{ marginTop: 8, fontSize: 22, fontWeight: 900, color: isProfit ? "#047857" : "#b91c1c" }}>Rs {money(Math.abs(netProfit))}</div>
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
