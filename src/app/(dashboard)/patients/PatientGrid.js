"use client";

import { memo } from "react";
import { Icons } from "@/app/components/Icons";
import { formatDate, getInitials } from "@/app/utils/patient-helpers";

import { canDeleteRecord } from "@/app/lib/deletion-policy";

function PatientGrid({ patients, selectedPatientId, onSelectPatient, onEditPatient, onDeletePatient, onProcessBill, subscription }) {
  return (
    <div className="patient-directory-grid">
      {patients.map((patient) => {
        const isSelected = selectedPatientId === patient._id;
        return (
          <article
            key={patient._id}
            className={`patient-directory-card ${isSelected ? "selected" : ""}`}
            onClick={() => onSelectPatient(patient)}
          >
            <header>
              <span className="patient-directory-avatar">{getInitials(patient.name)}</span>
              <div>
                <strong>{patient.name}</strong>
                <span>{patient.patientId}</span>
              </div>
              {isSelected && <em>Selected</em>}
            </header>

            <dl>
              <div>
                <dt>Age / Gender</dt>
                <dd>{patient.age} Y / {patient.gender}</dd>
              </div>
              <div>
                <dt>Contact</dt>
                <dd>{patient.phone || "Not provided"}</dd>
              </div>
              {patient.refDoctorName && (
                <div>
                  <dt>Referring Doctor</dt>
                  <dd style={{ color: "#0d9488", fontWeight: 600 }}>Dr. {patient.refDoctorName}</dd>
                </div>
              )}
            </dl>

            <footer>
              <span>Registered {formatDate(patient.createdAt)}</span>
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
            </footer>
          </article>
        );
      })}
    </div>
  );
}

export default memo(PatientGrid);
