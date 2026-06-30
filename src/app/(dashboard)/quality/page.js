"use client";

import { useCallback, useEffect, useState } from "react";
import { Icons } from "@/app/components/Icons";
import SuccessDialog from "@/app/components/SuccessDialog";
import { hasPermission } from "@/app/lib/client-rbac";
import { useCurrentUser } from "@/app/lib/use-current-user";

const SAFE_TEXT = /^[A-Za-z0-9 .&'\/,()@_-]*$/;
const URL_RE = /https?:\/\//;
const EXP_RE = /[eE]/;

function isValidName(v) {
  return v && SAFE_TEXT.test(v);
}
function hasUrl(v) {
  return v && URL_RE.test(v);
}
function isExponential(v) {
  return v && EXP_RE.test(v);
}

const emptyForm = {
  type: "qc-run",
  testName: "",
  instrument: "",
  lotNumber: "",
  result: "pass",
  value: "",
  expectedRange: "",
  remarks: "",
};

const typeLabels = {
  "qc-run": "QC Run",
  calibration: "Calibration",
  maintenance: "Maintenance",
  incident: "Incident",
};

const resultColors = {
  pass: ["#ecfdf5", "#047857"],
  fail: ["#fef2f2", "#b91c1c"],
  warning: ["#fffbeb", "#b45309"],
  pending: ["#f1f5f9", "#475569"],
};

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function Label({ text, children }) {
  return (
    <label style={{ display: "grid", gap: 5, fontSize: 11, fontWeight: 800, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
      {text}{children}
    </label>
  );
}

export default function QualityPage() {
  const user = useCurrentUser();
  const canManage = hasPermission(user, "quality.manage");
  const [logs, setLogs] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [typeFilter, setTypeFilter] = useState("");
  const [resultFilter, setResultFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [formErrors, setFormErrors] = useState({});

  const load = useCallback(async (tf = typeFilter, rf = resultFilter) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (tf) params.set("type", tf);
      if (rf) params.set("result", rf);
      const res = await fetch(`/api/quality?${params}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to load QC logs");
      setLogs(data.logs || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, resultFilter]);

  useEffect(() => { load(); }, [load]);

  function validateField(name, value) {
    const trimmed = String(value).trim();
    if (!trimmed && ["type", "testName", "instrument", "lotNumber", "value", "expectedRange"].includes(name)) return `${name} is required`;
    if (["testName", "instrument", "lotNumber"].includes(name) && !isValidName(trimmed)) return "Invalid characters";
    if (["testName", "instrument", "lotNumber", "remarks"].includes(name) && hasUrl(trimmed)) return "URLs are not allowed";
    if (["value", "expectedRange"].includes(name) && isExponential(trimmed)) return "Exponential notation is not allowed";
    if (name === "value" && trimmed && !/^-?\d*\.?\d*$/.test(trimmed)) return "Only numeric values are allowed";
    if (name === "expectedRange" && trimmed && !/^[\d.\-\s\u2013]*$/.test(trimmed)) return "Only numeric values and ranges are allowed";
    return "";
  }

  function handleChange(name, value) {
    setForm({ ...form, [name]: value });
    const err = validateField(name, value);
    setFormErrors((prev) => ({ ...prev, [name]: err }));
  }

  async function submitLog(e) {
    e.preventDefault();
    const errors = {};
    for (const f of ["type", "testName", "instrument", "lotNumber", "value", "expectedRange"]) {
      const err = validateField(f, form[f]);
      if (err) errors[f] = err;
    }
    if (form.remarks && hasUrl(form.remarks)) errors.remarks = "URLs are not allowed";
    setFormErrors(errors);
    if (Object.keys(errors).length) { setSaving(false); return; }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/quality", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to save QC log");
      setLogs((current) => [data.log, ...current]);
      setForm(emptyForm);
      setFormErrors({});
      setSuccess("QC log recorded successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteLog(id) {
    if (!window.confirm("Delete this QC log?")) return;
    try {
      const res = await fetch(`/api/quality?id=${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Unable to delete");
      setLogs((current) => current.filter((l) => l._id !== id));
      setSuccess("QC log deleted successfully.");
    } catch (err) {
      setError(err.message);
    }
  }

  const stats = {
    total: logs.length,
    pass: logs.filter((l) => l.result === "pass").length,
    fail: logs.filter((l) => l.result === "fail").length,
    warning: logs.filter((l) => l.result === "warning").length,
  };

  return (
    <div style={{ width: "100%", paddingBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <div>
          <p className="module-kicker">Lab Quality</p>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>Quality Control</h1>
          <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>QC runs, calibration records, maintenance logs, and incident tracking.</span>
        </div>
        <button className="dash-btn-secondary" onClick={() => load(typeFilter, resultFilter)} style={{ height: 38 }}>
          {Icons.logo} Refresh
        </button>
      </div>

      {error && <div className="module-alert">{error}</div>}
      <SuccessDialog message={success} onClose={() => setSuccess("")} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total Logs", value: stats.total, color: "var(--text-primary)" },
          { label: "Pass", value: stats.pass, color: "#047857" },
          { label: "Fail", value: stats.fail, color: "#b91c1c" },
          { label: "Warning", value: stats.warning, color: "#b45309" },
        ].map((s) => (
          <div key={s.label} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 800, textTransform: "uppercase" }}>{s.label}</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: s.color, marginTop: 6 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: canManage ? "minmax(300px, 380px) 1fr" : "1fr", gap: 18, alignItems: "start" }}>
        {canManage && (
          <form onSubmit={submitLog} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 10, padding: 20, display: "grid", gap: 12 }}>
            <h5 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>Record QC Log</h5>
            <Label text="Type">
              <select className="lims-input" style={{ height: 38 }} value={form.type} onChange={(e) => handleChange("type", e.target.value)}>
                <option value="">Select type</option>
                {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              {formErrors.type && <span style={{ color: "#b91c1c", fontSize: 11 }}>{formErrors.type}</span>}
            </Label>
            <Label text="Test / Instrument Name">
              <input className={"lims-input" + (formErrors.testName ? " invalid" : "")} style={{ height: 38 }} value={form.testName} onChange={(e) => handleChange("testName", e.target.value)} placeholder="e.g. CBC, Glucose Analyser" />
              {formErrors.testName && <span style={{ color: "#b91c1c", fontSize: 11 }}>{formErrors.testName}</span>}
            </Label>
            <Label text="Instrument / Equipment">
              <input className={"lims-input" + (formErrors.instrument ? " invalid" : "")} style={{ height: 38 }} value={form.instrument} onChange={(e) => handleChange("instrument", e.target.value)} placeholder="e.g. Sysmex XN-550" />
              {formErrors.instrument && <span style={{ color: "#b91c1c", fontSize: 11 }}>{formErrors.instrument}</span>}
            </Label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Label text="Lot / Batch No.">
                <input className={"lims-input" + (formErrors.lotNumber ? " invalid" : "")} style={{ height: 38 }} value={form.lotNumber} onChange={(e) => handleChange("lotNumber", e.target.value)} />
                {formErrors.lotNumber && <span style={{ color: "#b91c1c", fontSize: 11 }}>{formErrors.lotNumber}</span>}
              </Label>
              <Label text="Result">
                <select className="lims-input" style={{ height: 38 }} value={form.result} onChange={(e) => handleChange("result", e.target.value)}>
                  <option value="pass">Pass</option>
                  <option value="fail">Fail</option>
                  <option value="warning">Warning</option>
                  <option value="pending">Pending</option>
                </select>
              </Label>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Label text="Observed Value">
                <input className={"lims-input" + (formErrors.value ? " invalid" : "")} style={{ height: 38 }} value={form.value} onChange={(e) => handleChange("value", e.target.value)} placeholder="e.g. 5.2" />
                {formErrors.value && <span style={{ color: "#b91c1c", fontSize: 11 }}>{formErrors.value}</span>}
              </Label>
              <Label text="Expected Range">
                <input className={"lims-input" + (formErrors.expectedRange ? " invalid" : "")} style={{ height: 38 }} value={form.expectedRange} onChange={(e) => handleChange("expectedRange", e.target.value)} placeholder="e.g. 4.5–5.5" />
                {formErrors.expectedRange && <span style={{ color: "#b91c1c", fontSize: 11 }}>{formErrors.expectedRange}</span>}
              </Label>
            </div>
            <Label text="Remarks">
              <textarea className={"lims-input" + (formErrors.remarks ? " invalid" : "")} style={{ height: 72, padding: "8px 11px", resize: "vertical" }} value={form.remarks} onChange={(e) => handleChange("remarks", e.target.value)} placeholder="Optional notes or corrective action..." />
              {formErrors.remarks && <span style={{ color: "#b91c1c", fontSize: 11 }}>{formErrors.remarks}</span>}
            </Label>
            <button className="btn-lims-primary" disabled={saving} style={{ height: 40 }}>{saving ? "Saving..." : "Record Log"}</button>
          </form>
        )}

        <div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14, alignItems: "center" }}>
            <select className="lims-input" style={{ height: 34, width: 150, fontSize: 12 }} value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); load(e.target.value, resultFilter); }}>
              <option value="">All types</option>
              {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select className="lims-input" style={{ height: 34, width: 140, fontSize: 12 }} value={resultFilter} onChange={(e) => { setResultFilter(e.target.value); load(typeFilter, e.target.value); }}>
              <option value="">All results</option>
              {["pass", "fail", "warning", "pending"].map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
                  {["Type", "Test / Instrument", "Lot", "Value", "Result", "Date", "By", canManage && ""].filter(Boolean).map((h) => (
                    <th key={h} style={{ padding: "10px 12px", textAlign: "left", color: "var(--text-muted)", fontWeight: 800, fontSize: 11, textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={8} style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>Loading...</td></tr>}
                {!loading && logs.length === 0 && (
                  <tr><td colSpan={8} style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>No QC logs found. {canManage ? "Record your first log using the form." : ""}</td></tr>
                )}
                {logs.map((log) => {
                  const [bg, color] = resultColors[log.result] || ["var(--surface)", "var(--text-secondary)"];
                  return (
                    <tr key={log._id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                      <td style={{ padding: "10px 12px" }}>{typeLabels[log.type] || log.type}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ fontWeight: 600 }}>{log.testName}</div>
                        {log.instrument && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{log.instrument}</div>}
                      </td>
                      <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>{log.lotNumber || "—"}</td>
                      <td style={{ padding: "10px 12px" }}>
                        {log.value || "—"}
                        {log.expectedRange && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>exp: {log.expectedRange}</div>}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{ background: bg, color, borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 800 }}>{log.result}</span>
                      </td>
                      <td style={{ padding: "10px 12px", color: "var(--text-secondary)", fontSize: 12, whiteSpace: "nowrap" }}>{formatDate(log.createdAt)}</td>
                      <td style={{ padding: "10px 12px", color: "var(--text-muted)", fontSize: 12 }}>{log.enteredBy}</td>
                      {canManage && (
                        <td style={{ padding: "10px 12px" }}>
                          <button type="button" onClick={() => deleteLog(log._id)} style={{ border: "1px solid #fecaca", borderRadius: 6, background: "#fff", color: "#b91c1c", padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>
                            Delete
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
