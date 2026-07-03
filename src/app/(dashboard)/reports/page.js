"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Icons } from "@/app/components/Icons";
import { cachedJsonFetch, useCurrentUser } from "@/app/lib/use-current-user";

const ReportList = dynamic(() => import("./ReportList"), {
  ssr: false,
  loading: () => <aside className="module-panel">Loading reports...</aside>,
});

export default function ReportsPage() {
  const user = useCurrentUser();
  const [reports, setReports] = useState([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const reportResponse = await cachedJsonFetch(`/api/reports${dateFrom || dateTo ? `?dateFrom=${dateFrom}&dateTo=${dateTo}` : ""}`, { ttl: 10_000 });
      const reportData = reportResponse.data;
      if (!reportResponse.response.ok) throw new Error(reportData.error || "Unable to load reports");
      setReports(reportData.reports || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) return <div className="module-page">Loading reports...</div>;

  return (
    <div className="module-page">
      <div className="module-header">
        <div>
          <p className="module-kicker">Generated Reports</p>
          <h1>Reports</h1>
          <span>Auto-generated from completed samples. Review, approve, and release.</span>
        </div>
        <button className="dash-btn-secondary" type="button" onClick={loadData}>
          {Icons.refresh} Refresh
        </button>
      </div>

      {error && <div className="module-alert">{error}</div>}

      <div className="module-grid">
        <ReportList
          reports={reports}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
        />
      </div>
    </div>
  );
}