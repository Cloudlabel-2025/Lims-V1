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

export default function StepResults({ testDefs, results, setResults, onNext, onBack }) {
  const [resultsErrors, setResultsErrors] = useState({});
  const [error, setError] = useState("");

  const investigations = useMemo(
    () => (testDefs || []).map((testDef) => ({
      ...testDef,
      parameters: (testDef.parameters || []).slice().sort((a, b) => a.sortOrder - b.sortOrder),
    })),
    [testDefs]
  );

  function handleResultChange(investigationKey, key, value) {
    const cleaned = value.slice(0, 12);
    const errorKey = `${investigationKey}:${key}`;
    setResultsErrors((prev) => ({ ...prev, [errorKey]: "" }));
    setResults((current) => ({
      ...current,
      [investigationKey]: { ...(current[investigationKey] || {}), [key]: cleaned },
    }));
  }

  function handleNext() {
    const missing = investigations.flatMap((testDef) => testDef.parameters
      .filter((parameter) => parameter.required && String(results[testDef.investigationKey]?.[parameter.key] || "").trim() === "")
      .map((parameter) => `${testDef.name}: ${parameter.name}`));
    if (missing.length > 0) {
      setError(`Please fill required fields: ${missing.join(", ")}`);
      return;
    }
    setError("");
    onNext();
  }

  if (!investigations.length) return <p>Test definitions not found.</p>;

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Enter Results</h2>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
        Enter results for all {investigations.length} investigation{investigations.length === 1 ? "" : "s"} in this bill.
      </p>

      {error && <div className="module-alert" style={{ marginBottom: 16 }}>{error}</div>}

      {investigations.map((testDef) => (
        <section key={testDef.investigationKey} style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>{testDef.name} <small style={{ fontWeight: 500, color: "var(--text-muted)" }}>· {testDef.category?.name || testDef.snapshot?.categoryName || "General"}</small></h3>
          <div className="result-entry-table">
            <div className="result-entry-head"><span>Parameter</span><span>Result</span><span>Unit</span><span>Normal Range</span><span>Flag</span></div>
            {testDef.parameters.map((parameter) => {
              const rawValue = results[testDef.investigationKey]?.[parameter.key] || "";
              const errorKey = `${testDef.investigationKey}:${parameter.key}`;
              const flag = previewFlag(parameter, rawValue);
              return (
                <div key={parameter.key} className={`result-entry-row ${flag}`}>
                  <span>{parameter.name}{!parameter.required && <small>Optional</small>}</span>
                  <div>
                    <input value={rawValue} onChange={(e) => handleResultChange(testDef.investigationKey, parameter.key, e.target.value)} required={parameter.required} placeholder="Enter value" maxLength={12} style={resultsErrors[errorKey] ? { borderColor: "var(--error)" } : {}} />
                    {resultsErrors[errorKey] && <small style={{ color: "var(--error)", fontSize: "10px", display: "block", marginTop: "2px" }}>{resultsErrors[errorKey]}</small>}
                  </div>
                  <span>{parameter.unit || "-"}</span><span>{rangeText(parameter)}</span><strong>{flag === "not-entered" ? "-" : flag}</strong>
                </div>
              );
            })}
          </div>
        </section>
      ))}

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
