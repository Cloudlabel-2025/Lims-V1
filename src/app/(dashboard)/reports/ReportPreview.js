"use client";

import { useState, useRef } from "react";
import Image from "next/image";
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
  draft: { next: "review", label: "Review", permission: "reports.verify", color: "#1d4ed8", bg: "#eff6ff" },
  reviewed: { next: "approve", label: "Approve", permission: "reports.verify", color: "#15803d", bg: "#f0fdf4" },
  approved: { next: "release", label: "Release", permission: "reports.release", color: "#047857", bg: "#ecfdf5" },
};

const statusBadge = {
  draft: ["#f1f5f9", "#475569"],
  reviewed: ["#eff6ff", "#1d4ed8"],
  approved: ["#f0fdf4", "#15803d"],
  released: ["#ecfdf5", "#047857"],
};

const templateLabels = {
  "coa": "Certificate of Analysis",
  "test-report": "Test Report",
  "summary": "Summary Report",
};

export default function ReportPreview({ selectedReport, labConfig, canEditReports, canPrintReports, canVerifyReports, canReleaseReports, canDeleteReports, onReportUpdated, onSuccess, onDelete }) {
  const [updating, setUpdating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const printRef = useRef(null);

  if (!selectedReport) return null;

  const flow = statusFlow[selectedReport.status];
  const canAct =
    (flow?.next === "review" && canVerifyReports) ||
    (flow?.next === "approve" && canVerifyReports) ||
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
      onSuccess?.(`Report ${data.report?.reportId || ""} ${action === "review" ? "reviewed" : action === "approve" ? "approved" : "released"} successfully.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdating(false);
    }
  }

  async function downloadPdf() {
    setDownloading(true);
    setError("");
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: html2canvas } = await import("html2canvas");
      const element = printRef.current;
      if (!element) return;
      const canvas = await html2canvas(element, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      let heightLeft = pdfHeight;
      let position = 0;
      const pageHeight = pdf.internal.pageSize.getHeight();
      pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;
      while (heightLeft > 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }
      pdf.save(`${selectedReport.reportId || "report"}.pdf`);
    } catch (err) {
      setError("Failed to generate PDF: " + err.message);
    } finally {
      setDownloading(false);
    }
  }

  const [badgeBg, badgeColor] = statusBadge[selectedReport.status] || ["var(--surface)", "var(--text-secondary)"];
  const templateLabel = templateLabels[selectedReport.template] || selectedReport.template || "Test Report";

  const labName = labConfig?.labName || "Laboratory";
  const labLogo = labConfig?.logo;
  const now = new Date();

  return (
    <section className="module-panel report-preview">
      <div className="report-title-row">
        <div>
          <p className="module-kicker">Structured Report</p>
          <h2>{selectedReport.testSnapshot?.name}</h2>
          <span>{selectedReport.reportId}</span>
          {selectedReport.sampleId && <span className="report-sample-id-badge">Sample: {selectedReport.sampleId}</span>}
          {selectedReport.version > 1 && <span className="report-version-badge">v{selectedReport.version}</span>}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span className="report-template-badge">{templateLabel}</span>
          <span style={{ background: badgeBg, color: badgeColor, borderRadius: 6, padding: "4px 10px", fontSize: 12, fontWeight: 800 }}>
            {selectedReport.status}
          </span>
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
              <button className="dash-btn-secondary" type="button" onClick={downloadPdf} disabled={downloading} style={{ height: 36 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                {downloading ? "..." : "PDF"}
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

      <div id="report-print-area" ref={printRef} className="report-print-area">
        <div className="report-print-header">
          <div className="report-print-header-fallback">
            {labLogo && <Image src={labLogo} alt={labName} width={120} height={48} className="report-logo-img" unoptimized />}
            <h1>{labName} Laboratory Report</h1>
          </div>
          <p className="report-print-header-date">{now.toLocaleDateString("en-IN")} {now.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true })}</p>
        </div>

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
            <strong>{selectedReport.patient?.age || "-"} / {selectedReport.patient?.gender || "-"}</strong>
          </div>
          <div>
            <span>Sample</span>
            <strong>{selectedReport.testSnapshot?.sampleType || "-"}</strong>
          </div>
          <div>
            <span>Sample ID</span>
            <strong>{selectedReport.sampleId || "-"}</strong>
          </div>
          <div>
            <span>Report Date</span>
            <strong>{new Date(selectedReport.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</strong>
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

        <div className="report-print-footer">
          <p>{labName} Laboratory Report | Generated on {now.toLocaleDateString("en-IN")} {now.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true })}</p>
        </div>
      </div>

      <div className="report-status-history">
        {selectedReport.reviewedAt && (
          <div><strong>Reviewed:</strong> {new Date(selectedReport.reviewedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })} {selectedReport.reviewedBy ? `by ${selectedReport.reviewedBy}` : ""}</div>
        )}
        {selectedReport.approvedAt && (
          <div><strong>Approved:</strong> {new Date(selectedReport.approvedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })} {selectedReport.approvedBy ? `by ${selectedReport.approvedBy}` : ""}</div>
        )}
        {selectedReport.releasedAt && (
          <div><strong>Released:</strong> {new Date(selectedReport.releasedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })} {selectedReport.releasedBy ? `by ${selectedReport.releasedBy}` : ""}</div>
        )}
        {selectedReport.enteredBy && (
          <div><strong>Entered by:</strong> {selectedReport.enteredBy}</div>
        )}
        {selectedReport.version > 1 && (
          <div><strong>Version:</strong> {selectedReport.version} ({selectedReport.previousVersions?.length || 0} previous revision{(selectedReport.previousVersions?.length || 0) !== 1 ? "s" : ""})</div>
        )}
      </div>
    </section>
  );
}
