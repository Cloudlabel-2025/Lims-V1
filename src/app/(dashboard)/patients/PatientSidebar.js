"use client";

import { memo } from "react";
import { Icons } from "@/app/components/Icons";
import { formatDate, getInitials } from "@/app/utils/patient-helpers";

const DetailRow = memo(function DetailRow({ icon, value, truncate = false }) {
  return (
    <div className="contact-row">
      <span className="contact-icon-mini">{icon}</span>
      <span className={truncate ? "text-truncate-2" : undefined}>{value || "Not provided"}</span>
    </div>
  );
});

function PatientSidebar({ patient, onClose }) {
  if (!patient) return null;

  const lastUpdated = patient.updatedAt || patient.createdAt;

  return (
    <div className="sidebar-top">
      <div className="sidebar-header">
        <div className="sidebar-logo-flower">{Icons.logo}</div>
        <span className="sidebar-header-title">Patient Details</span>
        <button className="sidebar-close-menu" onClick={onClose}>
          {Icons.close}
        </button>
      </div>

      <div className="sidebar-photo-section">
        <div className="patient-photo-card">
          <div className="patient-photo-initials-large">{getInitials(patient.name)}</div>
        </div>

        <div className="patient-name-header">
          <div className="patient-name-text">
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "20px", fontWeight: "700", color: "var(--text-primary)" }}>
                {patient.name}
              </span>
              <span
                style={{ fontSize: "14px", color: "var(--text-secondary)", fontWeight: "600" }}
              >
                {patient.age} years, {patient.gender}
              </span>
            </div>
            <div className="patient-tag-id" style={{ marginTop: "4px" }}>
              {patient.patientId}
            </div>
          </div>
          <button className="patient-more-btn" type="button" aria-label="More patient actions">
            {Icons.dots}
          </button>
        </div>

        <div className="teal-brand-card" style={{ marginBottom: "24px", width: "100%" }}>
          <div className="brand-header-mini">
            <div className="brand-logo-mini">{Icons.logo}</div>
            <div className="brand-name-mini">Patient Record</div>
          </div>

          <div className="brand-patient-info">
            <div className="brand-patient-name">{patient.name}</div>
            <div className="brand-patient-id-mini">{patient.patientId}</div>
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
                gap: "16px",
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  opacity: 0.9,
                  fontWeight: "500",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                Registered
              </div>
              <div style={{ fontSize: "13px", fontWeight: "700" }}>{formatDate(patient.createdAt)}</div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "16px" }}>
              <div
                style={{
                  fontSize: "11px",
                  opacity: 0.9,
                  fontWeight: "500",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                Last Updated
              </div>
              <div style={{ fontSize: "13px", fontWeight: "700", textAlign: "right" }}>
                {formatDate(lastUpdated)}
              </div>
            </div>
          </div>

          <div className="vitals-grid-mini">
            <div className="vital-mini-box">
              <div className="vital-icon-circle blood">{Icons.user}</div>
              <div className="vital-mini-label" style={{ fontSize: "10px", opacity: 1, fontWeight: "600" }}>
                DOB
              </div>
              <div className="vital-mini-value" style={{ fontSize: "13px", fontWeight: "700" }}>
                {formatDate(patient.dob)}
              </div>
            </div>
            <div className="vital-mini-box">
              <div className="vital-icon-circle weight">{Icons.phone}</div>
              <div className="vital-mini-label" style={{ fontSize: "10px", opacity: 1, fontWeight: "600" }}>
                PHONE
              </div>
              <div className="vital-mini-value" style={{ fontSize: "13px", fontWeight: "700" }}>
                {patient.phone || "N/A"}
              </div>
            </div>
            <div className="vital-mini-box">
              <div className="vital-icon-circle temp">{Icons.mail}</div>
              <div className="vital-mini-label" style={{ fontSize: "10px", opacity: 1, fontWeight: "600" }}>
                EMAIL
              </div>
              <div className="vital-mini-value" style={{ fontSize: "13px", fontWeight: "700" }}>
                {patient.email || "N/A"}
              </div>
            </div>
          </div>
        </div>

        <div className="patient-contact-grid">
          <DetailRow icon={Icons.phone} value={patient.phone ? `+91 ${patient.phone}` : ""} />
          <DetailRow icon={Icons.mail} value={patient.email || "Not provided"} truncate />
          <DetailRow icon={Icons.mapPin} value={patient.address} truncate />
        </div>
      </div>

      <div className="sidebar-detail-grid" style={{ gridTemplateColumns: "1fr" }}>
        <div className="detail-item">
          <div className="detail-value">{formatDate(patient.dob)}</div>
          <div className="detail-label">Date of Birth</div>
        </div>
        <div className="detail-item">
          <div className="detail-value">{patient.genderIdentity || patient.gender}</div>
          <div className="detail-label">Gender</div>
        </div>
        <div className="detail-item">
          <div className="detail-value">{patient.refDoctorName || "Not assigned"}</div>
          <div className="detail-label">Referral Doctor</div>
        </div>
      </div>
    </div>
  );
}

export default memo(PatientSidebar);
