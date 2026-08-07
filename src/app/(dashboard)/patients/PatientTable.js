"use client";

import { memo } from "react";
import { Icons } from "@/app/components/Icons";
import { formatDate, getInitials } from "@/app/utils/patient-helpers";

import { canDeleteRecord } from "@/app/lib/deletion-policy";

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
          {patients.map((patient) => (
            <tr
              key={patient._id}
              className={selectedPatientId === patient._id ? "selected" : ""}
              onClick={() => onSelectPatient(patient)}
            >
              <td>
                <div className="patient-directory-table-identity">
                  <span>{getInitials(patient.name)}</span>
                  <strong>{patient.name}</strong>
                </div>
              </td>
              <td><code>{patient.patientId}</code></td>
              <td>
                {patient.refDoctorName ? (
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#0d9488", background: "#f0fdf4", padding: "2px 8px", borderRadius: 12 }}>
                    Dr. {patient.refDoctorName}
                  </span>
                ) : (
                  <span style={{ color: "#94a3b8" }}>—</span>
                )}
              </td>
              <td>{patient.age} Y / {patient.gender}</td>
              <td>{patient.phone || "—"}</td>
              <td>{formatDate(patient.createdAt)}</td>
              <td className="actions">
                <div className="patient-directory-actions">
                  {onProcessBill && (
                    <button
                      type="button"
                      className="btn-lims-primary"
                      style={{ fontSize: 11, padding: "4px 8px" }}
                      onClick={(event) => {
                        event.stopPropagation();
                        onProcessBill(patient._id);
                      }}
                      title="Create Bill for this Referred Patient"
                    >
                      ⚡ Create Bill
                    </button>
                  )}
                  {patient.phone && (
                    <button
                      type="button"
                      className="dash-btn-secondary"
                      style={{ fontSize: 11, padding: "4px 8px", background: "#dcfce7", color: "#15803d", borderColor: "#86efac" }}
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
                            const msg = `Hello ${patient.name},\n\nAccess your lab visit history, receipts and test reports on the Patient Portal:\n${window.location.origin}/patient?tenantId=mega\n\nThank you!`;
                            window.open(`https://api.whatsapp.com/send?phone=${encodeURIComponent(targetPhone)}&text=${encodeURIComponent(msg)}`, "_blank");
                          }
                        } catch {
                          const rawPhone = String(patient.phone).replace(/\D/g, "");
                          const targetPhone = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;
                          const msg = `Hello ${patient.name},\n\nAccess your lab visit history, receipts and test reports on the Patient Portal:\n${window.location.origin}/patient?tenantId=mega\n\nThank you!`;
                          window.open(`https://api.whatsapp.com/send?phone=${encodeURIComponent(targetPhone)}&text=${encodeURIComponent(msg)}`, "_blank");
                        }
                      }}
                      title="Share Portal link via WhatsApp"
                    >
                      📱 WhatsApp
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
                    >
                      {Icons.trash}
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default memo(PatientTable);
