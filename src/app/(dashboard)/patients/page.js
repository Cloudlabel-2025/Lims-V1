"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icons } from "@/app/components/Icons";
import { formatDate, getInitials } from "@/app/utils/patient-helpers";

function DetailRow({ icon, label, value, truncate = false }) {
  return (
    <div className="contact-row">
      <span className="contact-icon-mini">{icon}</span>
      <span className={truncate ? "text-truncate-2" : undefined}>{value || "Not provided"}</span>
    </div>
  );
}

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

export default function PatientList() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [allPatients, setAllPatients] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [viewState, setViewState] = useState("grid");
  const debounceRef = useRef(null);

  const fetchAllPatients = useCallback(async () => {
    setListLoading(true);
    try {
      const res = await fetch("/api/patient");
      const data = await res.json();
      setAllPatients(Array.isArray(data) ? data : []);
    } catch {
      setAllPatients([]);
    } finally {
      setListLoading(false);
    }
  }, []);

  const doSearch = useCallback(async (query) => {
    setListLoading(true);
    try {
      const res = await fetch(`/api/patient?search=${encodeURIComponent(query)}`);
      const data = await res.json();
      setAllPatients(Array.isArray(data) ? data : []);
    } catch {
      setAllPatients([]);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    fetchAllPatients();
  }, [fetchAllPatients]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!mounted) return;

    if (!searchQuery.trim()) {
      fetchAllPatients();
      return;
    }

    debounceRef.current = setTimeout(() => doSearch(searchQuery), 350);
    return () => clearTimeout(debounceRef.current);
  }, [doSearch, fetchAllPatients, mounted, searchQuery]);

  const handleSelectPatient = (patient) => {
    setSelectedPatient(patient);
    setSidebarOpen(true);
    setSearchQuery("");
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
    setTimeout(() => setSelectedPatient(null), 400);
  };

  if (!mounted) return null;

  return (
    <div className="patients-page">
      <div className={`sidebar-overlay ${sidebarOpen ? "open" : ""}`} onClick={closeSidebar} />

      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <PatientSidebar patient={selectedPatient} onClose={closeSidebar} />
      </aside>

      <div
        className="page-header"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div className="page-header-icon">{Icons.users}</div>
          <div className="page-header-text">
            <h4>Patient Master List</h4>
            <small>{allPatients.length} patients registered</small>
          </div>
        </div>

        <div
          className="header-actions"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            flex: 1,
            justifyContent: "flex-end",
            minWidth: "300px",
          }}
        >
          <div
            style={{
              display: "flex",
              background: "var(--border-light)",
              padding: "4px",
              borderRadius: "10px",
              marginRight: "8px",
            }}
          >
            <button
              onClick={() => setViewState("grid")}
              style={{
                padding: "6px 10px",
                borderRadius: "8px",
                border: "none",
                background: viewState === "grid" ? "#fff" : "transparent",
                color: viewState === "grid" ? "var(--primary)" : "var(--text-muted)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "12px",
                fontWeight: "600",
                transition: "all 0.2s",
                boxShadow: viewState === "grid" ? "0 2px 4px rgba(0,0,0,0.05)" : "none",
              }}
            >
              {Icons.grid}
            </button>
            <button
              onClick={() => setViewState("list")}
              style={{
                padding: "6px 10px",
                borderRadius: "8px",
                border: "none",
                background: viewState === "list" ? "#fff" : "transparent",
                color: viewState === "list" ? "var(--primary)" : "var(--text-muted)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "12px",
                fontWeight: "600",
                transition: "all 0.2s",
                boxShadow: viewState === "list" ? "0 2px 4px rgba(0,0,0,0.05)" : "none",
              }}
            >
              {Icons.list}
            </button>
          </div>

          <div className="search-container" style={{ position: "relative", flex: 1, maxWidth: "320px" }}>
            <span
              style={{
                position: "absolute",
                left: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-muted)",
                fontSize: "14px",
              }}
            >
              {Icons.search}
            </span>
            <input
              type="text"
              className="lims-input"
              placeholder="Search patients..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              style={{ paddingLeft: "36px", height: "40px", fontSize: "13px" }}
            />
          </div>

          <button
            className="btn-lims-primary"
            onClick={() => router.push("/patients/register")}
            style={{ height: "40px", padding: "0 16px", fontSize: "13px", whiteSpace: "nowrap" }}
          >
            {Icons.plus} Create New Patient
          </button>
        </div>
      </div>

      <div className="patient-list-container">
        <div className="patient-list-header" style={{ marginBottom: "16px" }}>
          <span className="patient-list-count">
            {listLoading ? "Loading..." : `${allPatients.length} patients`}
          </span>
          <button
            className="btn-refresh"
            onClick={fetchAllPatients}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              cursor: "pointer",
              border: "none",
              background: "transparent",
              color: "var(--primary)",
              fontWeight: "600",
              fontSize: "13px",
            }}
          >
            <div
              style={{
                transform: listLoading ? "rotate(360deg)" : "none",
                transition: "transform 0.5s",
              }}
            >
              {Icons.logo}
            </div>
            Refresh
          </button>
        </div>

        {!listLoading && allPatients.length === 0 ? (
          <div className="patient-list-empty">
            {Icons.noResults}
            <div className="patient-list-empty-title">No patients yet</div>
            <button className="btn-lims-primary" onClick={() => router.push("/patients/register")}>
              Register First Patient
            </button>
          </div>
        ) : viewState === "grid" ? (
          <div
            className="patient-list-grid"
            style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px" }}
          >
            {allPatients.map((patient) => (
              <div
                key={patient._id}
                className={`form-card ${selectedPatient?._id === patient._id ? "selected" : ""}`}
                onClick={() => handleSelectPatient(patient)}
                style={{
                  padding: "20px",
                  marginBottom: "0",
                  cursor: "pointer",
                  position: "relative",
                  border:
                    selectedPatient?._id === patient._id
                      ? "2px solid var(--primary)"
                      : "1.5px solid var(--border)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
                  <div
                    className="patient-photo-card"
                    style={{ width: "60px", height: "60px", margin: "0", background: "var(--primary-50)" }}
                  >
                    <div style={{ fontSize: "20px", fontWeight: "700", color: "var(--primary)" }}>
                      {getInitials(patient.name)}
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-primary)" }}>
                      {patient.name}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--primary)", fontWeight: "600" }}>
                      {patient.patientId}
                    </div>
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
                    <span>
                      <strong>
                        {patient.age} Y / {patient.gender}
                      </strong>
                    </span>
                    <span style={{ opacity: 0.8 }}>{patient.phone}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <button
                      className="patient-list-edit-btn"
                      onClick={(event) => {
                        event.stopPropagation();
                        router.push(`/patients/edit/${patient._id}`);
                      }}
                      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                      title="Update Patient Record"
                    >
                      {Icons.edit}
                    </button>
                  </div>
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
                  }}
                >
                  <span>Registered: {formatDate(patient.createdAt)}</span>
                  {selectedPatient?._id === patient._id && (
                    <span style={{ color: "var(--primary)", fontWeight: "700" }}>SELECTED</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="form-card" style={{ padding: "0", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
                  <th
                    style={{
                      padding: "12px 20px",
                      textAlign: "left",
                      color: "var(--text-secondary)",
                      fontWeight: "600",
                    }}
                  >
                    Patient Details
                  </th>
                  <th
                    style={{
                      padding: "12px 20px",
                      textAlign: "left",
                      color: "var(--text-secondary)",
                      fontWeight: "600",
                    }}
                  >
                    ID
                  </th>
                  <th
                    style={{
                      padding: "12px 20px",
                      textAlign: "left",
                      color: "var(--text-secondary)",
                      fontWeight: "600",
                    }}
                  >
                    Info
                  </th>
                  <th
                    style={{
                      padding: "12px 20px",
                      textAlign: "left",
                      color: "var(--text-secondary)",
                      fontWeight: "600",
                    }}
                  >
                    Contact
                  </th>
                  <th
                    style={{
                      padding: "12px 20px",
                      textAlign: "left",
                      color: "var(--text-secondary)",
                      fontWeight: "600",
                    }}
                  >
                    Registered Date
                  </th>
                  <th
                    style={{
                      padding: "12px 20px",
                      textAlign: "center",
                      color: "var(--text-secondary)",
                      fontWeight: "600",
                    }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {allPatients.map((patient) => (
                  <tr
                    key={patient._id}
                    onClick={() => handleSelectPatient(patient)}
                    style={{
                      borderBottom: "1px solid var(--border-light)",
                      cursor: "pointer",
                      background:
                        selectedPatient?._id === patient._id ? "var(--primary-50)" : "transparent",
                      transition: "background 0.2s",
                    }}
                    onMouseOver={(event) => {
                      if (selectedPatient?._id !== patient._id) {
                        event.currentTarget.style.background = "#f8fafc";
                      }
                    }}
                    onMouseOut={(event) => {
                      if (selectedPatient?._id !== patient._id) {
                        event.currentTarget.style.background = "transparent";
                      }
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
                            color: "var(--primary)",
                          }}
                        >
                          {getInitials(patient.name)}
                        </div>
                        <div style={{ fontWeight: "600", color: "var(--text-primary)" }}>{patient.name}</div>
                      </div>
                    </td>
                    <td style={{ padding: "12px 20px", color: "var(--text-secondary)" }}>
                      <span
                        style={{
                          background: "var(--border-light)",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          fontSize: "11px",
                          fontWeight: "600",
                        }}
                      >
                        {patient.patientId}
                      </span>
                    </td>
                    <td style={{ padding: "12px 20px", color: "var(--text-secondary)" }}>
                      {patient.age} Y / {patient.gender}
                    </td>
                    <td style={{ padding: "12px 20px", color: "var(--text-secondary)" }}>{patient.phone}</td>
                    <td style={{ padding: "12px 20px", color: "var(--text-muted)", fontSize: "12px" }}>
                      {formatDate(patient.createdAt)}
                    </td>
                    <td style={{ padding: "12px 20px", textAlign: "center" }}>
                      <button
                        style={{
                          border: "none",
                          background: "transparent",
                          color: "var(--text-muted)",
                          cursor: "pointer",
                          padding: "4px",
                          borderRadius: "6px",
                          transition: "all 0.2s",
                        }}
                        onClick={(event) => {
                          event.stopPropagation();
                          router.push(`/patients/edit/${patient._id}`);
                        }}
                        onMouseOver={(event) => {
                          event.currentTarget.style.color = "var(--primary)";
                        }}
                        onMouseOut={(event) => {
                          event.currentTarget.style.color = "var(--text-muted)";
                        }}
                      >
                        {Icons.edit}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
