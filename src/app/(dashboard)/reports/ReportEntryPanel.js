"use client";

import { useState } from "react";

function isExponential(value) {
  return typeof value === "string" && /[eE]/.test(value);
}

function rangeText(result) {
  const hasMin = Number.isFinite(result.normalMin);
  const hasMax = Number.isFinite(result.normalMax);
  if (hasMin && hasMax) return `${result.normalMin} - ${result.normalMax}`;
  if (hasMin) return `>= ${result.normalMin}`;
  if (hasMax) return `<= ${result.normalMax}`;
  return "-";
}

function previewFlag(parameter, rawValue) {
  if (rawValue === "" || rawValue === undefined) return "not-entered";
  const value = Number(rawValue);
  if (!Number.isFinite(value)) return "normal";
  if (Number.isFinite(parameter.normalMin) && value < parameter.normalMin) return "low";
  if (Number.isFinite(parameter.normalMax) && value > parameter.normalMax) return "high";
  return "normal";
}

export default function ReportEntryPanel({
  patients,
  tests,
  samples,
  selectedSample,
  selectedPatient,
  selectedTest,
  results,
  remarks,
  test,
  sortedParameters,
  saving,
  editing,
  updateSample,
  updateTest,
  setSelectedPatient,
  setResults,
  setRemarks,
  saveReport,
  onCancelEdit,
}) {
  const [resultsErrors, setResultsErrors] = useState({});

  function handleResultChange(key, value) {
    if (isExponential(value)) {
      setResultsErrors((prev) => ({ ...prev, [key]: "Exponential notation (e.g. 1E+21) is not allowed" }));
      return;
    }
    if (value !== "" && value !== "-" && value !== "." && !Number.isFinite(Number(value))) {
      setResultsErrors((prev) => ({ ...prev, [key]: "Invalid numeric value" }));
      return;
    }
    setResultsErrors((prev) => ({ ...prev, [key]: "" }));
    setResults((current) => ({ ...current, [key]: value }));
  }

  return (
    <section className="module-panel">
      <div className="module-panel-header">
        <h2>{editing ? "Edit Report" : "Result Entry"}</h2>
        <p>Fields below change automatically based on selected test.</p>
        {editing && (
          <button type="button" className="dash-btn-secondary" onClick={onCancelEdit} style={{ marginTop: 8 }}>
            Cancel Editing
          </button>
        )}
      </div>

      <form className="module-form" onSubmit={saveReport}>
        <div className="module-form-grid">
          <label>
            Collected Sample
            <select value={selectedSample} onChange={(e) => updateSample(e.target.value)}>
              <option value="">Select a collected sample</option>
              {samples.map((sample) => (
                <option key={sample._id} value={sample._id}>
                  {sample.sampleId} · {sample.patient?.name} · {sample.testSnapshot?.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Patient
            <select
              value={selectedPatient}
              onChange={(e) => setSelectedPatient(e.target.value)}
              required
              disabled={Boolean(selectedSample)}
            >
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
              {sortedParameters.map((parameter) => {
                const flag = previewFlag(parameter, results[parameter.key]);
                return (
                  <div key={parameter.key} className={`result-entry-row ${flag}`}>
                    <span>
                      {parameter.name}
                      {!parameter.required && <small>Optional</small>}
                    </span>
                    <div>
                      <input
                        value={results[parameter.key] || ""}
                        onChange={(e) => handleResultChange(parameter.key, e.target.value)}
                        required={parameter.required}
                        placeholder="Enter value"
                        style={resultsErrors[parameter.key] ? { borderColor: "var(--error)" } : {}}
                      />
                      {resultsErrors[parameter.key] && (
                        <small style={{ color: "var(--error)", fontSize: "10px", display: "block", marginTop: "2px" }}>
                          {resultsErrors[parameter.key]}
                        </small>
                      )}
                    </div>
                    <span>{parameter.unit || "-"}</span>
                    <span>{rangeText(parameter)}</span>
                    <strong>{flag === "not-entered" ? "-" : flag}</strong>
                  </div>
                );
              })}
            </div>

            <label className="module-full-label">
              Remarks
              <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} placeholder="Enter report notes" />
            </label>
          </>
        )}

        {!selectedPatient && <div style={{ background: "#fef2f2", color: "#dc2626", padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, marginTop: 12 }}>Please select a patient before saving.</div>}
        {!selectedTest && <div style={{ background: "#fef2f2", color: "#dc2626", padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, marginTop: 8 }}>Please select a test before saving.</div>}
        <button className="dash-btn-primary module-save" type="submit" disabled={!selectedPatient || !selectedTest || saving}>
          {saving ? "Saving..." : editing ? "Update Report" : "Save Report"}
        </button>
      </form>
    </section>
  );
}
