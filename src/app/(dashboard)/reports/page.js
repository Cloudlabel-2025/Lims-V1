"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Icons } from "@/app/components/Icons";
import { cachedJsonFetch } from "@/app/lib/use-current-user";

const ReportList = dynamic(() => import("./ReportList"), {
  ssr: false,
  loading: () => (
    <section className="reports-directory reports-directory-loading" aria-label="Loading reports" aria-busy="true">
      <div className="reports-loading-line wide" />
      <div className="reports-loading-line" />
      {[1, 2, 3, 4].map((item) => <div className="reports-loading-row" key={item} />)}
    </section>
  ),
});

export default function ReportsPage() {
  const [reports, setReports] = useState([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const reportResponse = await cachedJsonFetch(`/api/reports${params.size ? `?${params}` : ""}`, { ttl: 10_000 });
      const reportData = reportResponse.data;
      if (!reportResponse.response.ok) throw new Error(reportData.error || "Unable to load reports");
      setReports(reportData.reports || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const summary = useMemo(() => reports.reduce((counts, report) => {
    counts.total += 1;
    counts[report.status] = (counts[report.status] || 0) + 1;
    if (report.results?.some((result) => result.flag === "high" || result.flag === "low")) counts.flagged += 1;
    return counts;
  }, { total: 0, draft: 0, reviewed: 0, approved: 0, released: 0, flagged: 0 }), [reports]);

  const pendingReview = summary.draft + summary.reviewed;

  return (
    <div className="reports-workspace">
      <header className="reports-heading">
        <div>
          <p>Clinical reporting</p>
          <h1>Reports</h1>
          <span>Review diagnostic results, complete verification, and release reports with a clear audit trail.</span>
        </div>
        <div className="reports-heading-actions">
          <span className="reports-system-state"><i /> Quality workflow active</span>
          <button className="dash-btn-secondary" type="button" onClick={loadData} disabled={loading}>
            <span className={loading ? "icon-spin" : ""}>{Icons.refresh}</span> Refresh
          </button>
        </div>
      </header>

      <section className="reports-metrics" aria-label="Report workflow summary">
        <article>
          <span className="reports-metric-icon">{Icons.report}</span>
          <div><small>Total reports</small><strong>{summary.total}</strong><p>Within selected period</p></div>
        </article>
        <article>
          <span className="reports-metric-icon pending">{Icons.clock}</span>
          <div><small>Pending verification</small><strong>{pendingReview}</strong><p>Draft or reviewed</p></div>
        </article>
        <article>
          <span className="reports-metric-icon approved">{Icons.shield}</span>
          <div><small>Approved</small><strong>{summary.approved}</strong><p>Ready for release</p></div>
        </article>
        <article>
          <span className="reports-metric-icon released">{Icons.download}</span>
          <div><small>Released</small><strong>{summary.released}</strong><p>Available to recipients</p></div>
        </article>
        <article className={summary.flagged ? "attention" : ""}>
          <span className="reports-metric-icon flagged">{Icons.alertCircle}</span>
          <div><small>Flagged results</small><strong>{summary.flagged}</strong><p>Reports with high or low values</p></div>
        </article>
      </section>

      {error && (
        <div className="reports-alert" role="alert">
          <span>{Icons.alertCircle}</span>
          <div><strong>Reports could not be loaded</strong><p>{error}</p></div>
          <button type="button" onClick={loadData}>{Icons.refresh} Retry</button>
        </div>
      )}

      <ReportList
        reports={reports}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        loading={loading}
      />
    </div>
  );
}
