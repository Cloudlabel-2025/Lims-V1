"use client";

import { memo } from "react";
import { Icons } from "@/app/components/Icons";
import { getInitials, getStatusStyle } from "@/app/utils/doctor-helpers";

function DoctorGrid({
  doctors,
  selectedDoctorId,
  onSelectDoctor,
  canEditDoctors,
  canDeleteDoctors,
  onEditDoctor,
  onDeleteDoctor,
}) {
  return (
    <div
      className="patient-list-grid"
      style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px" }}
    >
      {doctors.map((doc) => {
        const statusStyle = getStatusStyle(doc.status);
        return (
          <div
            key={doc._id}
            className={`form-card ${selectedDoctorId === doc._id ? "selected" : ""}`}
            onClick={() => onSelectDoctor(doc)}
            style={{
              padding: "20px",
              marginBottom: "0",
              cursor: "pointer",
              position: "relative",
              border:
                selectedDoctorId === doc._id
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
                  {getInitials(doc.name)}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-primary)" }}>{doc.name}</div>
                <div style={{ fontSize: "12px", color: "var(--brand-action, var(--primary))", fontWeight: "600" }}>{doc.doctorId}</div>
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
                <span><strong>{doc.speciality}</strong></span>
                <span style={{ opacity: 0.8 }}>{doc.experience} Yrs Exp</span>
              </div>
              <span style={{ padding: "2px 8px", borderRadius: "4px", background: statusStyle.bg, color: statusStyle.color, fontWeight: "600" }}>
                {doc.status}
              </span>
            </div>

            <div
              style={{
                marginTop: "12px",
                background: "var(--surface)",
                borderRadius: "8px",
                padding: "8px 12px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600" }}>PENDING PAYOUT</span>
              <strong style={{ fontSize: "14px", color: doc.pendingPayout > 0 ? "var(--danger)" : "var(--success)" }}>
                ₹{doc.pendingPayout || 0}
              </strong>
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
                alignItems: "center",
              }}
            >
              <span>Clinic: {doc.clinicName || "Private"}</span>
              {(canEditDoctors || canDeleteDoctors || selectedDoctorId === doc._id) && (
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  {selectedDoctorId === doc._id && (
                    <span style={{ color: "var(--brand-action, var(--primary))", fontWeight: "700" }}>SELECTED</span>
                  )}
                  {canEditDoctors && (
                    <button
                      title="Edit"
                      style={{
                        border: "none",
                        background: "transparent",
                        color: "var(--text-muted)",
                        cursor: "pointer",
                        padding: "4px",
                        borderRadius: "6px",
                        display: "flex",
                        alignItems: "center",
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "var(--brand-action, var(--primary))"; e.currentTarget.style.background = "var(--primary-50)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.background = "transparent"; }}
                      onClick={(e) => { e.stopPropagation(); onEditDoctor(doc._id); }}
                    >
                      {Icons.edit}
                    </button>
                  )}
                  {canDeleteDoctors && (
                    <button
                      className="btn-icon-delete"
                      title="Delete"
                      onClick={(e) => { e.stopPropagation(); onDeleteDoctor(doc); }}
                    >
                      {Icons.trash}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default memo(DoctorGrid);
