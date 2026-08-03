"use client";
import { useCallback, useEffect, useState } from "react";
import { Icons } from "@/app/components/Icons";
import SuccessDialog from "@/app/components/SuccessDialog";
import { money, hasUrl, inputStyle, sanitizeAmountInput } from "../_components/helpers";
import Badge from "../_components/Badge";
import Field from "../_components/Field";
import BackToDashboard from "../_components/BackToDashboard";

const emptyJournal = {
  date: new Date().toISOString().slice(0, 10),
  description: "",
  lines: [
    { accountId: "", debit: "", credit: "" },
    { accountId: "", debit: "", credit: "" },
  ],
};

const todayDate = new Date();
const journalMaxDate = todayDate.toISOString().slice(0, 10);
const journalMinDate = new Date(todayDate.getTime() - 5 * 365 * 24 * 60 * 60 * 1000)
  .toISOString()
  .slice(0, 10);

export default function ManualPage() {
  const [form, setForm] = useState(emptyJournal);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const totalDebit = form.lines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
  const totalCredit = form.lines.reduce((sum, line) => sum + Number(line.credit || 0), 0);
  const balanced = totalDebit > 0 && Math.round(totalDebit * 100) === Math.round(totalCredit * 100);

  async function fetchJson(url, options) {
    const response = await fetch(url, { cache: "no-store", ...options });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  const loadAccounts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchJson("/api/accounting/accounts?page=1&limit=200");
      setAccounts(data.accounts || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  function updateLine(index, patch) {
    setForm((current) => ({
      ...current,
      lines: current.lines.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    }));
  }

  function removeLine(index) {
    setForm((current) => ({
      ...current,
      lines: current.lines.filter((_, i) => i !== index),
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    // Sync latest DOM values to handle auto-fill / edge cases
    const debitEls = document.querySelectorAll('input[placeholder="Debit"]');
    const creditEls = document.querySelectorAll('input[placeholder="Credit"]');
    const lines = form.lines.map((line, i) => ({
      ...line,
      debit: debitEls[i]?.value ?? line.debit,
      credit: creditEls[i]?.value ?? line.credit,
    }));
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await fetchJson("/api/accounting/journal-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, lines }),
      });
      setForm(emptyJournal);
      setSuccess("Manual journal posted successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="patients-page" style={{ paddingBottom: 40 }}>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 18, flexWrap: "wrap", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div className="page-header-icon" style={{ background: "var(--brand-surface, #e6f0fa)", color: "var(--brand-action, var(--primary))", padding: 12, borderRadius: 8 }}>
            {Icons.edit}
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: 20, color: "var(--text-main)" }}>Manual Journal</h4>
            <small style={{ color: "var(--text-muted)" }}>Post double-entry journal</small>
          </div>
        </div>
        <BackToDashboard />
      </div>
      <form className="form-card" onSubmit={handleSubmit} style={{ padding: 20, borderRadius: 8, display: "grid", gap: 14 }}>

      {error && <div style={{ padding: "10px 14px", borderRadius: 8, background: "#fef2f2", color: "#b91c1c", fontSize: 13, fontWeight: 700 }}>{error}</div>}
      <SuccessDialog message={success} onClose={() => setSuccess("")} />

      {loading ? (
        <div style={{ textAlign: "center", padding: 20, fontSize: 13, color: "var(--text-muted)" }}>Loading accounts...</div>
      ) : (
        <>
          <Field label="Date">
            <input type="date" className="lims-input" min={journalMinDate} max={journalMaxDate} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} style={inputStyle()} />
          </Field>

          <Field label="Description">
            <input required className="lims-input" maxLength={150} value={form.description} onChange={(e) => { const v = e.target.value; if (hasUrl(v)) { setError("URLs are not allowed in description"); return; } setForm({ ...form, description: v }); }} style={inputStyle()} />
          </Field>

          <div style={{ display: "grid", gap: 10 }}>
            {form.lines.map((line, index) => (
              <div key={index} className="journal-line-grid">
                <select required className="lims-input" value={line.accountId} onChange={(e) => updateLine(index, { accountId: e.target.value })} style={inputStyle()}>
                  <option value="">Select account</option>
                  {accounts.map((a) => <option key={a._id} value={a._id}>{a.code} - {a.name}</option>)}
                </select>
                <input className="lims-input" type="text" inputMode="numeric" maxLength={7} placeholder="Debit" value={line.debit} onChange={(e) => updateLine(index, { debit: sanitizeAmountInput(e.target.value) })} onBlur={(e) => updateLine(index, { debit: sanitizeAmountInput(e.target.value) })} style={inputStyle()} />
                <input className="lims-input" type="text" inputMode="numeric" maxLength={7} placeholder="Credit" value={line.credit} onChange={(e) => updateLine(index, { credit: sanitizeAmountInput(e.target.value) })} onBlur={(e) => updateLine(index, { credit: sanitizeAmountInput(e.target.value) })} style={inputStyle()} />
                {form.lines.length > 2 && (
                  <button type="button" onClick={() => removeLine(index)} style={{ height: 30, width: 30, border: "none", background: "transparent", cursor: "pointer", color: "#e11d48", display: "grid", placeItems: "center", padding: 0 }}>{Icons.trash}</button>
                )}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
            <button type="button" className="btn-lims-secondary" disabled={form.lines.length >= 20} onClick={() => setForm({ ...form, lines: [...form.lines, { accountId: "", debit: "", credit: "" }] })} style={{ height: 36 }}>
              {Icons.plus} Line {form.lines.length >= 20 ? "(max 20)" : ""}
            </button>
            <div style={{ fontSize: 13, fontWeight: 800 }}>
              Debit Rs {money(totalDebit)} / Credit Rs {money(totalCredit)} <Badge tone={balanced ? "good" : "warn"}>{balanced ? "Balanced" : "Open"}</Badge>
            </div>
          </div>

          <button type="submit" className="btn-lims-primary" style={{ height: 38 }}>{saving ? "Posting..." : "Post Journal"}</button>
        </>
      )}
    </form>
    </div>
  );
}
