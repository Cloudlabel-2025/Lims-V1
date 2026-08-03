"use client";

import { memo } from "react";
import { Icons } from "@/app/components/Icons";
import { formatDate, getInitials } from "@/app/utils/patient-helpers";

function PatientTable({ patients, selectedPatientId, onSelectPatient, onEditPatient, onDeletePatient }) {
  return (
    <div className="patient-directory-table-wrap">
      <table className="patient-directory-table">
        <thead>
          <tr>
            <th>Patient</th>
            <th>Patient ID</th>
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
              <td>{patient.age} Y / {patient.gender}</td>
              <td>{patient.phone || "—"}</td>
              <td>{formatDate(patient.createdAt)}</td>
              <td className="actions">
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
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default memo(PatientTable);
