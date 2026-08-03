"use client";

import { memo } from "react";
import { Icons } from "@/app/components/Icons";
import { formatDate, getInitials } from "@/app/utils/patient-helpers";

function PatientGrid({ patients, selectedPatientId, onSelectPatient, onEditPatient, onDeletePatient }) {
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
            </dl>

            <footer>
              <span>Registered {formatDate(patient.createdAt)}</span>
              <div className="patient-directory-actions">
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
                {onDeletePatient && (
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
