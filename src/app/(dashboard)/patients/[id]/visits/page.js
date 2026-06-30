"use client";
import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Icons } from "@/app/components/Icons";
import { cachedJsonFetch } from "@/app/lib/use-current-user";

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatTime(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function statusBadge(status) {
  const map = {
    paid: { bg: "var(--success-50)", color: "var(--success-700)" },
    unpaid: { bg: "var(--warning-50)", color: "var(--warning-700)" },
    partial: { bg: "var(--info-50)", color: "var(--info-700)" },
    cancelled: { bg: "var(--danger-50)", color: "var(--danger-700)" },
  };
  const s = map[status] || { bg: "var(--border-light)", color: "var(--text-muted)" };
  return (
    <span style={{
      display: "inline-block", padding: "4px 10px", borderRadius: "6px",
      fontSize: "11px", fontWeight: "700",
      background: s.bg, color: s.color, textTransform: "uppercase",
    }}>
      {status}
    </span>
  );
}

export default function VisitHistory({ params }) {
  const resolvedParams = use(params);
  const { id } = resolvedParams;
  const router = useRouter();

  const [patient, setPatient] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [patientRes, billingRes] = await Promise.all([
          cachedJsonFetch(`/api/patient/${id}`, { ttl: 10_000 }),
          cachedJsonFetch(`/api/patient/${id}/billing`, { ttl: 5_000 }),
        ]);

        if (!patientRes.response.ok) {
          setError("Patient not found");
          return;
        }
        setPatient(patientRes.data);

        if (billingRes.response.ok) {
          setRecords(billingRes.data.billingRecords || []);
        } else {
          setError("Failed to load billing records");
        }
      } catch {
        setError("Failed to load data");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id]);

  if (loading) {
    return <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>Loading visit history...</div>;
  }

  if (error && !patient) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <h3 style={{ color: "var(--text-primary)" }}>{error}</h3>
        <button className="btn-lims-secondary" onClick={() => router.push("/patients")}>Back to Patients</button>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-icon">{Icons.person}</div>
        <div className="page-header-text">
          <h4>Visit History</h4>
          <small>{patient?.name} ({patient?.patientId}) — {records.length} visit{records.length !== 1 ? "s" : ""}</small>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button className="btn-view-patients" onClick={() => router.push(`/patients/${id}/new-visit`)}>
            {Icons.add} New Visit
          </button>
          <button className="btn-view-patients" onClick={() => router.push("/patients")}>
            {Icons.list} View Patients
          </button>
        </div>
      </div>

      {error && (
        <div className="lims-alert danger" role="alert" style={{ marginBottom: "20px" }}>
          <span>{error}</span>
        </div>
      )}

      <div className="form-card" style={{ padding: "0", overflowX: "auto" }}>
        <div className="form-card-header">
          <h6 style={{ margin: 0 }}>Billing Records</h6>
        </div>
        <div className="lims-table-container" style={{ overflowX: "auto" }}>
          <table className="lims-table" style={{ width: "100%", minWidth: "700px", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)" }}>Bill ID</th>
                <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)" }}>Date</th>
                <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)" }}>Tests</th>
                <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)" }}>Amount</th>
                <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)" }}>Status</th>
                <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)" }}>Priority</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: "14px" }}>
                    No visits found for this patient.
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r._id} style={{ borderBottom: "1px solid var(--border-light)", transition: "background 0.2s" }}>
                    <td style={{ padding: "14px 20px" }}>
                      <span style={{ fontWeight: "700", color: "var(--brand-action, var(--primary))", fontSize: "13px" }}>{r.billId}</span>
                    </td>
                    <td style={{ padding: "14px 20px", color: "var(--text-secondary)", fontSize: "13px" }}>
                      {formatDate(r.createdAt)}<br />
                      <small style={{ color: "var(--text-muted)", fontSize: "11px" }}>{formatTime(r.createdAt)}</small>
                    </td>
                    <td style={{ padding: "14px 20px", color: "var(--text-secondary)", fontSize: "13px" }}>
                      <span style={{ background: "var(--border-light)", padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: "600" }}>
                        {r.items?.length || 0} Tests
                      </span>
                    </td>
                    <td style={{ padding: "14px 20px" }}>
                      <strong style={{ color: "var(--text-primary)", fontSize: "14px" }}>₹{r.totalAmount || 0}</strong>
                    </td>
                    <td style={{ padding: "14px 20px" }}>
                      {statusBadge(r.billingStatus)}
                    </td>
                    <td style={{ padding: "14px 20px", color: "var(--text-secondary)", fontSize: "13px", textTransform: "capitalize" }}>
                      {r.priority || "routine"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
