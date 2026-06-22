"use client";

import { useMemo, useState } from "react";

const statusColors = {
  draft: ["#f1f5f9", "#475569"],
  verified: ["#f0fdf4", "#15803d"],
  released: ["#ecfdf5", "#047857"],
  delivered: ["#eff6ff", "#1d4ed8"],
};

const STATUS_OPTIONS = ["all", "draft", "verified", "released", "delivered"];

export default function ReportList({ reports, setSelectedReport, selectedReport }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reports.filter((r) => {
      const matchStatus = statusFilter === "all" || r.status === statusFilter;
      const matchSearch = !q ||
        r.patient?.name?.toLowerCase().includes(q) ||
        r.testSnapshot?.name?.toLowerCase().includes(q) ||
        r.reportId?.toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [reports, search, statusFilter]);

  return (
    <aside className="module-panel">
      <div className="module-panel-header">
        <h2>Generated Reports</h2>
        <p>{filtered.length} of {reports.length} reports</p>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          className="lims-input"
          style={{ flex: 1, height: 34, fontSize: 12 }}
          placeholder="Search patient, test, ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="lims-input"
          style={{ height: 34, fontSize: 12, width: 110 }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s === "all" ? "All Status" : s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>

      <div className="test-card-list">
        {filtered.map((report) => {
          const [bg, color] = statusColors[report.status] || ["var(--surface)", "var(--text-secondary)"];
          return (
            <article
              key={report._id}
              className="test-card"
              onClick={() => setSelectedReport(report)}
              style={selectedReport?._id === report._id ? { borderColor: "var(--primary)", background: "var(--primary-50)" } : {}}
            >
              <div>
                <h3>{report.testSnapshot?.name}</h3>
                <span>{report.patient?.name} &middot; {report.reportId}</span>
              </div>
              <span style={{ background: bg, color, borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 800 }}>
                {report.status}
              </span>
            </article>
          );
        })}
        {filtered.length === 0 && (
          <p style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: 20 }}>
            {reports.length === 0 ? "No reports yet." : "No reports match your filter."}
          </p>
        )}
      </div>
    </aside>
  );
}
