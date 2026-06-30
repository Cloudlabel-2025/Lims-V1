"use client";

import { useState } from "react";
import { Icons } from "@/app/components/Icons";

function rangeText(result) {
  const hasMin = Number.isFinite(result.normalMin);
  const hasMax = Number.isFinite(result.normalMax);
  if (hasMin && hasMax) return `${result.normalMin} - ${result.normalMax}`;
  if (hasMin) return `>= ${result.normalMin}`;
  if (hasMax) return `<= ${result.normalMax}`;
  return "-";
}

const statusFlow = {
  completed: { next: "verify", label: "Verify", permission: "reports.verify", color: "#1d4ed8", bg: "#eff6ff" },
  verified: { next: "release", label: "Release", permission: "reports.release", color: "#047857", bg: "#ecfdf5" },
};

const statusBadge = {
  draft: ["#f1f5f9", "#475569"],
  completed: ["#eff6ff", "#1d4ed8"],
  verified: ["#f0fdf4", "#15803d"],
  released: ["#ecfdf5", "#047857"],
};

function downloadAsPdf(report) {
  const rows = report.results?.map((r) => {
    const flag = r.flag === "normal" ? "Normal" : r.flag;
    const range = Number.isFinite(r.normalMin) && Number.isFinite(r.normalMax)
      ? `${r.normalMin} - ${r.normalMax}`
      : Number.isFinite(r.normalMin) ? `>= ${r.normalMin}`
      : Number.isFinite(r.normalMax) ? `<= ${r.normalMax}`
      : "-";
    return `<tr${flag !== "Normal" ? ` style="background:#fff3f3"` : ""}>
      <td style="padding:6px 10px;border:1px solid #ddd">${r.name}</td>
      <td style="padding:6px 10px;border:1px solid #ddd;font-weight:700">${r.textValue || r.value || "-"}</td>
      <td style="padding:6px 10px;border:1px solid #ddd">${r.unit || "-"}</td>
      <td style="padding:6px 10px;border:1px solid #ddd">${range}</td>
      <td style="padding:6px 10px;border:1px solid #ddd">${flag}</td>
    </tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${report.reportId}</title>
<style>
  body { font-family:Arial,sans-serif; margin:32px; color:#222; }
  .header { text-align:center; margin-bottom:24px; }
  .header h1 { margin:0; font-size:20px; }
  .header span { color:#666; font-size:13px; }
  .info { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:20px; }
  .info div span { font-size:11px; color:#888; display:block; }
  .info div strong { font-size:14px; }
  table { width:100%; border-collapse:collapse; }
  th { background:#1a56db; color:#fff; padding:8px 10px; text-align:left; font-size:12px; }
  td { font-size:13px; }
</style>
</head>
<body>
  <div class="header">
    <h1>${report.testSnapshot?.name || "Test Report"}</h1>
    <span>${report.reportId}</span>
  </div>
  <div class="info">
    <div><span>Patient</span><strong>${report.patient?.name}</strong></div>
    <div><span>Patient ID</span><strong>${report.patient?.patientId}</strong></div>
    <div><span>Age / Gender</span><strong>${report.patient?.age || ""} / ${report.patient?.gender || ""}</strong></div>
    <div><span>Sample</span><strong>${report.testSnapshot?.sampleType || "-"}</strong></div>
  </div>
  <table>
    <thead><tr>
      <th>Parameter</th><th>Result</th><th>Unit</th><th>Normal Range</th><th>Flag</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  ${report.remarks ? `<p style="margin-top:16px;font-style:italic;color:#555">${report.remarks}</p>` : ""}
  <p style="margin-top:32px;font-size:11px;color:#999;text-align:center">Generated on ${new Date().toLocaleString()}</p>
</body></html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${report.reportId || "report"}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function ReportPreview({ selectedReport, canPrintReports, canVerifyReports, canReleaseReports, canDeleteReports, onReportUpdated, onSuccess, onEdit, onDelete }) {
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");

  if (!selectedReport) return null;

  const flow = statusFlow[selectedReport.status];
  const canAct =
    (flow?.next === "verify" && canVerifyReports) ||
    (flow?.next === "release" && canReleaseReports);

  async function performAction(action) {
    setUpdating(true);
    setError("");
    try {
      const res = await fetch(`/api/reports/${selectedReport._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to update report");
      onReportUpdated?.(data.report);
      onSuccess?.(`Report ${data.report?.reportId || ""} ${action === "verify" ? "verified" : "released"} successfully.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdating(false);
    }
  }

  const [badgeBg, badgeColor] = statusBadge[selectedReport.status] || ["var(--surface)", "var(--text-secondary)"];

  return (
    <section className="module-panel report-preview">
      <div className="report-title-row">
        <div>
          <p className="module-kicker">Structured Report</p>
          <h2>{selectedReport.testSnapshot?.name}</h2>
          <span>{selectedReport.reportId}</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ background: badgeBg, color: badgeColor, borderRadius: 6, padding: "4px 10px", fontSize: 12, fontWeight: 800 }}>
            {selectedReport.status}
          </span>
          {selectedReport.status === "draft" && canEditReports && (
            <button
              type="button"
              onClick={() => onEdit?.(selectedReport)}
              style={{ height: 36, padding: "0 14px", border: "1px solid var(--border)", borderRadius: 8, background: "#fff", color: "var(--text)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
            >
              Edit
            </button>
          )}
          {canAct && flow && (
            <button
              type="button"
              disabled={updating}
              onClick={() => performAction(flow.next)}
              style={{ height: 36, padding: "0 14px", border: "none", borderRadius: 8, background: flow.bg, color: flow.color, fontWeight: 800, fontSize: 13, cursor: "pointer" }}
            >
              {updating ? "..." : flow.label}
            </button>
          )}
          {canPrintReports && (
            <>
              <button className="dash-btn-secondary" type="button" onClick={() => window.print()} style={{ height: 36 }}>
                {Icons.report} Print
              </button>
              <button className="dash-btn-secondary" type="button" onClick={() => downloadAsPdf(selectedReport)} style={{ height: 36 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download PDF
              </button>
            </>
          )}
          {canDeleteReports && selectedReport.status === "draft" && (
            <button
              type="button"
              onClick={() => onDelete?.(selectedReport._id)}
              style={{ height: 36, padding: "0 14px", border: "1px solid var(--error)", borderRadius: 8, background: "#fff", color: "var(--error)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {error && <div className="module-alert" style={{ marginTop: 12 }}>{error}</div>}

      <div className="report-patient-grid">
        <div>
          <span>Patient</span>
          <strong>{selectedReport.patient?.name}</strong>
        </div>
        <div>
          <span>Patient ID</span>
          <strong>{selectedReport.patient?.patientId}</strong>
        </div>
        <div>
          <span>Age / Gender</span>
          <strong>{selectedReport.patient?.age} / {selectedReport.patient?.gender}</strong>
        </div>
        <div>
          <span>Sample</span>
          <strong>{selectedReport.testSnapshot?.sampleType || "-"}</strong>
        </div>
      </div>

      <div className="report-result-table">
        <div className="report-result-head">
          <span>Parameter</span>
          <span>Result</span>
          <span>Unit</span>
          <span>Normal Range</span>
          <span>Flag</span>
        </div>
        {selectedReport.results?.map((result) => (
          <div key={result.key} className={`report-result-row ${result.flag}`}>
            <span>{result.name}</span>
            <strong>{result.textValue || result.value || "-"}</strong>
            <span>{result.unit || "-"}</span>
            <span>{rangeText(result)}</span>
            <span>{result.flag === "normal" ? "Normal" : result.flag}</span>
          </div>
        ))}
      </div>

      {selectedReport.remarks && <p className="report-remarks">{selectedReport.remarks}</p>}
    </section>
  );
}
