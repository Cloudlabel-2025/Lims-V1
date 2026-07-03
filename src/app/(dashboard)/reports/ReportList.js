"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const statusColors = {
  draft: ["#f1f5f9", "#475569"],
  reviewed: ["#eff6ff", "#1d4ed8"],
  approved: ["#f0fdf4", "#15803d"],
  released: ["#ecfdf5", "#047857"],
};

const STATUS_OPTIONS = ["all", "draft", "reviewed", "approved", "released"];

export default function ReportList({ reports, dateFrom, dateTo, onDateFromChange, onDateToChange }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const from = dateFrom ? new Date(dateFrom) : null;
    const to = dateTo ? new Date(dateTo) : null;
    if (to) to.setHours(23, 59, 59, 999);
    return reports.filter((r) => {
      const matchStatus = statusFilter === "all" || r.status === statusFilter;
      const matchSearch = !q ||
        r.patient?.name?.toLowerCase().includes(q) ||
        r.testSnapshot?.name?.toLowerCase().includes(q) ||
        r.reportId?.toLowerCase().includes(q) ||
        r.sampleId?.toLowerCase().includes(q);
      let matchDate = true;
      if (from || to) {
        const rDate = new Date(r.createdAt);
        if (from && rDate < from) matchDate = false;
        if (to && rDate > to) matchDate = false;
      }
      return matchStatus && matchSearch && matchDate;
    });
  }, [reports, search, statusFilter, dateFrom, dateTo]);

  return (
    <aside className="module-panel">
      <div className="module-panel-header">
        <h2>Generated Reports</h2>
        <p>{filtered.length} of {reports.length} reports</p>
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 8, flexWrap: "wrap" }}>
        {[
          { label: "7 days", days: 7 },
          { label: "30 days", days: 30 },
          { label: "90 days", days: 90 },
          { label: "All", days: 0 },
        ].map((opt) => {
          const isActive = opt.days === 0
            ? !dateFrom && !dateTo
            : dateFrom && !dateTo && dateFrom === new Date(Date.now() - opt.days * 86400000).toISOString().split("T")[0];
          return (
            <button
              key={opt.label}
              type="button"
              onClick={() => {
                if (opt.days === 0) {
                  onDateFromChange?.("");
                  onDateToChange?.("");
                } else {
                  const d = new Date(Date.now() - opt.days * 86400000);
                  onDateFromChange?.(d.toISOString().split("T")[0]);
                  onDateToChange?.("");
                }
              }}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                border: isActive ? "1.5px solid var(--brand-action, var(--primary))" : "1px solid var(--border)",
                background: isActive ? "var(--primary-50)" : "#fff",
                color: isActive ? "var(--brand-action, var(--primary))" : "var(--text-secondary)",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <input
          className="lims-input"
          style={{ flex: 1, minWidth: 120, height: 34, fontSize: 12 }}
          placeholder="Search patient, test, ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <input
          type="date"
          className="lims-input"
          style={{ height: 34, fontSize: 12, width: 130 }}
          value={dateFrom || ""}
          onChange={(e) => onDateFromChange?.(e.target.value)}
          title="From date"
        />
        <input
          type="date"
          className="lims-input"
          style={{ height: 34, fontSize: 12, width: 130 }}
          value={dateTo || ""}
          onChange={(e) => onDateToChange?.(e.target.value)}
          title="To date"
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
              onClick={() => router.push(`/reports/${report._id}`)}
            >
              <div>
                <h3>{report.testSnapshot?.name}</h3>
                <span>{report.patient?.name} &middot; {report.reportId} {report.version > 1 ? `v${report.version}` : ""}</span>
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
