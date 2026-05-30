"use client";

import { useCallback, useEffect, useState } from "react";
import { Icons } from "@/app/components/Icons";

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

const actionColors = {
  create: ["#ecfdf5", "#047857"],
  update: ["#eff6ff", "#1d4ed8"],
  delete: ["#fef2f2", "#b91c1c"],
  login: ["#f5f3ff", "#6d28d9"],
  logout: ["#f1f5f9", "#475569"],
  verify: ["#f0fdf4", "#15803d"],
  release: ["#ecfdf5", "#047857"],
  cancel: ["#fef2f2", "#b91c1c"],
  collect: ["#eff6ff", "#1d4ed8"],
};

function actionBadge(action) {
  const key = Object.keys(actionColors).find((k) => action?.toLowerCase().includes(k));
  const [bg, color] = actionColors[key] || ["var(--surface)", "var(--text-secondary)"];
  return <span style={{ background: bg, color, borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 800 }}>{action}</span>;
}

export default function AuditPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [resourceType, setResourceType] = useState("");

  const load = useCallback(async (rt = resourceType) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (rt) params.set("resourceType", rt);
      const res = await fetch(`/api/audit?${params}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to load audit logs");
      setLogs(data.logs || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [resourceType]);

  useEffect(() => { load(); }, []);

  const resourceTypes = [...new Set(logs.map((l) => l.resourceType).filter(Boolean))];

  return (
    <div style={{ width: "100%", paddingBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <div>
          <p className="module-kicker">Security & Compliance</p>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>Audit Log</h1>
          <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>Track all user actions across the system.</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <select
            className="lims-input"
            style={{ height: 38, width: 180 }}
            value={resourceType}
            onChange={(e) => { setResourceType(e.target.value); load(e.target.value); }}
          >
            <option value="">All resource types</option>
            {resourceTypes.map((rt) => <option key={rt} value={rt}>{rt}</option>)}
          </select>
          <button className="dash-btn-secondary" onClick={() => load(resourceType)} style={{ height: 38 }}>
            {Icons.logo} Refresh
          </button>
        </div>
      </div>

      {error && <div className="module-alert">{error}</div>}

      <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
              {["Timestamp", "Action", "Resource", "Resource ID", "User", "IP"].map((h) => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: "var(--text-muted)", fontWeight: 800, fontSize: 11, textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>Loading audit logs...</td></tr>
            )}
            {!loading && logs.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>No audit logs found.</td></tr>
            )}
            {logs.map((log) => (
              <tr key={log._id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                <td style={{ padding: "10px 14px", color: "var(--text-secondary)", fontSize: 12, whiteSpace: "nowrap" }}>{formatDate(log.timestamp)}</td>
                <td style={{ padding: "10px 14px" }}>{actionBadge(log.action)}</td>
                <td style={{ padding: "10px 14px", fontWeight: 600 }}>{log.resourceType || "—"}</td>
                <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 11, color: "var(--text-muted)" }}>
                  {log.resourceId ? String(log.resourceId).slice(-8) : "—"}
                </td>
                <td style={{ padding: "10px 14px" }}>
                  {log.userId?.email || log.userId?.name || "—"}
                  {log.userId?.userId && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{log.userId.userId}</div>}
                </td>
                <td style={{ padding: "10px 14px", color: "var(--text-muted)", fontSize: 12 }}>{log.ipAddress || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
