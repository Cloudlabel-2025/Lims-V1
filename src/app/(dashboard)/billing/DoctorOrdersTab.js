"use client";

import { useEffect, useState } from "react";

export default function DoctorOrdersTab({ onAcceptRequest }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const loadRequests = async () => {
    setLoading(true);
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

  if (loading) return <div className="module-panel" style={{ padding: 24 }}>Loading doctor portal test requests...</div>;
  if (error) return <div className="lims-alert danger" style={{ margin: 20 }}>{error}</div>;

  return (
    <div className="module-panel" style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h3 style={{ margin: 0 }}>Doctor Portal Incoming Orders</h3>
          <small style={{ color: "#64748b" }}>Test requests submitted by referring doctors for lab billing &amp; sample collection.</small>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            className="lims-input"
            style={{ width: 280 }}
            placeholder="Search Doctor, Patient, Request ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="button" className="dash-btn-secondary" onClick={loadRequests}>
            🔄 Refresh Queue
          </button>
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table className="table" style={{ width: "100%", fontSize: 13 }}>
          <thead>
            <tr>
              <th>Request ID</th>
              <th>Referring Doctor</th>
              <th>Patient Details</th>
              <th>Requested Test Packages / Tests</th>
              <th>Vitals / Clinical Notes</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((req) => {
              const statusBadges = {
                pending: { bg: "#fef3c7", color: "#92400e", label: "🟡 Pending Billing" },
                received: { bg: "#dcfce7", color: "#166534", label: "🟢 Processed" },
                completed: { bg: "#e0f2fe", color: "#0369a1", label: "🔵 Completed" },
                cancelled: { bg: "#fee2e2", color: "#991b1b", label: "🔴 Cancelled" },
              };
              const badge = statusBadges[req.status] || statusBadges.pending;
              const packagesText = (req.testPackages || []).map((p) => p.name).join(", ");
              const testsText = (req.tests || []).map((t) => t.name).join(", ");
              const itemsText = [packagesText, testsText].filter(Boolean).join(" · ") || "Diagnostics";

              return (
                <tr key={req._id}>
                  <td><strong>{req.requestId}</strong></td>
                  <td>
                    <strong>Dr. {req.doctor?.name || "Referring Doctor"}</strong>
                    <br />
                    <small>{req.doctor?.clinicName || req.doctor?.speciality || ""}</small>
                  </td>
                  <td>
                    <strong>{req.patient?.name}</strong>
                    <br />
                    <small>{req.patient?.patientId} · {req.patient?.phone}</small>
                  </td>
                  <td>
                    <strong>{itemsText}</strong>
                  </td>
                  <td>
                    {req.vitals?.bp ? `BP: ${req.vitals.bp} ` : ""}
                    {req.vitals?.pulse ? `Pulse: ${req.vitals.pulse} ` : ""}
                    {req.notes ? `(${req.notes})` : ""}
                  </td>
                  <td>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 12, background: badge.bg, color: badge.color }}>
                      {badge.label}
                    </span>
                  </td>
                  <td>
                    {req.status === "pending" ? (
                      <button
                        type="button"
                        className="btn-lims-primary"
                        style={{ fontSize: 12, padding: "6px 12px" }}
                        onClick={() => onAcceptRequest(req)}
                      >
                        ⚡ Accept &amp; Create Bill
                      </button>
                    ) : (
                      <span style={{ color: "#64748b", fontSize: 12 }}>Processed</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!filtered.length && <p style={{ color: "#64748b", textAlign: "center", marginTop: 20 }}>No doctor test requests found.</p>}
      </div>
    </div>
  );
}
