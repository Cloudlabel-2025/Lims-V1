"use client";

import { Icons } from "@/app/components/Icons";

function rangeText(result) {
  const hasMin = Number.isFinite(result.normalMin);
  const hasMax = Number.isFinite(result.normalMax);
  if (hasMin && hasMax) return `${result.normalMin} - ${result.normalMax}`;
  if (hasMin) return `>= ${result.normalMin}`;
  if (hasMax) return `<= ${result.normalMax}`;
  return "-";
}

export default function ReportPreview({ selectedReport, canPrintReports }) {
  if (!selectedReport) return null;

  return (
    <section className="module-panel report-preview">
      <div className="report-title-row">
        <div>
          <p className="module-kicker">Structured Report</p>
          <h2>{selectedReport.testSnapshot?.name}</h2>
          <span>{selectedReport.reportId}</span>
        </div>
        {canPrintReports && (
          <button className="dash-btn-secondary" type="button" onClick={() => window.print()}>
            {Icons.report} Print
          </button>
        )}
      </div>

      <div className="report-patient-grid">
        <div>
          <span>Patient</span>
          <strong>{selectedReport.patient?.name}</strong>
        </div>
        <div>
          <span>Patient ID</span>
          <strong>{selectedReport.patient?.patientId}</strong>
        </div>
        <div>
          <span>Age / Gender</span>
          <strong>
            {selectedReport.patient?.age} / {selectedReport.patient?.gender}
          </strong>
        </div>
        <div>
          <span>Sample</span>
          <strong>{selectedReport.testSnapshot?.sampleType || "-"}</strong>
        </div>
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
  );
}
