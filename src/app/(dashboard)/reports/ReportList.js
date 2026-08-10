"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icons } from "@/app/components/Icons";

const STATUS_OPTIONS = ["all", "draft", "reviewed", "approved", "released"];
const RANGE_OPTIONS = ["7", "30", "90"];

function dateDaysAgo(baseDate, days) {
  return new Date(baseDate.getTime() - Number(days) * 86400000).toISOString().split("T")[0];
}

function formatDate(value) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatStatus(value) {
  return String(value || "Unknown").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getResultSignals(report) {
  const results = report.results || [];
  const high = results.filter((result) => result.flag === "high").length;
  const low = results.filter((result) => result.flag === "low").length;
  return { high, low, total: results.length };
}

function getInvestigations(report) {
  return report.investigations?.length
    ? report.investigations
    : [{ testSnapshot: report.testSnapshot, results: report.results || [] }];
}

export default function ReportList({ reports, dateFrom, dateTo, onDateFromChange, onDateToChange, loading }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [today] = useState(() => new Date());

  const statusCounts = useMemo(() => reports.reduce((counts, report) => {
    counts[report.status] = (counts[report.status] || 0) + 1;
    return counts;
  }, {}), [reports]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return reports.filter((report) => {
      const investigations = getInvestigations(report);
      const matchesStatus = statusFilter === "all" || report.status === statusFilter;
      const matchesSearch = !query || [
        report.patient?.name,
        report.patient?.patientId,
        ...investigations.flatMap((item) => [item.testSnapshot?.name, item.testSnapshot?.code]),
        report.reportId,
        report.sampleId,
      ].some((value) => String(value || "").toLowerCase().includes(query));
      return matchesStatus && matchesSearch;
    });
  }, [reports, search, statusFilter]);

  const activeRange = dateFrom && !dateTo
    ? RANGE_OPTIONS.find((days) => dateFrom === dateDaysAgo(today, days)) || "custom"
    : dateFrom || dateTo ? "custom" : "all";

  function changeRange(value) {
    if (value === "all") {
      onDateFromChange?.("");
      onDateToChange?.("");
      return;
    }
    if (value === "custom") return;
    onDateFromChange?.(dateDaysAgo(today, value));
    onDateToChange?.("");
  }

  return (
    <section className="reports-directory">
      <header className="reports-directory-header">
        <div><span>Report directory</span><h2>Clinical report queue</h2><p>Find reports quickly and move each result through verification and release.</p></div>
        <em>{filtered.length} of {reports.length} report{reports.length === 1 ? "" : "s"}</em>
      </header>

      <nav className="reports-status-tabs" aria-label="Filter reports by status">
        {STATUS_OPTIONS.map((option) => (
          <button key={option} type="button" className={`${statusFilter === option ? "active" : ""} ${option}`} onClick={() => setStatusFilter(option)}>
            <strong>{option === "all" ? "All reports" : formatStatus(option)}</strong>
            <em>{option === "all" ? reports.length : statusCounts[option] || 0}</em>
          </button>
        ))}
      </nav>

      <div className="reports-toolbar">
        <label className="reports-search">
          <span>{Icons.search}</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search patient, report, sample, or test…" />
          {search && <button type="button" onClick={() => setSearch("")} aria-label="Clear search">{Icons.close}</button>}
        </label>
        <label className="reports-filter-control">
          <span>Period</span>
          <select value={activeRange} onChange={(event) => changeRange(event.target.value)}>
            <option value="all">All time</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="custom">Custom dates</option>
          </select>
        </label>
        <label className="reports-filter-control date"><span>From</span><input type="date" value={dateFrom || ""} onChange={(event) => onDateFromChange?.(event.target.value)} /></label>
        <label className="reports-filter-control date"><span>To</span><input type="date" value={dateTo || ""} onChange={(event) => onDateToChange?.(event.target.value)} /></label>
        {(dateFrom || dateTo || search || statusFilter !== "all") && <button className="reports-clear-filters" type="button" onClick={() => { setSearch(""); setStatusFilter("all"); onDateFromChange?.(""); onDateToChange?.(""); }}>Clear filters</button>}
      </div>

      {filtered.length ? (
        <div className={`reports-table ${loading ? "is-refreshing" : ""}`} role="table" aria-label="Clinical reports">
          <div className="reports-table-head" role="row"><span>Report & investigation</span><span>Patient</span><span>Specimen</span><span>Result signals</span><span>Created</span><span>Status</span><span aria-label="Actions" /></div>
          {filtered.map((report) => {
            const signals = getResultSignals(report);
            const investigations = getInvestigations(report);
            const investigationNames = investigations.map((item) => item.testSnapshot?.name).filter(Boolean);
            const investigationCodes = investigations.map((item) => item.testSnapshot?.code).filter(Boolean);
            return (
              <article className="reports-table-row" role="row" key={report._id}>
                <div className="reports-report-cell" role="cell" data-label="Report">
                  <span className="reports-file-icon">{Icons.report}</span>
                  <div><strong>{investigationNames.join(", ") || "Unnamed investigation"}</strong><span>{report.reportId || "Report ID pending"}{report.billingRecord?.billId ? ` · ${report.billingRecord.billId}` : ""}{report.version > 1 ? ` · Version ${report.version}` : ""}</span><small>{investigations.length} investigation{investigations.length === 1 ? "" : "s"} · {investigationCodes.join(", ") || "Diagnostic report"}</small></div>
                </div>
                <div className="reports-patient-cell" role="cell" data-label="Patient"><strong>{report.patient?.name || "Patient unavailable"}</strong><span>{report.patient?.patientId || "No patient ID"}</span><small>{report.patient?.age || "—"} yrs · {report.patient?.gender || "Not specified"}</small></div>
                <div className="reports-specimen-cell" role="cell" data-label="Specimen"><strong>{report.sampleId || "Not linked"}</strong><span>{report.testSnapshot?.sampleType || "Sample type unavailable"}</span></div>
                <div className="reports-signals-cell" role="cell" data-label="Result signals">
                  {signals.high || signals.low ? <><strong className="flagged">{signals.high + signals.low} flagged</strong><span>{signals.high ? `${signals.high} high` : ""}{signals.high && signals.low ? " · " : ""}{signals.low ? `${signals.low} low` : ""}</span></> : <><strong className="normal">Within range</strong><span>{signals.total} parameter{signals.total === 1 ? "" : "s"}</span></>}
                </div>
                <div className="reports-date-cell" role="cell" data-label="Created"><strong>{formatDate(report.createdAt)}</strong><span>{report.enteredBy ? `Entered by ${report.enteredBy}` : "Origin not recorded"}</span></div>
                <div className="reports-status-cell" role="cell" data-label="Status"><span className={`reports-status-badge ${report.status}`}>{formatStatus(report.status)}</span></div>
                <div className="reports-action-cell" role="cell"><button type="button" onClick={() => router.push(`/reports/${report._id}`)} aria-label={`Open report ${report.reportId || ""}`}>Open report {Icons.chevronRight}</button></div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="reports-empty-state">
          <span>{reports.length ? Icons.noResults : Icons.report}</span>
          <h3>{reports.length ? "No reports match these filters" : "No reports have been generated"}</h3>
          <p>{reports.length ? "Clear or adjust the search, status, and date filters." : "Reports will appear here after sample results are completed."}</p>
          {reports.length > 0 && <button type="button" onClick={() => { setSearch(""); setStatusFilter("all"); onDateFromChange?.(""); onDateToChange?.(""); }}>Clear all filters</button>}
        </div>
      )}
    </section>
  );
}
