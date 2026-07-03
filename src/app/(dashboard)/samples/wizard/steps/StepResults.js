"use client";

import { useMemo, useState } from "react";
import { Icons } from "@/app/components/Icons";

function rangeText(parameter) {
  const hasMin = Number.isFinite(parameter.normalMin);
  const hasMax = Number.isFinite(parameter.normalMax);
  if (hasMin && hasMax) return `${parameter.normalMin} - ${parameter.normalMax}`;
  if (hasMin) return `>= ${parameter.normalMin}`;
  if (hasMax) return `<= ${parameter.normalMax}`;
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

export default function StepResults({ testDef, results, setResults, onNext, onBack }) {
  const [resultsErrors, setResultsErrors] = useState({});
  const [error, setError] = useState("");

  const sortedParameters = useMemo(
    () => (testDef?.parameters || []).slice().sort((a, b) => a.sortOrder - b.sortOrder),
    [testDef]
  );

  function handleResultChange(key, value) {
    if (/[eE]/.test(value)) {
      setResultsErrors((prev) => ({ ...prev, [key]: "Exponential notation is not allowed" }));
      return;
    }
    if (value !== "" && value !== "-" && value !== "." && !Number.isFinite(Number(value))) {
      setResultsErrors((prev) => ({ ...prev, [key]: "Invalid numeric value" }));
      return;
    }
    setResultsErrors((prev) => ({ ...prev, [key]: "" }));
    setResults((current) => ({ ...current, [key]: value }));
  }

  function handleNext() {
    const missing = sortedParameters.filter((p) => p.required && (!results[p.key] || String(results[p.key]).trim() === ""));
    if (missing.length > 0) {
      setError(`Please fill required fields: ${missing.map((p) => p.name).join(", ")}`);
      return;
    }
    setError("");
    onNext();
  }

  if (!testDef) return <p>Test definition not found.</p>;

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Enter Results</h2>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
        {testDef.name} &middot; {testDef.category?.name || "General"}
      </p>

      {error && <div className="module-alert" style={{ marginBottom: 16 }}>{error}</div>}

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

      <div className="wizard-nav">
        <button className="dash-btn-secondary" onClick={onBack}>
          {Icons.arrowLeft} Back
        </button>
        <button className="dash-btn-primary" onClick={handleNext}>
          Next {Icons.arrowRight}
        </button>
      </div>
    </div>
  );
}
