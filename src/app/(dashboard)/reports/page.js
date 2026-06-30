"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Icons } from "@/app/components/Icons";
import SuccessDialog from "@/app/components/SuccessDialog";
import { hasPermission } from "@/app/lib/client-rbac";
import { cachedJsonFetch, clearCachedApi, useCurrentUser } from "@/app/lib/use-current-user";

const ReportEntryPanel = dynamic(() => import("./ReportEntryPanel"), {
  ssr: false,
  loading: () => <section className="module-panel">Loading result entry...</section>,
});

const ReportList = dynamic(() => import("./ReportList"), {
  ssr: false,
  loading: () => <aside className="module-panel">Loading reports...</aside>,
});

const ReportPreview = dynamic(() => import("./ReportPreview"), {
  ssr: false,
  loading: () => <section className="module-panel report-preview">Loading preview...</section>,
});

export default function ReportsPage() {
  const user = useCurrentUser();
  const [patients, setPatients] = useState([]);
  const [tests, setTests] = useState([]);
  const [samples, setSamples] = useState([]);
  const [reports, setReports] = useState([]);
  const [selectedSample, setSelectedSample] = useState("");
  const [selectedPatient, setSelectedPatient] = useState("");
  const [selectedTest, setSelectedTest] = useState("");
  const [results, setResults] = useState({});
  const [remarks, setRemarks] = useState("");
  const [selectedReport, setSelectedReport] = useState(null);
  const [editingReport, setEditingReport] = useState(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const test = useMemo(() => tests.find((item) => item._id === selectedTest), [tests, selectedTest]);
  const sortedParameters = useMemo(
    () => (test?.parameters || []).slice().sort((a, b) => a.sortOrder - b.sortOrder),
    [test]
  );
  const canEditReports = hasPermission(user, "reports.edit");
  const canPrintReports = hasPermission(user, "reports.print");
  const canVerifyReports = hasPermission(user, "reports.verify");
  const canReleaseReports = hasPermission(user, "reports.release");
  const canDeleteReports = hasPermission(user, "reports.delete");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [patientResponse, testResponse, sampleResponse, reportResponse] = await Promise.all([
        canEditReports ? cachedJsonFetch("/api/patient", { ttl: 15_000 }) : Promise.resolve(null),
        canEditReports ? cachedJsonFetch("/api/tests/definitions?status=active", { ttl: 30_000 }) : Promise.resolve(null),
        canEditReports ? cachedJsonFetch("/api/samples?status=all", { ttl: 10_000 }) : Promise.resolve(null),
        cachedJsonFetch(`/api/reports${dateFrom || dateTo ? `?dateFrom=${dateFrom}&dateTo=${dateTo}` : ""}`, { ttl: 10_000 }),
      ]);
      const patientData = patientResponse ? patientResponse.data : [];
      const testData = testResponse ? testResponse.data : { tests: [] };
      const sampleData = sampleResponse ? sampleResponse.data : { samples: [] };
      const reportData = reportResponse.data;

      if (patientResponse && !patientResponse.response.ok) throw new Error(patientData.error || "Unable to load patients");
      if (testResponse && !testResponse.response.ok) throw new Error(testData.error || "Unable to load tests");
      if (sampleResponse && !sampleResponse.response.ok) throw new Error(sampleData.error || "Unable to load samples");
      if (!reportResponse.response.ok) throw new Error(reportData.error || "Unable to load reports");

      setPatients(Array.isArray(patientData) ? patientData : patientData.patients || []);
      setTests(testData.tests || []);
      setSamples((sampleData.samples || []).filter((sample) => ["collected", "processing"].includes(sample.status)));
      setReports(reportData.reports || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [canEditReports, dateFrom, dateTo]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function updateTest(value) {
    setSelectedSample("");
    setSelectedTest(value);
    setResults({});
    setRemarks("");
  }

  function updateSample(value) {
    setSelectedSample(value);
    setResults({});
    setRemarks("");

    const sample = samples.find((item) => item._id === value);
    if (sample) {
      setSelectedPatient(sample.patient?._id || sample.patient || "");
      setSelectedTest(sample.testDefinition || "");
    }
  }

  function handleReportUpdated(updatedReport) {
    setReports((current) => current.map((r) => r._id === updatedReport._id ? updatedReport : r));
    setSelectedReport(updatedReport);
  }

  function handleEditReport(report) {
    setSelectedReport(null);
    setEditingReport(report);
    setSelectedPatient(report.patient?._id || "");
    setSelectedTest(report.testDefinition || "");
    setResults(report.results || {});
    setRemarks(report.remarks || "");
    setSelectedSample(report.sample || "");
  }

  function cancelEdit() {
    setEditingReport(null);
    setSelectedPatient("");
    setSelectedTest("");
    setResults({});
    setRemarks("");
    setSelectedSample("");
  }

  async function handleDeleteReport(reportId) {
    if (!confirm("Delete this report? This action cannot be undone.")) return;
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/reports/${reportId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to delete report");
      clearCachedApi("/api/reports");
      clearCachedApi("/api/dashboard/stats");
      setReports((current) => current.filter((r) => r._id !== reportId));
      if (selectedReport?._id === reportId) setSelectedReport(null);
      setSuccess("Report deleted successfully.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveReport(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      let response, data;
      if (editingReport) {
        response = await fetch(`/api/reports/${editingReport._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ action: "save", results, remarks }),
        });
        data = await response.json();
        if (!response.ok) throw new Error(data.error || data.details || "Unable to update report");
        clearCachedApi("/api/reports");
        clearCachedApi("/api/dashboard/stats");
        setReports((current) => current.map((r) => (r._id === editingReport._id ? data.report : r)));
        setSelectedReport(data.report);
        setEditingReport(null);
        setSuccess(`Report ${data.report?.reportId || ""} updated successfully.`);
      } else {
        response = await fetch("/api/reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            patient: selectedPatient,
            testDefinition: selectedTest,
            sample: selectedSample || undefined,
            results,
            remarks,
          }),
        });
        data = await response.json();
        if (!response.ok) throw new Error(data.error || data.details || "Unable to save report");

        clearCachedApi("/api/reports");
        clearCachedApi("/api/samples?status=all");
        clearCachedApi("/api/dashboard/stats");
        setReports((current) => [data.report, ...current]);
        setSelectedReport(data.report);
        setSamples((current) => current.filter((sample) => sample._id !== selectedSample));
      }
      setSelectedSample("");
      setResults({});
      setRemarks("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="module-page">Loading reports...</div>;

  return (
    <div className="module-page">
      <div className="module-header">
        <div>
          <p className="module-kicker">Dynamic Result Entry</p>
          <h1>Reports</h1>
          <span>Enter values from test definitions and generate structured reports.</span>
        </div>
        <button className="dash-btn-secondary" type="button" onClick={loadData}>
          {Icons.refresh} Refresh
        </button>
      </div>

      {error && <div className="module-alert">{error}</div>}
      <SuccessDialog message={success} onClose={() => setSuccess("")} />

      <div className="module-grid">
        {(canEditReports || editingReport) && (
          <ReportEntryPanel
            patients={patients}
            tests={tests}
            samples={samples}
            selectedSample={selectedSample}
            selectedPatient={selectedPatient}
            selectedTest={selectedTest}
            results={results}
            remarks={remarks}
            test={test}
            sortedParameters={sortedParameters}
            saving={saving}
            editing={!!editingReport}
            updateSample={updateSample}
            updateTest={updateTest}
            setSelectedPatient={setSelectedPatient}
            setResults={setResults}
            setRemarks={setRemarks}
            saveReport={saveReport}
            onCancelEdit={cancelEdit}
          />
        )}

        <ReportList
          reports={reports}
          setSelectedReport={setSelectedReport}
          selectedReport={selectedReport}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
        />
      </div>

      {selectedReport && (
        <ReportPreview
          selectedReport={selectedReport}
          canEditReports={canEditReports}
          canPrintReports={canPrintReports}
          canVerifyReports={canVerifyReports}
          canReleaseReports={canReleaseReports}
          canDeleteReports={canDeleteReports}
          onReportUpdated={handleReportUpdated}
          onSuccess={setSuccess}
          onEdit={handleEditReport}
          onDelete={handleDeleteReport}
        />
      )}
    </div>
  );
}
