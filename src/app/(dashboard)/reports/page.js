"use client";

import { useEffect, useMemo, useState } from "react";
import { Icons } from "@/app/components/Icons";

function rangeText(result) {
  const hasMin = Number.isFinite(result.normalMin);
  const hasMax = Number.isFinite(result.normalMax);
  if (hasMin && hasMax) return `${result.normalMin} - ${result.normalMax}`;
  if (hasMin) return `>= ${result.normalMin}`;
  if (hasMax) return `<= ${result.normalMax}`;
  return "-";
}

export default function ReportsPage() {
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const test = useMemo(
    () => tests.find((item) => item._id === selectedTest),
    [tests, selectedTest]
  );

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [patientResponse, testResponse, sampleResponse, reportResponse] = await Promise.all([
        fetch("/api/patient", { credentials: "include" }),
        fetch("/api/tests/definitions?status=active", { credentials: "include" }),
        fetch("/api/samples?status=all", { credentials: "include" }),
        fetch("/api/reports", { credentials: "include" }),
      ]);
      const [patientData, testData, sampleData, reportData] = await Promise.all([
        patientResponse.json(),
        testResponse.json(),
        sampleResponse.json(),
        reportResponse.json(),
      ]);

      if (!patientResponse.ok) throw new Error(patientData.error || "Unable to load patients");
      if (!testResponse.ok) throw new Error(testData.error || "Unable to load tests");
      if (!sampleResponse.ok) throw new Error(sampleData.error || "Unable to load samples");
      if (!reportResponse.ok) throw new Error(reportData.error || "Unable to load reports");

      setPatients(Array.isArray(patientData) ? patientData : []);
      setTests(testData.tests || []);
      setSamples((sampleData.samples || []).filter((sample) => ["collected", "processing"].includes(sample.status)));
      setReports(reportData.reports || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

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

  function previewFlag(parameter, rawValue) {
    if (rawValue === "" || rawValue === undefined) return "not-entered";
    const value = Number(rawValue);
    if (!Number.isFinite(value)) return "normal";
    if (Number.isFinite(parameter.normalMin) && value < parameter.normalMin) return "low";
    if (Number.isFinite(parameter.normalMax) && value > parameter.normalMax) return "high";
    return "normal";
  }

  async function saveReport(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/reports", {
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
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.details || "Unable to save report");

      setReports((current) => [data.report, ...current]);
      setSelectedReport(data.report);
      setSamples((current) => current.filter((sample) => sample._id !== selectedSample));
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
          {Icons.logo} Refresh
        </button>
      </div>

      {error && <div className="module-alert">{error}</div>}

      <div className="module-grid">
        <section className="module-panel">
          <div className="module-panel-header">
            <h2>Result Entry</h2>
            <p>Fields below change automatically based on selected test.</p>
          </div>

          <form className="module-form" onSubmit={saveReport}>
            <div className="module-form-grid">
              <label>
                Collected Sample
                <select value={selectedSample} onChange={(e) => updateSample(e.target.value)}>
                  <option value="">Manual entry without sample</option>
                  {samples.map((sample) => (
                    <option key={sample._id} value={sample._id}>
                      {sample.sampleId} · {sample.patient?.name} · {sample.testSnapshot?.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Patient
                <select value={selectedPatient} onChange={(e) => setSelectedPatient(e.target.value)} required disabled={Boolean(selectedSample)}>
                  <option value="">Select patient</option>
                  {patients.map((patient) => (
                    <option key={patient._id} value={patient._id}>
                      {patient.name} · {patient.patientId}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Test
                <select value={selectedTest} onChange={(e) => updateTest(e.target.value)} required disabled={Boolean(selectedSample)}>
                  <option value="">Select test</option>
                  {tests.map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.name} · {item.category?.name || "General"}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {test && (
              <>
                <div className="result-test-summary">
                  <strong>{test.name}</strong>
                  <span>{test.category?.name} · {test.sampleType || "Sample not specified"}</span>
                </div>

                <div className="result-entry-table">
                  <div className="result-entry-head">
                    <span>Parameter</span>
                    <span>Result</span>
                    <span>Unit</span>
                    <span>Normal Range</span>
                    <span>Flag</span>
                  </div>
                  {test.parameters
                    ?.slice()
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((parameter) => {
                      const flag = previewFlag(parameter, results[parameter.key]);
                      return (
                        <div key={parameter.key} className={`result-entry-row ${flag}`}>
                          <span>
                            {parameter.name}
                            {!parameter.required && <small>Optional</small>}
                          </span>
                          <input
                            value={results[parameter.key] || ""}
                            onChange={(e) =>
                              setResults((current) => ({ ...current, [parameter.key]: e.target.value }))
                            }
                            required={parameter.required}
                            placeholder="Enter value"
                          />
                          <span>{parameter.unit || "-"}</span>
                          <span>{rangeText(parameter)}</span>
                          <strong>{flag === "not-entered" ? "-" : flag}</strong>
                        </div>
                      );
                    })}
                </div>

                <label className="module-full-label">
                  Remarks
                  <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} placeholder="Optional report notes" />
                </label>
              </>
            )}

            <button className="dash-btn-primary module-save" type="submit" disabled={!selectedPatient || !selectedTest || saving}>
              {saving ? "Saving..." : "Save Report"}
            </button>
          </form>
        </section>

        <aside className="module-panel">
          <div className="module-panel-header">
            <h2>Generated Reports</h2>
            <p>{reports.length} reports available</p>
          </div>
          <div className="test-card-list">
            {reports.map((report) => (
              <article key={report._id} className="test-card" onClick={() => setSelectedReport(report)}>
                <div>
                  <h3>{report.testSnapshot?.name}</h3>
                  <span>{report.patient?.name} · {report.reportId}</span>
                </div>
                <strong>{report.status}</strong>
              </article>
            ))}
          </div>
        </aside>
      </div>

      {selectedReport && (
        <section className="module-panel report-preview">
          <div className="report-title-row">
            <div>
              <p className="module-kicker">Structured Report</p>
              <h2>{selectedReport.testSnapshot?.name}</h2>
              <span>{selectedReport.reportId}</span>
            </div>
            <button className="dash-btn-secondary" type="button" onClick={() => window.print()}>
              {Icons.report} Print
            </button>
          </div>

          <div className="report-patient-grid">
            <div><span>Patient</span><strong>{selectedReport.patient?.name}</strong></div>
            <div><span>Patient ID</span><strong>{selectedReport.patient?.patientId}</strong></div>
            <div><span>Age / Gender</span><strong>{selectedReport.patient?.age} / {selectedReport.patient?.gender}</strong></div>
            <div><span>Sample</span><strong>{selectedReport.testSnapshot?.sampleType || "-"}</strong></div>
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
      )}
    </div>
  );
}
