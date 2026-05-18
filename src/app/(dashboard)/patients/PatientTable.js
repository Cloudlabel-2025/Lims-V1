"use client";

import { memo } from "react";
import { Icons } from "@/app/components/Icons";
import { formatDate, getInitials } from "@/app/utils/patient-helpers";

function PatientTable({ patients, selectedPatientId, onSelectPatient, onEditPatient }) {
  return (
    <div className="form-card" style={{ padding: "0", overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
        <thead>
          <tr style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
            {["Patient Details", "ID", "Info", "Contact", "Registered Date", "Actions"].map((heading) => (
              <th
                key={heading}
                style={{
                  padding: "12px 20px",
                  textAlign: heading === "Actions" ? "center" : "left",
                  color: "var(--text-secondary)",
                  fontWeight: "600",
                }}
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {patients.map((patient) => (
            <tr
              key={patient._id}
              onClick={() => onSelectPatient(patient)}
              style={{
                borderBottom: "1px solid var(--border-light)",
                cursor: "pointer",
                background: selectedPatientId === patient._id ? "var(--primary-50)" : "transparent",
                transition: "background 0.2s",
              }}
              onMouseOver={(event) => {
                if (selectedPatientId !== patient._id) {
                  event.currentTarget.style.background = "#f8fafc";
                }
              }}
              onMouseOut={(event) => {
                if (selectedPatientId !== patient._id) {
                  event.currentTarget.style.background = "transparent";
                }
              }}
            >
              <td style={{ padding: "12px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "10px",
                      background: "var(--primary-50)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "13px",
                      fontWeight: "700",
                      color: "var(--brand-action, var(--primary))",
                    }}
                  >
                    {getInitials(patient.name)}
                  </div>
                  <div style={{ fontWeight: "600", color: "var(--text-primary)" }}>{patient.name}</div>
                </div>
              </td>
              <td style={{ padding: "12px 20px", color: "var(--text-secondary)" }}>
                <span
                  style={{
                    background: "var(--border-light)",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    fontSize: "11px",
                    fontWeight: "600",
                  }}
                >
                  {patient.patientId}
                </span>
              </td>
              <td style={{ padding: "12px 20px", color: "var(--text-secondary)" }}>
                {patient.age} Y / {patient.gender}
              </td>
              <td style={{ padding: "12px 20px", color: "var(--text-secondary)" }}>{patient.phone}</td>
              <td style={{ padding: "12px 20px", color: "var(--text-muted)", fontSize: "12px" }}>
                {formatDate(patient.createdAt)}
              </td>
              <td style={{ padding: "12px 20px", textAlign: "center" }}>
                <button
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    padding: "4px",
                    borderRadius: "6px",
                    transition: "all 0.2s",
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    onEditPatient(patient._id);
                  }}
                  onMouseOver={(event) => {
                    event.currentTarget.style.color = "var(--brand-action, var(--primary))";
                  }}
                  onMouseOut={(event) => {
                    event.currentTarget.style.color = "var(--text-muted)";
                  }}
                >
                  {Icons.edit}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default memo(PatientTable);
