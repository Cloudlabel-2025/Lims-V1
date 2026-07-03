"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Icons } from "@/app/components/Icons";
import { hasPermission } from "@/app/lib/client-rbac";
import { useCurrentUser } from "@/app/lib/use-current-user";

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
  const printRef = useRef(null);

  const canEditReports = hasPermission(user, "reports.edit");
  const canPrintReports = hasPermission(user, "reports.print");
  const canVerifyReports = hasPermission(user, "reports.verify");
  const canReleaseReports = hasPermission(user, "reports.release");
  const canDeleteReports = hasPermission(user, "reports.delete");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [reportRes, themeRes] = await Promise.all([
          fetch(`/api/reports/${id}`, { credentials: "include" }),
          fetch("/api/theme", { credentials: "include" }),
        ]);
        const reportData = await reportRes.json();
        if (!reportRes.ok) throw new Error(reportData.error || "Report not found");
        if (!cancelled) {
          setReport(reportData.report);
          if (themeRes.ok) {
            const themeData = await themeRes.json();
            setLabConfig(themeData.theme || null);
          }
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  const performAction = useCallback(async (action) => {
    setUpdating(true);
    setError("");
    try {
      const res = await fetch(`/api/reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to update report");
      setReport(data.report);
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdating(false);
    }
  }, [id]);

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
      pdf.save(`${report.reportId || "report"}.pdf`);
    } catch (err) {
      setError("Failed to generate PDF: " + err.message);
    } finally {
      setDownloading(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this report? This action cannot be undone.")) return;
    setError("");
    try {
      const res = await fetch(`/api/reports/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to delete report");
      router.push("/reports");
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) {
    return (
      <div className="module-page">
        <div className="module-header"><h1>Loading report...</h1></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="module-page">
        <div className="module-header">
          <button className="dash-btn-secondary" onClick={() => router.push("/reports")}>{Icons.back} Back to Reports</button>
        </div>
        <div className="module-alert">{error}</div>
      </div>
    );
  }

  if (!report) return null;

  const flow = statusFlow[report.status];
  const canAct =
    (flow?.next === "review" && canVerifyReports) ||
    (flow?.next === "approve" && canVerifyReports) ||
    (flow?.next === "release" && canReleaseReports);
  const [badgeBg, badgeColor] = statusBadge[report.status] || ["var(--surface)", "var(--text-secondary)"];
  const templateLabel = templateLabels[report.template] || report.template || "Test Report";
  const labName = labConfig?.labName || "Laboratory";
  const labLogo = labConfig?.logo;
  const now = new Date();

  return (
    <div className="module-page">
      <div className="module-header">
        <div>
          <button className="dash-btn-secondary" onClick={() => router.push("/reports")} style={{ marginBottom: 8 }}>
            {Icons.back} Back to Reports
          </button>
          <p className="module-kicker">Structured Report</p>
          <h1>{report.testSnapshot?.name}</h1>
          <span>{report.reportId}</span>
          {report.sampleId && <span className="report-sample-id-badge">Sample: {report.sampleId}</span>}
          {report.version > 1 && <span className="report-version-badge">v{report.version}</span>}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span className="report-template-badge">{templateLabel}</span>
          <span style={{ background: badgeBg, color: badgeColor, borderRadius: 6, padding: "4px 10px", fontSize: 12, fontWeight: 800 }}>
            {report.status}
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
          {canDeleteReports && report.status === "draft" && (
            <button
              type="button"
              onClick={handleDelete}
              style={{ height: 36, padding: "0 14px", border: "1px solid var(--error)", borderRadius: 8, background: "#fff", color: "var(--error)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {error && <div className="module-alert">{error}</div>}

      <div id="report-print-area" ref={printRef} className="report-print-area">
        <div className="report-print-header">
          <div className="report-print-header-fallback">
            {labLogo && <img src={labLogo} alt={labName} className="report-logo-img" />}
            <h1>{labName} Laboratory Report</h1>
          </div>
          <p className="report-print-header-date">{now.toLocaleDateString("en-IN")} {now.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true })}</p>
        </div>

        <div className="report-patient-grid">
          <div><span>Patient</span><strong>{report.patient?.name}</strong></div>
          <div><span>Patient ID</span><strong>{report.patient?.patientId}</strong></div>
          <div><span>Age / Gender</span><strong>{report.patient?.age || "-"} / {report.patient?.gender || "-"}</strong></div>
          <div><span>Sample</span><strong>{report.testSnapshot?.sampleType || "-"}</strong></div>
          <div><span>Sample ID</span><strong>{report.sampleId || "-"}</strong></div>
          <div><span>Report Date</span><strong>{new Date(report.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</strong></div>
        </div>

        <div className="report-result-table">
          <div className="report-result-head">
            <span>Parameter</span><span>Result</span><span>Unit</span><span>Normal Range</span><span>Flag</span>
          </div>
          {report.results?.map((result) => (
            <div key={result.key} className={`report-result-row ${result.flag}`}>
              <span>{result.name}</span>
              <strong>{result.textValue || result.value || "-"}</strong>
              <span>{result.unit || "-"}</span>
              <span>{rangeText(result)}</span>
              <span>{result.flag === "normal" ? "Normal" : result.flag}</span>
            </div>
          ))}
        </div>

        {report.remarks && <p className="report-remarks">{report.remarks}</p>}

        <div className="report-print-footer">
          <p>{labName} Laboratory Report | Generated on {now.toLocaleDateString("en-IN")} {now.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true })}</p>
        </div>
      </div>

      <div className="report-status-history" style={{ marginTop: 16 }}>
        {report.reviewedAt && <div><strong>Reviewed:</strong> {new Date(report.reviewedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })} {report.reviewedBy ? `by ${report.reviewedBy}` : ""}</div>}
        {report.approvedAt && <div><strong>Approved:</strong> {new Date(report.approvedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })} {report.approvedBy ? `by ${report.approvedBy}` : ""}</div>}
        {report.releasedAt && <div><strong>Released:</strong> {new Date(report.releasedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })} {report.releasedBy ? `by ${report.releasedBy}` : ""}</div>}
        {report.enteredBy && <div><strong>Entered by:</strong> {report.enteredBy}</div>}
        {report.version > 1 && <div><strong>Version:</strong> {report.version} ({report.previousVersions?.length || 0} previous revision{(report.previousVersions?.length || 0) !== 1 ? "s" : ""})</div>}
      </div>
    </div>
  );
}