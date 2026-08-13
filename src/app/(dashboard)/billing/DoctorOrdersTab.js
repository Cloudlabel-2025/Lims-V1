"use client";

import { useEffect, useState } from "react";

function getInitials(name) {
  if (!name) return "DR";
  const cleanName = name.replace(/^Dr\.\s+/i, "");
  const parts = cleanName.split(" ");
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const DoctorAvatar = ({ name }) => (
  <div style={{
    width: 32,
    height: 32,
    borderRadius: "50%",
    background: "linear-gradient(135deg, var(--primary-dark), var(--primary))",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: 11,
    marginRight: 10,
    flexShrink: 0,
    boxShadow: "0 2px 4px color-mix(in srgb, var(--primary-dark) 15%, transparent)"
  }}>
    {getInitials(name)}
  </div>
);

const PatientAvatar = ({ name }) => (
  <div style={{
    width: 32,
    height: 32,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #4f46e5, #6366f1)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: 11,
    marginRight: 10,
    flexShrink: 0,
    boxShadow: "0 2px 4px rgba(79, 70, 229, 0.15)"
  }}>
    {getInitials(name)}
  </div>
);

const StatusBadge = ({ status }) => {
  const configs = {
    pending: { bg: "#fffbeb", color: "#b45309", dot: "#f59e0b", label: "Pending Billing" },
    received: { bg: "#f0fdf4", color: "#15803d", dot: "#22c55e", label: "Processed" },
    completed: { bg: "#f0f9ff", color: "#0369a1", dot: "#0ea5e9", label: "Completed" },
    cancelled: { bg: "#fef2f2", color: "#b91c1c", dot: "#ef4444", label: "Cancelled" },
  };
  const config = configs[status] || configs.pending;

  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "4px 10px",
      borderRadius: 12,
      background: config.bg,
      color: config.color,
      fontSize: 11,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.5px",
      border: `1px solid ${config.dot}20`
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: config.dot }} />
      {config.label}
    </span>
  );
};

const ItemsTags = ({ packages, tests }) => {
  const items = [];
  (packages || []).forEach(p => items.push({ name: p.name, isPackage: true }));
  (tests || []).forEach(t => items.push({ name: t.name, isPackage: false }));

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {items.map((item, idx) => (
        <span key={idx} style={{
          padding: "4px 8px",
          borderRadius: 6,
          fontSize: 11,
          fontWeight: 600,
          background: item.isPackage ? "#f3e8ff" : "#e0f2fe",
          color: item.isPackage ? "#6b21a8" : "#0369a1",
          border: item.isPackage ? "1px solid #e9d5ff" : "1px solid #bae6fd",
          display: "inline-flex",
          alignItems: "center",
          gap: 4
        }}>
          {item.isPackage ? "📦" : "🔬"} {item.name}
        </span>
      ))}
      {!items.length && <span style={{ color: "#94a3b8", fontSize: 12 }}>No tests requested</span>}
    </div>
  );
};

const VitalsDisplay = ({ vitals, notes }) => {
  const hasVitals = vitals?.bp || vitals?.pulse;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {hasVitals && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {vitals.bp && (
            <span style={{ fontSize: 11, background: "#fff5f5", color: "#e53e3e", padding: "3px 8px", borderRadius: 6, border: "1px solid #fed7d7", display: "inline-flex", alignItems: "center", gap: 4 }}>
              ❤️ <span style={{ fontWeight: 700 }}>BP:</span> {vitals.bp}
            </span>
          )}
          {vitals.pulse && (
            <span style={{ fontSize: 11, background: "#f0fdf4", color: "#16a34a", padding: "3px 8px", borderRadius: 6, border: "1px solid #bbf7d0", display: "inline-flex", alignItems: "center", gap: 4 }}>
              💓 <span style={{ fontWeight: 700 }}>Pulse:</span> {vitals.pulse}
            </span>
          )}
        </div>
      )}
      {notes && (
        <div style={{ fontSize: 11, color: "#475569", fontStyle: "italic", background: "#f8fafc", padding: "6px 10px", borderRadius: 6, border: "1px solid #e2e8f0", marginTop: hasVitals ? 2 : 0, maxWidth: 240, wordBreak: "break-word" }}>
          📝 {notes}
        </div>
      )}
      {!hasVitals && !notes && <span style={{ color: "#94a3b8", fontSize: 12 }}>—</span>}
    </div>
  );
};

export default function DoctorOrdersTab({ onAcceptRequest }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const loadRequests = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/doctor/test-requests", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load doctor requests");
      setRequests(data.requests || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const filtered = requests.filter((r) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (
      r.requestId?.toLowerCase().includes(term) ||
      r.doctor?.name?.toLowerCase().includes(term) ||
      r.patient?.name?.toLowerCase().includes(term) ||
      r.patient?.phone?.includes(term)
    );
  });

  if (loading) {
    return (
      <div className="module-panel" style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
        <div className="lims-spinner" style={{ margin: "0 auto 16px auto" }} />
        Loading doctor portal test requests...
      </div>
    );
  }

  if (error) {
    return (
      <div className="lims-alert danger" style={{ margin: 20 }}>
        ⚠️ {error}
      </div>
    );
  }

  return (
    <div className="module-panel" style={{ padding: 24, background: "#ffffff", borderRadius: 12, boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.025)" }}>
      {/* Header Container */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 16, borderBottom: "1px solid #f1f5f9", paddingBottom: 20 }}>
        <div>
          <h3 style={{ margin: "0 0 6px 0", color: "#0f172a", fontSize: 20, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
            📋 Incoming Doctor Referrals
          </h3>
          <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>
            Direct digital orders submitted by referring doctor clinics for patient billing and sample registration.
          </p>
        </div>
        
        {/* Controls Container */}
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", fontSize: 14 }}>🔍</span>
            <input
              className="lims-input"
              style={{ width: 280, paddingLeft: 34, height: 38, borderRadius: 8, fontSize: 13, border: "1px solid #cbd5e1" }}
              placeholder="Search by doctor, patient, ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="dash-btn-secondary"
            style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: 8, 
              height: 38, 
              padding: "0 16px", 
              fontSize: 13, 
              fontWeight: 600,
              borderRadius: 8, 
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              cursor: "pointer",
              transition: "all 0.2s"
            }}
            onClick={() => loadRequests(true)}
            disabled={refreshing}
          >
            <span style={{ display: "inline-block", transform: refreshing ? "rotate(360deg)" : "none", transition: "transform 0.8s ease" }}>🔄</span>
            {refreshing ? "Refreshing..." : "Refresh Queue"}
          </button>
        </div>
      </div>

      {/* Requests Table Container */}
      <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid #e2e8f0" }}>
        <table className="table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
          <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
              <th style={{ padding: "14px 16px", fontWeight: 700, color: "#475569" }}>Request ID</th>
              <th style={{ padding: "14px 16px", fontWeight: 700, color: "#475569" }}>Referring Doctor</th>
              <th style={{ padding: "14px 16px", fontWeight: 700, color: "#475569" }}>Patient Details</th>
              <th style={{ padding: "14px 16px", fontWeight: 700, color: "#475569" }}>Requested Diagnostics</th>
              <th style={{ padding: "14px 16px", fontWeight: 700, color: "#475569" }}>Vitals & Clinical Notes</th>
              <th style={{ padding: "14px 16px", fontWeight: 700, color: "#475569" }}>Status</th>
              <th style={{ padding: "14px 16px", fontWeight: 700, color: "#475569", textAlign: "right" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((req) => (
              <tr key={req._id} style={{ borderBottom: "1px solid #f1f5f9", transition: "background-color 0.2s", hover: { backgroundColor: "#f8fafc" } }}>
                <td style={{ padding: "16px", verticalAlign: "middle" }}>
                  <span style={{
                    fontFamily: "monospace",
                    background: "#f1f5f9",
                    color: "#334155",
                    padding: "3px 8px",
                    borderRadius: 6,
                    fontWeight: 700,
                    fontSize: 12
                  }}>
                    {req.requestId}
                  </span>
                </td>
                <td style={{ padding: "16px", verticalAlign: "middle" }}>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <DoctorAvatar name={req.doctor?.name} />
                    <div>
                      <strong style={{ color: "#1e293b", fontSize: 13 }}>Dr. {req.doctor?.name || "Referring Doctor"}</strong>
                      <div style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>
                        {req.doctor?.clinicName || req.doctor?.speciality || "Clinic"}
                      </div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: "16px", verticalAlign: "middle" }}>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <PatientAvatar name={req.patient?.name} />
                    <div>
                      <strong style={{ color: "#1e293b", fontSize: 13 }}>{req.patient?.name}</strong>
                      <div style={{ color: "#64748b", fontSize: 11, marginTop: 2, fontFamily: "monospace" }}>
                        {req.patient?.patientId} · {req.patient?.phone}
                      </div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: "16px", verticalAlign: "middle" }}>
                  <ItemsTags packages={req.testPackages} tests={req.tests} />
                </td>
                <td style={{ padding: "16px", verticalAlign: "middle" }}>
                  <VitalsDisplay vitals={req.vitals} notes={req.notes} />
                </td>
                <td style={{ padding: "16px", verticalAlign: "middle" }}>
                  <StatusBadge status={req.status} />
                </td>
                <td style={{ padding: "16px", verticalAlign: "middle", textAlign: "right" }}>
                  {req.status === "pending" ? (
                    <button
                      type="button"
                      className="btn-lims-primary"
                      style={{ 
                        fontSize: 12, 
                        padding: "8px 14px", 
                        borderRadius: 8, 
                        background: "linear-gradient(135deg, var(--primary-dark), var(--primary))",
                        color: "#ffffff",
                        border: "none",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        boxShadow: "0 2px 4px color-mix(in srgb, var(--primary-dark) 15%, transparent)",
                        transition: "all 0.2s"
                      }}
                      onClick={() => onAcceptRequest(req)}
                    >
                      ⚡ Accept &amp; Bill
                    </button>
                  ) : (
                    <span style={{ 
                      fontSize: 11, 
                      fontWeight: 700, 
                      color: "#64748b", 
                      background: "#f1f5f9", 
                      padding: "4px 10px", 
                      borderRadius: 8,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px"
                    }}>
                      Processed
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && (
          <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
            <span style={{ fontSize: 24 }}>📭</span>
            <p style={{ marginTop: 8, fontSize: 14 }}>No incoming doctor portal test requests found matching the filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}
