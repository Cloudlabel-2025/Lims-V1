"use client";

import { memo } from "react";
import { Icons } from "@/app/components/Icons";
import { getInitials, getStatusStyle } from "@/app/utils/doctor-helpers";

function DoctorTable({
  doctors,
  selectedDoctorId,
  onSelectDoctor,
  canEditDoctors,
  canDeleteDoctors,
  onEditDoctor,
  onDeleteDoctor,
}) {
  return (
    <div className="form-card" style={{ padding: "0", overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
        <thead>
          <tr style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
            {["Doctor Details", "speciality", "Experience", "Pending Payout", "Status", "Actions"].map((heading) => (
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
          {doctors.map((doc) => {
            const statusStyle = getStatusStyle(doc.status);
            return (
              <tr
                key={doc._id}
                onClick={() => onSelectDoctor(doc)}
                style={{
                  borderBottom: "1px solid var(--border-light)",
                  cursor: "pointer",
                  background: selectedDoctorId === doc._id ? "var(--primary-50)" : "transparent",
                  transition: "background 0.2s",
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
                      {getInitials(doc.name)}
                    </div>
                    <div>
                      <div style={{ fontWeight: "600", color: "var(--text-primary)" }}>{doc.name}</div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>ID: {doc.doctorId}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: "12px 20px", color: "var(--text-secondary)" }}>{doc.speciality}</td>
                <td style={{ padding: "12px 20px", color: "var(--text-secondary)" }}>{doc.experience} Yrs</td>
                <td style={{ padding: "12px 20px" }}>
                  <strong style={{ color: doc.pendingPayout > 0 ? "var(--danger)" : "var(--text-muted)" }}>
                    ₹{doc.pendingPayout || 0}
                  </strong>
                </td>
                <td style={{ padding: "12px 20px" }}>
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: "4px",
                      fontSize: "11px",
                      background: statusStyle.bg,
                      color: statusStyle.color,
                      fontWeight: "600",
                    }}
                  >
                    {doc.status}
                  </span>
                </td>
                <td style={{ padding: "12px 20px", textAlign: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
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
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default memo(DoctorTable);
