"use client";

import { useMemo, useState } from "react";
import { Icons } from "@/app/components/Icons";
import WysiwygEditor from "@/app/components/WysiwygEditor";

function rangeText(parameter) {
  const hasMin = Number.isFinite(parameter.normalMin);
  const hasMax = Number.isFinite(parameter.normalMax);
  if (hasMin && hasMax) return `${parameter.normalMin} - ${parameter.normalMax}`;
  if (hasMin) return `>= ${parameter.normalMin}`;
  if (hasMax) return `<= ${parameter.normalMax}`;
  return "-";
}

function getFlag(parameter, rawValue) {
  if (rawValue === "" || rawValue === undefined) return "not-entered";
  const value = Number(rawValue);
  if (!Number.isFinite(value)) return "normal";
  if (Number.isFinite(parameter.normalMin) && value < parameter.normalMin) return "low";
  if (Number.isFinite(parameter.normalMax) && value > parameter.normalMax) return "high";
  return "normal";
}

export default function StepReview({ testDefs, sample, results, onBack, onSubmit, submitting }) {
  const [confirming, setConfirming] = useState(false);
  const [notes, setNotes] = useState(sample?.notes || "");
  const investigations = useMemo(
    () => (testDefs || []).map((testDef) => ({
      ...testDef,
      parameters: (testDef.parameters || []).slice().sort((a, b) => a.sortOrder - b.sortOrder),
    })),
    [testDefs]
  );

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Review & Submit</h2>

      <div className="row g-3" style={{ marginBottom: 24 }}>
        <div className="col-md-6">
          <div className="wizard-info-card">
            <small className="text-muted">Sample</small>
            <strong>{sample.sampleId}</strong>
          </div>
        </div>
        <div className="col-md-6">
          <div className="wizard-info-card">
            <small className="text-muted">Patient</small>
            <strong>{sample.patient?.name || "-"}</strong>
          </div>
        </div>
        <div className="col-md-6">
          <div className="wizard-info-card">
            <small className="text-muted">Investigations</small>
            <strong>{investigations.map((testDef) => testDef.name).join(", ") || "-"}</strong>
          </div>
        </div>
        <div className="col-md-6">
          <div className="wizard-info-card">
            <small className="text-muted">Sample Type</small>
            <strong>{sample.sampleType || [...new Set(investigations.map((testDef) => testDef.sampleType).filter(Boolean))].join(", ") || "-"}</strong>
          </div>
        </div>
      </div>

      {investigations.map((testDef) => (
        <section key={testDef.investigationKey} style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>{testDef.name}</h3>
          <div className="result-entry-table">
            <div className="result-entry-head"><span>Parameter</span><span>Result</span><span>Unit</span><span>Normal Range</span><span>Flag</span></div>
            {testDef.parameters.map((parameter) => {
              const rawValue = results[testDef.investigationKey]?.[parameter.key] || "";
              const flag = getFlag(parameter, rawValue);
              return <div key={parameter.key} className={`result-entry-row ${flag}`}><span>{parameter.name}</span><strong>{rawValue || "-"}</strong><span>{parameter.unit || "-"}</span><span>{rangeText(parameter)}</span><strong>{flag === "not-entered" ? "-" : flag}</strong></div>;
            })}
          </div>
        </section>
      ))}

      <div style={{ marginBottom: 24 }}>
        <label className="lims-label" style={{ fontWeight: 650, display: "flex", alignItems: "center", gap: 6 }}>
          Optional Instructions / Result Description
          <span style={{ fontSize: "11px", fontWeight: "normal", color: "var(--text-muted)", background: "var(--surface-light, #f8fafc)", padding: "2px 6px", borderRadius: "4px", border: "1px solid var(--border)" }}>Optional</span>
        </label>
        <WysiwygEditor
          value={notes}
          onChange={setNotes}
          placeholder="Add clinical instructions, detailed observations, or test result description..."
        />
      </div>

      <div className="wizard-nav">
        <button className="dash-btn-secondary" onClick={onBack} disabled={submitting}>
          {Icons.arrowLeft} Back
        </button>
        <button className="dash-btn-primary" onClick={() => setConfirming(true)} disabled={submitting}>
          {submitting ? "Submitting..." : String.fromCharCode(10003) + " Submit Results"}
        </button>
      </div>

      {confirming && (
        <div className="cms-success-dialog-backdrop" role="presentation">
          <section className="cms-success-dialog" role="dialog" aria-live="polite">
            <div className="cms-success-dialog-icon" style={{ fontSize: 28 }}>!</div>
            <h2>Confirm Submission</h2>
            <p>Are you sure you want to submit these results? This action cannot be undone.</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 20 }}>
              <button className="dash-btn-secondary" onClick={() => setConfirming(false)} disabled={submitting}>
                Cancel
              </button>
              <button className="dash-btn-primary" onClick={() => { setConfirming(false); onSubmit(notes); }} disabled={submitting}>
                {submitting ? "Submitting..." : "Confirm"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
