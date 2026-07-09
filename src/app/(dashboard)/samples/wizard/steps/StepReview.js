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

function getFlag(parameter, rawValue) {
  if (rawValue === "" || rawValue === undefined) return "not-entered";
  const value = Number(rawValue);
  if (!Number.isFinite(value)) return "normal";
  if (Number.isFinite(parameter.normalMin) && value < parameter.normalMin) return "low";
  if (Number.isFinite(parameter.normalMax) && value > parameter.normalMax) return "high";
  return "normal";
}

export default function StepReview({ testDef, sample, results, onBack, onSubmit, submitting }) {
  const [confirming, setConfirming] = useState(false);
  const parameters = useMemo(
    () => (testDef?.parameters || []).slice().sort((a, b) => a.sortOrder - b.sortOrder),
    [testDef]
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
            <small className="text-muted">Test</small>
            <strong>{testDef?.name || "-"}</strong>
          </div>
        </div>
        <div className="col-md-6">
          <div className="wizard-info-card">
            <small className="text-muted">Sample Type</small>
            <strong>{sample.sampleType || testDef?.sampleType || "-"}</strong>
          </div>
        </div>
      </div>

      <div className="result-entry-table" style={{ marginBottom: 24 }}>
        <div className="result-entry-head">
          <span>Parameter</span>
          <span>Result</span>
          <span>Unit</span>
          <span>Normal Range</span>
          <span>Flag</span>
        </div>
        {parameters.map((p) => {
          const rawValue = results[p.key] || "";
          const flag = getFlag(p, rawValue);
          return (
            <div key={p.key} className={`result-entry-row ${flag}`}>
              <span>{p.name}</span>
              <strong>{rawValue || "-"}</strong>
              <span>{p.unit || "-"}</span>
              <span>{rangeText(p)}</span>
              <strong>{flag === "not-entered" ? "-" : flag}</strong>
            </div>
          );
        })}
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
              <button className="dash-btn-primary" onClick={() => { setConfirming(false); onSubmit(); }} disabled={submitting}>
                {submitting ? "Submitting..." : "Confirm"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
