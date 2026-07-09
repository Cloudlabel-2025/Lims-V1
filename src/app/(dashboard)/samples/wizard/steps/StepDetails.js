"use client";

import { Icons } from "@/app/components/Icons";

export default function StepDetails({ sample, onNext }) {
  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Sample Details</h2>

      <div className="row g-3" style={{ marginBottom: 24 }}>
        <div className="col-md-4">
          <div className="wizard-info-card">
            <small className="text-muted">Sample ID</small>
            <strong>{sample.sampleId}</strong>
          </div>
        </div>
        <div className="col-md-4">
          <div className="wizard-info-card">
            <small className="text-muted">Status</small>
            <strong>{sample.status}</strong>
          </div>
        </div>
        <div className="col-md-4">
          <div className="wizard-info-card">
            <small className="text-muted">Patient Name</small>
            <strong>{sample.patient?.name || "-"}</strong>
          </div>
        </div>
        <div className="col-md-4">
          <div className="wizard-info-card">
            <small className="text-muted">Patient ID</small>
            <strong>{sample.patient?.patientId || "-"}</strong>
          </div>
        </div>
        <div className="col-md-4">
          <div className="wizard-info-card">
            <small className="text-muted">Age / Gender</small>
            <strong>{sample.patient?.age || "-"} / {sample.patient?.gender || "-"}</strong>
          </div>
        </div>
        <div className="col-md-4">
          <div className="wizard-info-card">
            <small className="text-muted">Test Name</small>
            <strong>{sample.testSnapshot?.name || "-"}</strong>
          </div>
        </div>
        <div className="col-md-4">
          <div className="wizard-info-card">
            <small className="text-muted">Category</small>
            <strong>{sample.testSnapshot?.categoryName || "-"}</strong>
          </div>
        </div>
        <div className="col-md-4">
          <div className="wizard-info-card">
            <small className="text-muted">Sample Type</small>
            <strong>{sample.sampleType || sample.testSnapshot?.sampleType || "-"}</strong>
          </div>
        </div>
      </div>

      <div className="wizard-nav">
        <div />
        <button className="dash-btn-primary" onClick={onNext}>
          Next {Icons.arrowRight}
        </button>
      </div>
    </div>
  );
}
