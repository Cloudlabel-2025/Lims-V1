"use client";

import { memo, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icons } from "@/app/components/Icons";
import { formatDate, getInitials } from "@/app/utils/patient-helpers";
import { cachedJsonFetch, useTenantShell } from "@/app/lib/use-current-user";
import { hasPatientPortalEntitlement } from "@/app/lib/portal-policy";

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

function PatientSidebar({ patient, onClose }) {
  const router = useRouter();
  const { theme } = useTenantShell() || {};
  const allowPatientPortal = hasPatientPortalEntitlement(theme);
  const [clinicalSummary, setClinicalSummary] = useState(null);
  const [summaryUnavailable, setSummaryUnavailable] = useState(false);
  const patientId = patient?._id;

  useEffect(() => {
    if (!patientId) return;
    let cancelled = false;
    setClinicalSummary(null);
    setSummaryUnavailable(false);

    async function loadClinicalSummary() {
      try {
        const { response, data } = await cachedJsonFetch(`/api/patient/${patientId}/clinical-summary`, { ttl: 10_000 });
        if (!response.ok) throw new Error(data?.error || "Unable to load clinical summary");
        if (!cancelled) setClinicalSummary(data);
      } catch {
        if (!cancelled) setSummaryUnavailable(true);
      }
    }

    loadClinicalSummary();
    return () => { cancelled = true; };
  }, [patientId]);

  if (!patient) return null;

  const lastUpdated = patient.updatedAt || patient.createdAt;
  const visitCount = clinicalSummary?.visitCount;
  const lastVisit = clinicalSummary?.lastVisit;
  const bloodPressure = clinicalSummary?.healthMetrics?.bloodPressure;
  const bloodSugar = clinicalSummary?.healthMetrics?.bloodSugar;
  const gradient = getGradientForName(patient.name);

  function getSummaryValue(value, emptyLabel) {
    if (summaryUnavailable) return "Unavailable";
    if (!clinicalSummary) return "—";
    return value || emptyLabel;
  }

  function renderHealthMetric({ label, icon, metric }) {
    const isLoading = !clinicalSummary && !summaryUnavailable;
    const state = summaryUnavailable ? "unavailable" : metric ? metric.flag || "normal" : "empty";

    // Set accent borders and text based on metric status
    let statusStyle = { borderLeft: "4px solid #cbd5e1", color: "#64748b" };
    if (state === "normal") {
      statusStyle = { borderLeft: "4px solid #10b981", color: "#047857" };
    } else if (state === "high" || state === "low" || state === "abnormal") {
      statusStyle = { borderLeft: "4px solid #f59e0b", color: "#b45309" };
    } else if (state === "critical") {
      statusStyle = { borderLeft: "4px solid #ef4444", color: "#b91c1c" };
    }

    return (
      <article className={`patient-health-metric patient-health-metric--${state}`} style={statusStyle}>
        <span className="patient-health-icon" aria-hidden="true" style={{ fontSize: "16px" }}>{icon}</span>
        <div>
          <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "#94a3b8" }}>{label}</span>
          <strong style={{ display: "block", fontSize: "16px", marginTop: "2px", color: "#1e293b" }}>
            {isLoading ? "—" : metric?.value || (summaryUnavailable ? "Unavailable" : "Not recorded")}
            {metric?.unit ? <small style={{ fontSize: "11px", marginLeft: "4px", color: "#64748b" }}>{metric.unit}</small> : null}
          </strong>
          <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#64748b" }}>
            {isLoading
              ? "Checking verified reports…"
              : metric
                ? `${metric.label} · ${formatDate(metric.recordedAt)}`
                : summaryUnavailable
                  ? "Clinical summary could not be loaded"
                  : "No approved result available"}
          </p>
        </div>
      </article>
    );
  }

  return (
    <div className="patient-detail-drawer" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <header className="patient-detail-header" style={{ padding: "16px 20px" }}>
        <div>
          <span style={{ fontSize: "11px", fontWeight: "800", color: "#0d9488", textTransform: "uppercase", letterSpacing: "0.05em" }}>Patient record</span>
          <strong style={{ fontSize: "18px", fontWeight: "800", color: "#0f172a" }}>Patient Details</strong>
        </div>
        <button type="button" onClick={onClose} aria-label="Close patient details" style={{ borderRadius: "10px" }}>
          {Icons.close}
        </button>
      </header>

      <div className="patient-detail-content" style={{ padding: "20px" }}>
        <section className="patient-detail-identity" style={{ padding: "18px", borderRadius: "14px", border: "1.5px solid #edf2f7" }}>
          <span className="patient-detail-avatar" style={{ background: gradient, color: "#fff", borderRadius: "14px", width: "56px", height: "56px" }}>
            {getInitials(patient.name)}
          </span>
          <div>
            <span className="patient-detail-state" style={{ fontSize: "11px" }}><i style={{ background: "#10b981" }} /> Active patient</span>
            <h2 style={{ fontSize: "20px", fontWeight: "800", marginTop: "2px" }}>{patient.name}</h2>
            <code style={{ fontSize: "11px", padding: "2px 8px", background: "#f1f5f9", border: "1px solid #e2e8f0", color: "#475569", borderRadius: "6px" }}>
              {patient.patientId}
            </code>
            <p style={{ marginTop: "6px", fontSize: "13px", color: "#64748b" }}>{patient.age} years · {patient.genderIdentity || patient.gender}</p>
          </div>
        </section>

        <section className="patient-detail-summary" aria-label="Patient record summary" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", border: "1.5px solid #edf2f7", borderRadius: "14px", overflow: "hidden" }}>
          <div style={{ padding: "14px", borderRight: "1.5px solid #edf2f7", borderBottom: "1.5px solid #edf2f7" }}>
            <span style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", color: "#94a3b8", letterSpacing: "0.05em" }}>Visits</span>
            <strong style={{ display: "block", fontSize: "15px", fontWeight: "800", color: "#0f172a", marginTop: "4px" }}>{getSummaryValue(visitCount, "0")}</strong>
          </div>
          <div style={{ padding: "14px", borderBottom: "1.5px solid #edf2f7" }}>
            <span style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", color: "#94a3b8", letterSpacing: "0.05em" }}>Last visit</span>
            <strong style={{ display: "block", fontSize: "15px", fontWeight: "800", color: "#0f172a", marginTop: "4px" }}>{getSummaryValue(lastVisit ? formatDate(lastVisit.date) : null, "No visits")}</strong>
          </div>
          <div style={{ padding: "14px", borderRight: "1.5px solid #edf2f7" }}>
            <span style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", color: "#94a3b8", letterSpacing: "0.05em" }}>Registered</span>
            <strong style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#0f172a", marginTop: "4px" }}>{formatDate(patient.createdAt)}</strong>
          </div>
          <div style={{ padding: "14px" }}>
            <span style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", color: "#94a3b8", letterSpacing: "0.05em" }}>Updated</span>
            <strong style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#0f172a", marginTop: "4px" }}>{formatDate(lastUpdated)}</strong>
          </div>
        </section>

        <section className="patient-detail-section patient-health-section" style={{ border: "1.5px solid #edf2f7", borderRadius: "14px" }}>
          <header style={{ padding: "14px 18px", borderBottom: "1.5px solid #edf2f7" }}>
            <div>
              <span style={{ fontSize: "10px", fontWeight: "800", textTransform: "uppercase", color: "#0d9488", letterSpacing: "0.05em" }}>Latest verified results</span>
              <h3 style={{ fontSize: "14px", fontWeight: "800", color: "#0f172a", marginTop: "2px" }}>Basic health information</h3>
            </div>
          </header>
          <div className="patient-health-grid" style={{ display: "grid", gap: "12px", padding: "16px" }}>
            {renderHealthMetric({ label: "Blood pressure", icon: Icons.heartPulse, metric: bloodPressure })}
            {renderHealthMetric({ label: "Blood sugar", icon: Icons.blood, metric: bloodSugar })}
          </div>
        </section>

        <section className="patient-detail-section" style={{ border: "1.5px solid #edf2f7", borderRadius: "14px" }}>
          <header style={{ padding: "14px 18px", borderBottom: "1.5px solid #edf2f7" }}>
            <div>
              <span style={{ fontSize: "10px", fontWeight: "800", textTransform: "uppercase", color: "#0d9488", letterSpacing: "0.05em" }}>Clinical identity</span>
              <h3 style={{ fontSize: "14px", fontWeight: "800", color: "#0f172a", marginTop: "2px" }}>Patient information</h3>
            </div>
          </header>
          <dl className="patient-detail-facts" style={{ padding: "16px", margin: 0, display: "grid", gap: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
              <dt style={{ color: "#64748b", fontWeight: "600" }}>Date of birth</dt>
              <dd style={{ margin: 0, color: "#1e293b", fontWeight: "700" }}>{formatDate(patient.dob)}</dd>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
              <dt style={{ color: "#64748b", fontWeight: "600" }}>Gender</dt>
              <dd style={{ margin: 0, color: "#1e293b", fontWeight: "700" }}>{patient.genderIdentity || patient.gender || "Not provided"}</dd>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
              <dt style={{ color: "#64748b", fontWeight: "600" }}>Referral doctor</dt>
              <dd style={{ margin: 0, color: "#1e293b", fontWeight: "700" }}>{patient.refDoctorName ? `Dr. ${patient.refDoctorName}` : "Not assigned"}</dd>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
              <dt style={{ color: "#64748b", fontWeight: "600" }}>Report delivery</dt>
              <dd style={{ margin: 0, color: "#1e293b", fontWeight: "700" }}>{patient.reportType || "Not specified"}</dd>
            </div>
          </dl>
        </section>

        <section className="patient-detail-section" style={{ border: "1.5px solid #edf2f7", borderRadius: "14px" }}>
          <header style={{ padding: "14px 18px", borderBottom: "1.5px solid #edf2f7" }}>
            <div>
              <span style={{ fontSize: "10px", fontWeight: "800", textTransform: "uppercase", color: "#0d9488", letterSpacing: "0.05em" }}>Communication</span>
              <h3 style={{ fontSize: "14px", fontWeight: "800", color: "#0f172a", marginTop: "2px" }}>Contact information</h3>
            </div>
          </header>
          <div className="patient-detail-contact-list" style={{ padding: "16px", display: "grid", gap: "14px" }}>
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <span style={{ color: "#0d9488", fontSize: "16px", background: "#f0fdfa", width: "32px", height: "32px", borderRadius: "8px", display: "grid", placeItems: "center" }}>
                {Icons.phone}
              </span>
              <div>
                <small style={{ display: "block", fontSize: "10px", color: "#94a3b8", textTransform: "uppercase", fontWeight: "700" }}>Phone number</small>
                <strong style={{ fontSize: "13px", color: "#1e293b" }}>{patient.phone ? `+91 ${patient.phone}` : "Not provided"}</strong>
              </div>
            </div>
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <span style={{ color: "#0d9488", fontSize: "16px", background: "#f0fdfa", width: "32px", height: "32px", borderRadius: "8px", display: "grid", placeItems: "center" }}>
                {Icons.mapPin}
              </span>
              <div>
                <small style={{ display: "block", fontSize: "10px", color: "#94a3b8", textTransform: "uppercase", fontWeight: "700" }}>Address</small>
                <strong style={{ fontSize: "13px", color: "#1e293b" }}>{patient.address || "Not provided"}</strong>
              </div>
            </div>
          </div>
        </section>
      </div>

      <footer className="patient-detail-actions" style={{ padding: "16px 20px", background: "#fafafb", borderTop: "1.5px solid #edf2f7", display: "grid", gap: "10px" }}>
        <button
          type="button"
          className="dash-btn-primary"
          onClick={() => router.push(`/patients/${patient._id}/new-visit`)}
          style={{ width: "100%", height: "42px", borderRadius: "10px", fontWeight: "700" }}
        >
          {Icons.plus} New visit
        </button>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          <button
            type="button"
            className="btn-lims-secondary"
            onClick={() => router.push(`/patients/${patient._id}/visits`)}
            style={{ height: "38px", borderRadius: "10px", fontWeight: "700", border: "1.5px solid #e2e8f0" }}
          >
            {Icons.list} History{Number.isFinite(visitCount) ? ` (${visitCount})` : ""}
          </button>
          {allowPatientPortal && (
            <button
              type="button"
              className="btn-lims-secondary"
              onClick={() => router.push(`/patients/${patient._id}/portal-access`)}
              style={{ height: "38px", borderRadius: "10px", fontWeight: "700", border: "1.5px solid #e2e8f0" }}
            >
              {Icons.shield} Portal access
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

export default memo(PatientSidebar);
