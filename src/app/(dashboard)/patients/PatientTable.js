"use client";

import { memo } from "react";
import { Icons } from "@/app/components/Icons";
import { formatDate, getInitials } from "@/app/utils/patient-helpers";
import { canDeleteRecord } from "@/app/lib/deletion-policy";

const PREMIUM_GRADIENTS = [
  "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)", // Teal
  "linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)", // Indigo
  "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)", // Sky
  "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)", // Violet
  "linear-gradient(135deg, #db2777 0%, #be185d 100%)", // Pink
];

function getGradientForName(name) {
  const code = String(name || "").split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return PREMIUM_GRADIENTS[code % PREMIUM_GRADIENTS.length];
}

function PatientTable({ patients, selectedPatientId, onSelectPatient, onEditPatient, onDeletePatient, onProcessBill, subscription }) {
  return (
    <div className="patient-directory-table-wrap">
      <table className="patient-directory-table">
        <thead>
          <tr>
            <th>Patient</th>
            <th>Patient ID</th>
            <th>Referring Doctor</th>
            <th>Demographics</th>
            <th>Contact</th>
            <th>Registered</th>
            <th className="actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          {patients.map((patient) => {
            const gradient = getGradientForName(patient.name);
            
            // Define gender badge styling
            let genderTheme = { bg: "#f0fdfa", color: "#0f766e", icon: "👤" };
            if (patient.gender === "Male") {
              genderTheme = { bg: "#eff6ff", color: "#1d4ed8", icon: "👨" };
            } else if (patient.gender === "Female") {
              genderTheme = { bg: "#fdf2f8", color: "#be185d", icon: "👩" };
            }

            return (
              <tr
                key={patient._id}
                className={selectedPatientId === patient._id ? "selected" : ""}
                onClick={() => onSelectPatient(patient)}
              >
                <td>
                  <div className="patient-directory-table-identity">
                    <span style={{ background: gradient, color: "#fff" }}>{getInitials(patient.name)}</span>
                    <strong>{patient.name}</strong>
                  </div>
                </td>
                <td><code>{patient.patientId}</code></td>
                <td>
                  {patient.refDoctorName ? (
                    <span style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "2px 8px",
                      borderRadius: "6px",
                      background: "#f0fdf4",
                      color: "#166534",
                      fontSize: "11px",
                      fontWeight: "700"
                    }}>
                      🩺 Dr. {patient.refDoctorName}
                    </span>
                  ) : (
                    <span style={{ color: "#94a3b8" }}>—</span>
                  )}
                </td>
                <td>
                  <span style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "2px 8px",
                    borderRadius: "6px",
                    background: genderTheme.bg,
                    color: genderTheme.color,
                    fontSize: "11px",
                    fontWeight: "750"
                  }}>
                    {genderTheme.icon} {patient.age} Y / {patient.gender}
                  </span>
                </td>
                <td style={{ fontWeight: "600", color: "#475569" }}>{patient.phone || "—"}</td>
                <td style={{ color: "#64748b" }}>{formatDate(patient.createdAt)}</td>
                <td className="actions">
                  <div className="patient-directory-actions">
                    {onProcessBill && (
                      <button
                        type="button"
                        className="btn-lims-primary"
                        style={{
                          fontSize: "11px",
                          padding: "0 10px",
                          height: "32px",
                          minHeight: "32px",
                          borderRadius: "8px",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "4px",
                          whiteSpace: "nowrap",
                          fontWeight: "750",
                          background: "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)",
                          border: "none",
                          boxShadow: "0 2px 4px rgba(13, 148, 136, 0.15)",
                          color: "#fff",
                          cursor: "pointer"
                        }}
                        onClick={(event) => {
                          event.stopPropagation();
                          onProcessBill(patient._id);
                        }}
                        title="Create Bill for this Referred Patient"
                      >
                        <span>⚡</span>
                        <span>Bill</span>
                      </button>
                    )}
                    {patient.phone && (
                      <button
                        type="button"
                        className="dash-btn-secondary"
                        style={{
                          fontSize: "11px",
                          padding: "0 10px",
                          height: "32px",
                          minHeight: "32px",
                          borderRadius: "8px",
                          background: "#e8f5e9",
                          color: "#2e7d32",
                          border: "1px solid #c8e6c9",
                          fontWeight: "700",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "4px",
                          whiteSpace: "nowrap",
                          cursor: "pointer",
                          boxShadow: "0 2px 4px rgba(46, 125, 50, 0.05)"
                        }}
                        onClick={async (event) => {
                          event.stopPropagation();
                          try {
                            const res = await fetch(`/api/patient/${patient._id}/portal-access`, { method: "POST" });
                            const data = await res.json();
                            if (res.ok && data.whatsAppShareUrl) {
                              window.open(data.whatsAppShareUrl, "_blank");
                            } else {
                              const rawPhone = String(patient.phone).replace(/\D/g, "");
                              const targetPhone = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;
                              const msg = `Hello ${patient.name},\n\nAccess your lab visit history, receipts and test reports on the Patient Portal:\n${window.location.origin}/patient?tenantId=${encodeURIComponent(window.location.hostname.split(".")[0])}\n\nThank you!`;
                              window.open(`https://api.whatsapp.com/send?phone=${encodeURIComponent(targetPhone)}&text=${encodeURIComponent(msg)}`, "_blank");
                            }
                          } catch {
                            const rawPhone = String(patient.phone).replace(/\D/g, "");
                            const targetPhone = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;
                            const msg = `Hello ${patient.name},\n\nAccess your lab visit history, receipts and test reports on the Patient Portal:\n${window.location.origin}/patient?tenantId=${encodeURIComponent(window.location.hostname.split(".")[0])}\n\nThank you!`;
                            window.open(`https://api.whatsapp.com/send?phone=${encodeURIComponent(targetPhone)}&text=${encodeURIComponent(msg)}`, "_blank");
                          }
                        }}
                        title="Share Portal link via WhatsApp"
                      >
                        <span>💬</span>
                        <span>WhatsApp</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className="patient-directory-edit"
                      onClick={(event) => {
                        event.stopPropagation();
                        onEditPatient(patient._id);
                      }}
                      aria-label={`Edit ${patient.name}`}
                      title="Edit patient"
                      style={{
                        width: "32px",
                        height: "32px",
                        minHeight: "32px",
                        borderRadius: "8px",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 0
                      }}
                    >
                      {Icons.edit}
                    </button>
                    {onDeletePatient && canDeleteRecord(patient, subscription, "patients") && (
                      <button
                        type="button"
                        className="patient-directory-delete"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (window.confirm(`Delete patient ${patient.patientId} (${patient.name})?`)) {
                            onDeletePatient(patient._id);
                          }
                        }}
                        aria-label={`Delete ${patient.name}`}
                        title="Delete patient"
                        style={{
                          width: "32px",
                          height: "32px",
                          minHeight: "32px",
                          borderRadius: "8px",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: 0
                        }}
                      >
                        {Icons.trash}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default memo(PatientTable);
