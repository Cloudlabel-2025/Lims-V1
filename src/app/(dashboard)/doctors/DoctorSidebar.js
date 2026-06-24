"use client";

import { memo } from "react";
import { Icons } from "@/app/components/Icons";
import { getInitials, formatDate } from "@/app/utils/doctor-helpers";

function DoctorSidebar({
  doctor,
  onClose,
  paying,
  payoutConfirm,
  payoutMethod,
  actionError,
  onPayoutConfirmChange,
  onPayoutMethodChange,
  onActionErrorChange,
  onPayout,
  onViewPayoutHistory,
  canEditDoctors,
  canDeleteDoctors,
  onEdit,
  onDeleteClick,
}) {
  return (
    <div className="sidebar-top">
      <div className="sidebar-header">
        <div className="sidebar-logo-flower">{Icons.logo}</div>
        <span className="sidebar-header-title">Doctor Details</span>
        <button className="sidebar-close-menu" onClick={onClose}>{Icons.close}</button>
      </div>

      <div className="sidebar-photo-section">
        <div className="patient-photo-card">
          <div className="patient-photo-initials-large">{getInitials(doctor.name)}</div>
        </div>

        <div className="patient-name-header">
          <div className="patient-name-text">
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "20px", fontWeight: "700", color: "var(--text-primary)" }}>{doctor.name}</span>
            </div>
            <div className="patient-tag-id" style={{ marginTop: "4px" }}>{doctor.doctorId}</div>
          </div>
        </div>

        <div className="teal-brand-card" style={{ marginBottom: "24px", width: "100%" }}>
          <div className="brand-header-mini">
            <div className="brand-logo-mini">{Icons.logo}</div>
            <div className="brand-name-mini">UTHIRAM LIMS</div>
          </div>

          <div className="brand-patient-info">
            <div className="brand-patient-name">{doctor.name}</div>
            <div className="brand-patient-id-mini">{doctor.doctorId}</div>
          </div>

          <div
            style={{
              margin: "12px 0 20px",
              padding: "14px 16px",
              background: "rgba(255,255,255,0.12)",
              borderRadius: "14px",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "10px",
                borderBottom: "1px solid rgba(255,255,255,0.12)",
                paddingBottom: "10px",
              }}
            >
              <div style={{ fontSize: "11px", opacity: 0.9, fontWeight: "500", textTransform: "uppercase", letterSpacing: "0.04em" }}>speciality</div>
              <div style={{ fontSize: "13px", fontWeight: "700" }}>{doctor.speciality}</div>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "10px",
                borderBottom: "1px solid rgba(255,255,255,0.12)",
                paddingBottom: "10px",
              }}
            >
              <div style={{ fontSize: "11px", opacity: 0.9, fontWeight: "500", textTransform: "uppercase", letterSpacing: "0.04em" }}>Qualification</div>
              <div style={{ fontSize: "13px", fontWeight: "700" }}>{doctor.degree}</div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div style={{ fontSize: "11px", opacity: 0.9, fontWeight: "500", textTransform: "uppercase", letterSpacing: "0.04em" }}>Experience</div>
              <div style={{ fontSize: "13px", fontWeight: "700" }}>{doctor.experience} Years</div>
            </div>
          </div>

          <div className="vitals-grid-mini" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
            <div className="vital-mini-box">
              <div className="vital-mini-label" style={{ fontSize: "10px", opacity: 1, fontWeight: "600" }}>COMMISSION</div>
              <div className="vital-mini-value" style={{ fontSize: "15px", fontWeight: "700" }}>{doctor.commission || 0}%</div>
            </div>
            <div className="vital-mini-box" style={{ background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)" }}>
              <div className="vital-mini-label" style={{ fontSize: "10px", opacity: 1, fontWeight: "600" }}>PENDING</div>
              <div className="vital-mini-value" style={{ fontSize: "15px", fontWeight: "700", color: "#fff" }}>₹{doctor.pendingPayout || 0}</div>
            </div>
            <div className="vital-mini-box">
              <div className="vital-mini-label" style={{ fontSize: "10px", opacity: 1, fontWeight: "600" }}>STATUS</div>
              <div className="vital-mini-value" style={{ fontSize: "15px", fontWeight: "700" }}>{doctor.status}</div>
            </div>
          </div>
        </div>

        <div className="patient-contact-grid">
          <div className="contact-row"><span className="contact-icon-mini">{Icons.phone}</span><span>+91 {doctor.phone}</span></div>
          <div className="contact-row"><span className="contact-icon-mini">{Icons.mail}</span><span className="text-truncate-1">{doctor.email || "—"}</span></div>
          <div className="contact-row"><span className="contact-icon-mini">{Icons.mapPin}</span><span className="text-truncate-2">{doctor.clinicAddress}</span></div>
        </div>
      </div>

      <div className="sidebar-detail-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="detail-item"><div className="detail-value">{doctor.mciNumber}</div><div className="detail-label">MCI Registration No.</div></div>
        <div className="detail-item"><div className="detail-value">{doctor.clinicName}</div><div className="detail-label">Clinic / Hospital</div></div>
        <div className="detail-item"><div className="detail-value">{doctor.location}</div><div className="detail-label">Practice Location</div></div>
        <div className="detail-item"><div className="detail-value">{formatDate(doctor.createdAt)}</div><div className="detail-label">Registered On</div></div>
      </div>

      <div style={{ padding: "0 24px 20px" }}>
        <div
          style={{
            fontSize: "11px",
            fontWeight: "700",
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: "8px",
          }}
        >
          Payout
        </div>

        {doctor.pendingPayout > 0 ? (
          payoutConfirm ? (
            <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "10px", padding: "14px" }}>
              <p style={{ fontSize: "13px", color: "#92400e", margin: "0 0 10px", fontWeight: "600" }}>
                Release ₹{doctor.pendingPayout} to {doctor.name}?
              </p>
              <select
                value={payoutMethod}
                onChange={(e) => onPayoutMethodChange(e.target.value)}
                style={{
                  width: "100%",
                  height: "36px",
                  marginBottom: "10px",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  fontSize: "13px",
                  padding: "0 10px",
                  background: "#fff",
                }}
              >
                <option value="cash">Cash</option>
                <option value="bank">Bank Transfer</option>
              </select>
              {actionError && (
                <p style={{ color: "#e11d48", fontSize: "12px", margin: "0 0 8px", fontWeight: "600" }}>{actionError}</p>
              )}
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={() => { onPayoutConfirmChange(false); onActionErrorChange(""); }}
                  style={{
                    flex: 1,
                    height: "36px",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    background: "#fff",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: "600",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={onPayout}
                  disabled={paying}
                  style={{
                    flex: 1,
                    height: "36px",
                    border: "none",
                    borderRadius: "8px",
                    background: "#10b981",
                    color: "#fff",
                    cursor: paying ? "not-allowed" : "pointer",
                    fontSize: "13px",
                    fontWeight: "600",
                    opacity: paying ? 0.7 : 1,
                  }}
                >
                  {paying ? "Releasing..." : "Confirm Release"}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "10px", padding: "14px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "12px",
                }}
              >
                <span style={{ fontSize: "13px", color: "#7f1d1d", fontWeight: "600" }}>Pending Payout</span>
                <span style={{ fontSize: "18px", fontWeight: "800", color: "#dc2626" }}>₹{doctor.pendingPayout}</span>
              </div>
              <button
                onClick={() => { onPayoutConfirmChange(true); onActionErrorChange(""); }}
                style={{
                  width: "100%",
                  height: "38px",
                  border: "none",
                  borderRadius: "8px",
                  background: "#10b981",
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: "700",
                }}
              >
                Release Payout
              </button>
            </div>
          )
        ) : (
          <div
            style={{
              background: "#ecfdf5",
              border: "1px solid #a7f3d0",
              borderRadius: "10px",
              padding: "12px 14px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span style={{ fontSize: "16px" }}>✓</span>
            <span style={{ fontSize: "13px", color: "#065f46", fontWeight: "600" }}>No pending payout</span>
          </div>
        )}

        <button
          onClick={onViewPayoutHistory}
          style={{
            width: "100%",
            height: "34px",
            marginTop: "8px",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            background: "transparent",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: "600",
            color: "var(--text-secondary)",
          }}
        >
          View Payout History
        </button>
      </div>

      {(canEditDoctors || canDeleteDoctors) && (
        <div style={{ padding: "20px 24px", display: "flex", gap: "12px" }}>
          {canEditDoctors && (
            <button
              className="btn-lims-primary"
              style={{ flex: 1, height: "42px", fontSize: "13px" }}
              onClick={onEdit}
            >
              {Icons.edit} Edit Profile
            </button>
          )}
          {canDeleteDoctors && (
            <button
              style={{
                flex: 1,
                height: "42px",
                fontSize: "13px",
                border: "1.5px solid #f43f5e",
                borderRadius: "10px",
                background: "#fff1f2",
                color: "#e11d48",
                cursor: "pointer",
                fontWeight: "600",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#e11d48"; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "#fff1f2"; e.currentTarget.style.color = "#e11d48"; }}
              onClick={() => onDeleteClick(doctor)}
            >
              {Icons.trash} Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(DoctorSidebar);
