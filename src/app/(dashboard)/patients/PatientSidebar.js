"use client";

import { memo, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icons } from "@/app/components/Icons";
import { formatDate, getInitials } from "@/app/utils/patient-helpers";
import { cachedJsonFetch } from "@/app/lib/use-current-user";

function PatientSidebar({ patient, onClose }) {
  const router = useRouter();
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

  function getSummaryValue(value, emptyLabel) {
    if (summaryUnavailable) return "Unavailable";
    if (!clinicalSummary) return "—";
    return value || emptyLabel;
  }

  function renderHealthMetric({ label, icon, metric }) {
    const isLoading = !clinicalSummary && !summaryUnavailable;
    const state = summaryUnavailable ? "unavailable" : metric ? metric.flag || "normal" : "empty";

    return (
      <article className={`patient-health-metric patient-health-metric--${state}`}>
        <span className="patient-health-icon" aria-hidden="true">{icon}</span>
        <div>
          <span>{label}</span>
          <strong>
            {isLoading ? "—" : metric?.value || (summaryUnavailable ? "Unavailable" : "Not recorded")}
            {metric?.unit ? <small>{metric.unit}</small> : null}
          </strong>
          <p>
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
    <div className="patient-detail-drawer">
      <header className="patient-detail-header">
        <div>
          <span>Patient record</span>
          <strong>Patient details</strong>
        </div>
        <button type="button" onClick={onClose} aria-label="Close patient details">
          {Icons.close}
        </button>
      </header>

      <div className="patient-detail-content">
        <section className="patient-detail-identity">
          <span className="patient-detail-avatar">{getInitials(patient.name)}</span>
          <div>
            <span className="patient-detail-state"><i /> Active patient</span>
            <h2>{patient.name}</h2>
            <code>{patient.patientId}</code>
            <p>{patient.age} years · {patient.genderIdentity || patient.gender}</p>
          </div>
        </section>

        <section className="patient-detail-summary" aria-label="Patient record summary">
          <div>
            <span>Visits</span>
            <strong>{getSummaryValue(visitCount, "0")}</strong>
          </div>
          <div>
            <span>Last visit</span>
            <strong>{getSummaryValue(lastVisit ? formatDate(lastVisit.date) : null, "No visits")}</strong>
          </div>
          <div>
            <span>Registered</span>
            <strong>{formatDate(patient.createdAt)}</strong>
          </div>
          <div>
            <span>Updated</span>
            <strong>{formatDate(lastUpdated)}</strong>
          </div>
        </section>

        <section className="patient-detail-section patient-health-section">
          <header>
            <div>
              <span>Latest verified results</span>
              <h3>Basic health information</h3>
            </div>
          </header>
          <div className="patient-health-grid">
            {renderHealthMetric({ label: "Blood pressure", icon: Icons.heartPulse, metric: bloodPressure })}
            {renderHealthMetric({ label: "Blood sugar", icon: Icons.blood, metric: bloodSugar })}
          </div>
        </section>

        <section className="patient-detail-section">
          <header>
            <div>
              <span>Clinical identity</span>
              <h3>Patient information</h3>
            </div>
          </header>
          <dl className="patient-detail-facts">
            <div>
              <dt>Date of birth</dt>
              <dd>{formatDate(patient.dob)}</dd>
            </div>
            <div>
              <dt>Gender</dt>
              <dd>{patient.genderIdentity || patient.gender || "Not provided"}</dd>
            </div>
            <div>
              <dt>Referral doctor</dt>
              <dd>{patient.refDoctorName || "Not assigned"}</dd>
            </div>
            <div>
              <dt>Report delivery</dt>
              <dd>{patient.reportType || "Not specified"}</dd>
            </div>
          </dl>
        </section>

        <section className="patient-detail-section">
          <header>
            <div>
              <span>Communication</span>
              <h3>Contact information</h3>
            </div>
          </header>
          <div className="patient-detail-contact-list">
            <div>
              <span>{Icons.phone}</span>
              <div>
                <small>Phone number</small>
                <strong>{patient.phone ? `+91 ${patient.phone}` : "Not provided"}</strong>
              </div>
            </div>
            <div>
              <span>{Icons.mapPin}</span>
              <div>
                <small>Address</small>
                <strong>{patient.address || "Not provided"}</strong>
              </div>
            </div>
          </div>
        </section>
      </div>

      <footer className="patient-detail-actions">
        <button type="button" className="dash-btn-primary" onClick={() => router.push(`/patients/${patient._id}/new-visit`)}>
          {Icons.plus} New visit
        </button>
        <div>
          <button type="button" className="btn-lims-secondary" onClick={() => router.push(`/patients/${patient._id}/visits`)}>
            {Icons.list} Visit history{Number.isFinite(visitCount) ? ` (${visitCount})` : ""}
          </button>
          <button type="button" className="btn-lims-secondary" onClick={() => router.push(`/patients/${patient._id}/portal-access`)}>
            {Icons.shield} Portal access
          </button>
        </div>
      </footer>
    </div>
  );
}

export default memo(PatientSidebar);
