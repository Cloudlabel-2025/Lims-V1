"use client";

import { memo } from "react";
import { Icons } from "@/app/components/Icons";
import { formatDate, getInitials } from "@/app/utils/patient-helpers";

function PatientGrid({ patients, selectedPatientId, onSelectPatient, onEditPatient, onDeletePatient }) {
  return (
    <div
      className="patient-list-grid"
      style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px" }}
    >
      {patients.map((patient) => (
        <div
          key={patient._id}
          className={`form-card ${selectedPatientId === patient._id ? "selected" : ""}`}
          onClick={() => onSelectPatient(patient)}
          style={{
            padding: "20px",
            marginBottom: "0",
            cursor: "pointer",
            position: "relative",
            border:
              selectedPatientId === patient._id
                ? "2px solid var(--brand-action, var(--primary))"
                : "1.5px solid var(--border)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            <div
              className="patient-photo-card"
              style={{ width: "60px", height: "60px", margin: "0", background: "var(--primary-50)" }}
            >
              <div style={{ fontSize: "20px", fontWeight: "700", color: "var(--brand-action, var(--primary))" }}>
                {getInitials(patient.name)}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-primary)" }}>
                {patient.name}
              </div>
              <div style={{ fontSize: "12px", color: "var(--brand-action, var(--primary))", fontWeight: "600" }}>
                {patient.patientId}
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: "15px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "12px",
              color: "var(--text-secondary)",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span>
                <strong>
                  {patient.age} Y / {patient.gender}
                </strong>
              </span>
              <span style={{ opacity: 0.8 }}>{patient.phone}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button
                className="patient-list-edit-btn"
                onClick={(event) => {
                  event.stopPropagation();
                  onEditPatient(patient._id);
                }}
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                title="Update Patient Record"
              >
                {Icons.edit}
              </button>
              {onDeletePatient && (
                <button
                  className="patient-list-edit-btn"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (window.confirm(`Delete patient ${patient.patientId} (${patient.name})?`)) {
                      onDeletePatient(patient._id);
                    }
                  }}
                  style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c" }}
                  title="Delete Patient"
                >
                  {Icons.trashIcon || "🗑"}
                </button>
              )}
            </div>
          </div>

          <div
            style={{
              marginTop: "12px",
              paddingTop: "12px",
              borderTop: "1px solid var(--border-light)",
              fontSize: "10px",
              color: "var(--text-muted)",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>Registered: {formatDate(patient.createdAt)}</span>
            {selectedPatientId === patient._id && (
              <span style={{ color: "var(--brand-action, var(--primary))", fontWeight: "700" }}>SELECTED</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default memo(PatientGrid);
