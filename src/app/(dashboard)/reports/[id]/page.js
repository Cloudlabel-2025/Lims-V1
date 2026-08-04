"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { Icons } from "@/app/components/Icons";
import { hasPermission } from "@/app/lib/client-rbac";
import { useCurrentUser } from "@/app/lib/use-current-user";

const STATUS_STEPS = ["draft", "reviewed", "approved", "released"];
const statusFlow = {
  draft: { next: "review", label: "Submit review", permission: "reports.verify" },
  reviewed: { next: "approve", label: "Approve report", permission: "reports.verify" },
  approved: { next: "release", label: "Release report", permission: "reports.release" },
};
const templateLabels = { coa: "Certificate of Analysis", "test-report": "Diagnostic Test Report", summary: "Summary Report" };

function rangeText(result) {
  const hasMin = Number.isFinite(result.normalMin);
  const hasMax = Number.isFinite(result.normalMax);
  if (hasMin && hasMax) return `${result.normalMin} – ${result.normalMax}`;
  if (hasMin) return `≥ ${result.normalMin}`;
  if (hasMax) return `≤ ${result.normalMax}`;
  return "—";
}

function formatDate(value, withTime = false) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hour12: true } : {}),
  });
}

function formatStatus(value) {
  return String(value || "Unknown").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function ReportDetailLoading() {
  return <div className="report-detail-loading" aria-label="Loading report" aria-busy="true"><span /><span /><div /></div>;
}

export default function ReportViewPage() {
  const { id } = useParams();
  const router = useRouter();
  const user = useCurrentUser();
  const [report, setReport] = useState(null);
  const [labConfig, setLabConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const printRef = useRef(null);

  const canPrintReports = hasPermission(user, "reports.print");
  const canVerifyReports = hasPermission(user, "reports.verify");
  const canReleaseReports = hasPermission(user, "reports.release");
  const canDeleteReports = hasPermission(user, "reports.delete");

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [reportResponse, themeResponse] = await Promise.all([
        fetch(`/api/reports/${id}`, { credentials: "include" }),
        fetch("/api/theme", { credentials: "include" }),
      ]);
      const reportData = await reportResponse.json();
      if (!reportResponse.ok) throw new Error(reportData.error || "Report not found");
      setReport(reportData.report);
      if (themeResponse.ok) {
        const themeData = await themeResponse.json();
        setLabConfig(themeData.theme || null);
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadReport(); }, [loadReport]);

  const resultSummary = useMemo(() => (report?.results || []).reduce((summary, result) => {
    summary.total += 1;
    if (result.flag === "high") summary.high += 1;
    if (result.flag === "low") summary.low += 1;
    return summary;
  }, { total: 0, high: 0, low: 0 }), [report]);

  const performAction = useCallback(async (action) => {
    setUpdating(true);
    setError("");
    try {
      const response = await fetch(`/api/reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update report");
      setReport(data.report);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setUpdating(false);
    }
  }, [id]);

  async function downloadPdf() {
    const element = printRef.current;
    if (!element) return;
    setDownloading(true);
    setError("");
    element.classList.add("is-pdf-exporting");
    try {
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([import("jspdf"), import("html2canvas")]);
      const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false });
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
      const margin = 8;
      const usableWidth = pdf.internal.pageSize.getWidth() - margin * 2;
      const usableHeight = pdf.internal.pageSize.getHeight() - margin * 2;
      const pageHeightPixels = Math.floor((usableHeight / usableWidth) * canvas.width);
      const scale = canvas.width / element.scrollWidth;
      const protectedBottoms = Array.from(element.querySelectorAll(".corporate-result-row, .corporate-report-section, .corporate-signature"))
        .map((node) => Math.round((node.offsetTop + node.offsetHeight) * scale))
        .sort((a, b) => a - b);
      let offset = 0;
      let pageNumber = 0;
      while (offset < canvas.height) {
        const target = Math.min(offset + pageHeightPixels, canvas.height);
        const safeBreak = protectedBottoms.filter((bottom) => bottom > offset + pageHeightPixels * .55 && bottom <= target).at(-1);
        const end = target < canvas.height && safeBreak ? safeBreak : target;
        const sliceHeight = Math.max(1, end - offset);
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeight;
        pageCanvas.getContext("2d").drawImage(canvas, 0, offset, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
        if (pageNumber > 0) pdf.addPage();
        const sliceHeightMm = (sliceHeight * usableWidth) / canvas.width;
        pdf.addImage(pageCanvas.toDataURL("image/jpeg", .95), "JPEG", margin, margin, usableWidth, sliceHeightMm, undefined, "FAST");
        offset = end;
        pageNumber += 1;
      }
      pdf.save(`${report.reportId || "clinical-report"}.pdf`);
    } catch (requestError) {
      setError(`Failed to generate PDF: ${requestError.message}`);
    } finally {
      element.classList.remove("is-pdf-exporting");
      setDownloading(false);
    }
  }

  async function handleDelete() {
    setConfirmDelete(false);
    setError("");
    try {
      const response = await fetch(`/api/reports/${id}`, { method: "DELETE", credentials: "include" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to delete report");
      router.push("/reports");
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  if (loading) return <ReportDetailLoading />;

  if (!report) {
    return <section className="report-detail-error"><span>{Icons.alertCircle}</span><h1>Report unavailable</h1><p>{error || "The requested report could not be found."}</p><div><button type="button" className="dash-btn-secondary" onClick={() => router.push("/reports")}>{Icons.arrowLeft} Back to reports</button><button type="button" className="dash-btn-primary" onClick={loadReport}>{Icons.refresh} Retry</button></div></section>;
  }

  const flow = statusFlow[report.status];
  const canAct = (flow?.next === "review" && canVerifyReports) || (flow?.next === "approve" && canVerifyReports) || (flow?.next === "release" && canReleaseReports);
  const templateLabel = templateLabels[report.template] || report.template || "Diagnostic Test Report";
  const labName = labConfig?.labName || "Laboratory";
  const labLogo = labConfig?.logo;
  const statusIndex = STATUS_STEPS.indexOf(report.status);
  const now = new Date();

  return (
    <div className="report-detail-workspace">
      <header className="report-detail-heading">
        <div className="report-detail-title">
          <button type="button" className="report-back-link" onClick={() => router.push("/reports")}>{Icons.arrowLeft} Reports</button>
          <p>Clinical report review</p>
          <h1>{report.testSnapshot?.name || "Diagnostic report"}</h1>
          <div><span>{report.reportId}</span><span>{report.sampleId || "No sample ID"}</span>{report.version > 1 && <span>Version {report.version}</span>}</div>
        </div>
        <div className="report-detail-actions">
          <span className={`report-detail-status ${report.status}`}>{formatStatus(report.status)}</span>
          {canPrintReports && <button type="button" className="dash-btn-secondary" onClick={() => window.print()}>{Icons.report} Print</button>}
          {canPrintReports && <button type="button" className="dash-btn-secondary" onClick={downloadPdf} disabled={downloading}>{Icons.download} {downloading ? "Preparing PDF…" : "Download PDF"}</button>}
          {canAct && flow && <button type="button" className="dash-btn-primary" disabled={updating} onClick={() => { setError(""); setConfirmAction(flow.next); }}>{updating ? "Updating…" : flow.label}</button>}
        </div>
      </header>

      {error && <div className="report-detail-alert" role="alert"><span>{Icons.alertCircle}</span><div><strong>Unable to complete the request</strong><p>{error}</p></div><button type="button" onClick={() => setError("")} aria-label="Dismiss error">{Icons.close}</button></div>}

      <div className="report-detail-layout">
        <main className="report-document-shell">
          <div ref={printRef} id="report-print-area" className={`corporate-report-document clinical-report-v2 ${report.status !== "released" ? "unreleased" : ""}`} data-watermark={report.status === "draft" ? "DRAFT" : report.status === "reviewed" ? "UNDER REVIEW" : report.status === "approved" ? "APPROVED" : ""}>
            <div className="clinical-report-accent" />
            <header className="clinical-letterhead">
              <div className="clinical-letterhead-brand">
                <span className="clinical-letterhead-logo">{labLogo ? <Image src={labLogo} alt={labName} width={120} height={52} unoptimized /> : Icons.logo}</span>
                <div><strong>{labName}</strong><span>Diagnostic Laboratory Services</span><small>Accurate results · Responsible care</small></div>
              </div>
              <div className="clinical-document-title"><small>Confidential medical record</small><h2>{templateLabel}</h2><span className={`clinical-document-status ${report.status}`}>{formatStatus(report.status)}</span></div>
            </header>

            <section className="clinical-report-identifiers corporate-report-section">
              <div><small>Report ID</small><strong>{report.reportId || "—"}</strong></div>
              <div><small>Sample ID</small><strong>{report.sampleId || "—"}</strong></div>
              <div><small>Registered</small><strong>{formatDate(report.createdAt)}</strong></div>
              <div><small>Document version</small><strong>Version {report.version || 1}</strong></div>
            </section>

            <section className="clinical-patient-registry corporate-report-section">
              <header><div><small>Patient details</small><h2>{report.patient?.name || "Patient name unavailable"}</h2></div><strong>{report.patient?.patientId || "No patient ID"}</strong></header>
              <div className="clinical-patient-fields">
                <div><span>Age / Gender</span><strong>{report.patient?.age ?? "—"} years / {report.patient?.gender || "—"}</strong></div>
                <div><span>Contact number</span><strong>{report.patient?.phone || "Not recorded"}</strong></div>
                <div className="wide"><span>Address</span><strong>{report.patient?.address || "Not recorded"}</strong></div>
              </div>
            </section>

            <section className="clinical-investigation-summary corporate-report-section">
              <div className="clinical-investigation-name"><small>Investigation requested</small><h2>{report.testSnapshot?.name || "Diagnostic investigation"}</h2><span>{report.testSnapshot?.categoryName || "Laboratory test"}</span></div>
              <div><small>Test code</small><strong>{report.testSnapshot?.code || "—"}</strong></div>
              <div><small>Specimen</small><strong>{report.testSnapshot?.sampleType || "—"}</strong></div>
            </section>

            {(resultSummary.high > 0 || resultSummary.low > 0) && <section className="clinical-attention-note corporate-report-section"><span>{Icons.alertCircle}</span><div><strong>Attention required</strong><p>This report contains {resultSummary.high + resultSummary.low} result{resultSummary.high + resultSummary.low === 1 ? "" : "s"} outside the stated reference interval.</p></div><em>{resultSummary.high ? `${resultSummary.high} high` : ""}{resultSummary.high && resultSummary.low ? " · " : ""}{resultSummary.low ? `${resultSummary.low} low` : ""}</em></section>}

            <section className="clinical-results-block corporate-report-section">
              <header><div><small>Laboratory findings</small><h2>Result summary</h2></div><span>{resultSummary.total} parameter{resultSummary.total === 1 ? "" : "s"}</span></header>
              <div className="corporate-results-table clinical-results-table" role="table" aria-label="Report results">
                <div className="corporate-result-head" role="row"><span>Investigation / Parameter</span><span>Observed value</span><span>Unit</span><span>Biological reference interval</span><span>Flag</span></div>
                {(report.results || []).map((result) => (
                  <div key={result.key} className={`corporate-result-row ${result.flag || "normal"}`} role="row">
                    <span data-label="Parameter">{result.name}</span><strong data-label="Observed value">{result.textValue || result.value || "—"}</strong><span data-label="Unit">{result.unit || "—"}</span><span data-label="Reference interval">{rangeText(result)}</span><span data-label="Flag" className="corporate-result-flag">{result.flag === "normal" ? "Normal" : `${result.flag === "high" ? "↑" : "↓"} ${formatStatus(result.flag)}`}</span>
                  </div>
                ))}
              </div>
              <p className="clinical-reference-note">Reference intervals may vary with age, gender, clinical condition, and analytical method. Please correlate results clinically.</p>
            </section>

            {report.remarks && <section className="clinical-report-remarks corporate-report-section"><header><small>Laboratory comment</small><h2>Interpretation / Remarks</h2></header><p>{report.remarks}</p></section>}

            <section className="clinical-authorization corporate-report-section">
              <div className="clinical-auth-note"><span>{Icons.shield}</span><div><strong>Electronically generated report</strong><p>Validation and release events are recorded in the laboratory audit trail.</p></div></div>
              <div className="corporate-signature"><small>Reviewed by</small><strong>{report.reviewedBy || "Pending review"}</strong><span>{formatDate(report.reviewedAt, true)}</span></div>
              <div className="corporate-signature"><small>Authorized by</small><strong>{report.releasedBy || report.approvedBy || "Pending authorization"}</strong><span>{formatDate(report.releasedAt || report.approvedAt, true)}</span></div>
            </section>

            <footer className="clinical-report-footer"><div><strong>{labName}</strong><span>{report.reportId} · {templateLabel}</span></div><p>This report relates only to the specimen tested. It is confidential and intended for the patient and authorized healthcare professionals.</p><div><span>Generated {now.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}</span><span>End of report</span></div></footer>
          </div>
        </main>

        <aside className="report-detail-sidebar">
          <section className="report-workflow-card">
            <header><span>{Icons.activity}</span><div><small>Quality workflow</small><h2>Report progress</h2></div></header>
            <div className="report-workflow-steps">
              {STATUS_STEPS.map((step, index) => <div key={step} className={`${index <= statusIndex ? "complete" : ""} ${index === statusIndex ? "current" : ""}`}><span>{index < statusIndex ? "✓" : index + 1}</span><div><strong>{formatStatus(step)}</strong><small>{index < statusIndex ? "Completed" : index === statusIndex ? "Current stage" : "Pending"}</small></div></div>)}
            </div>
          </section>

          <section className="report-quality-card">
            <header><small>Result overview</small><h2>Quality signals</h2></header>
            <div><span>Total parameters</span><strong>{resultSummary.total}</strong></div><div><span>High results</span><strong className={resultSummary.high ? "danger" : ""}>{resultSummary.high}</strong></div><div><span>Low results</span><strong className={resultSummary.low ? "warning" : ""}>{resultSummary.low}</strong></div>
          </section>

          <section className="report-audit-card">
            <header><small>Traceability</small><h2>Audit record</h2></header>
            <div><span>Created</span><strong>{formatDate(report.createdAt, true)}</strong><small>{report.enteredBy || "User not recorded"}</small></div>
            {report.reviewedAt && <div><span>Reviewed</span><strong>{formatDate(report.reviewedAt, true)}</strong><small>{report.reviewedBy}</small></div>}
            {report.approvedAt && <div><span>Approved</span><strong>{formatDate(report.approvedAt, true)}</strong><small>{report.approvedBy}</small></div>}
            {report.releasedAt && <div><span>Released</span><strong>{formatDate(report.releasedAt, true)}</strong><small>{report.releasedBy}</small></div>}
            {report.version > 1 && <div><span>Document version</span><strong>Version {report.version}</strong><small>{report.previousVersions?.length || 0} previous revision{(report.previousVersions?.length || 0) === 1 ? "" : "s"}</small></div>}
          </section>

          {canDeleteReports && report.status === "draft" && <button type="button" className="report-delete-action" onClick={() => { setError(""); setConfirmDelete(true); }}>{Icons.trash} Delete draft report</button>}
        </aside>
      </div>

      {(confirmAction || confirmDelete) && (
        <div className="report-confirm-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !updating) { setConfirmAction(null); setConfirmDelete(false); } }}>
          <section className={`report-confirm-dialog ${confirmDelete ? "danger" : ""}`} role="dialog" aria-modal="true" aria-labelledby="report-confirm-title">
            <span>{confirmDelete ? Icons.trash : Icons.shield}</span>
            <div><p>{confirmDelete ? "Destructive action" : "Workflow confirmation"}</p><h2 id="report-confirm-title">{confirmDelete ? "Delete draft report?" : `${formatStatus(confirmAction)} this report?`}</h2><p>{confirmDelete ? "This permanently removes the draft report and cannot be undone." : `This moves ${report.reportId} to the next controlled workflow stage and records your account in the audit trail.`}</p></div>
            <footer><button type="button" className="dash-btn-secondary" onClick={() => { setConfirmAction(null); setConfirmDelete(false); }} disabled={updating}>Cancel</button><button type="button" className={confirmDelete ? "report-confirm-danger" : "dash-btn-primary"} disabled={updating} onClick={() => { if (confirmDelete) handleDelete(); else { const action = confirmAction; setConfirmAction(null); performAction(action); } }}>{updating ? "Working…" : confirmDelete ? "Delete report" : `Confirm ${confirmAction}`}</button></footer>
          </section>
        </div>
      )}
    </div>
  );
}
