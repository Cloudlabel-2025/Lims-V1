"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";


export default function PatientPortalAccessSlipPage() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { fetch(`/api/patient/${id}/portal-access`, { method: "POST" }).then(async (r) => { const body = await r.json(); if (!r.ok) throw new Error(body.error); setData(body); }).catch((e) => setError(e.message)); }, [id]);
  if (error) return <div className="lims-alert danger">{error}</div>;
  if (!data) return <div className="form-card" style={{ padding: 30 }}>Preparing secure access slip...</div>;
  return <div style={{ maxWidth: 720, margin: "0 auto" }}>
    <div className="no-print" style={{ display: "flex", gap: 10, marginBottom: 16 }}><button className="btn-lims-secondary" onClick={() => router.back()}>Back</button><button className="btn-lims-primary" onClick={() => window.print()}>Print access slip</button></div>
    <section className="form-card" style={{ padding: 32, textAlign: "center", border: "2px solid var(--primary)" }}>
      <h2 style={{ marginBottom: 4 }}>Patient Portal Access</h2>
      <p style={{ color: "#64748b" }}>Access test reports, visit history, and receipts via Mobile OTP or WhatsApp</p>
      <h3>{data.patient.name}</h3>
      <p>Patient ID: <strong>{data.patient.patientId}</strong> · Registered Mobile: +91 {data.patient.phone || "—"}</p>
      
      <div style={{ margin: "24px 0", padding: 24, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 16 }}>
        <h4 style={{ margin: "0 0 8px 0", color: "#166534", fontSize: 18 }}>📱 Instant WhatsApp Portal Access</h4>
        <p style={{ margin: "0 0 16px 0", color: "#15803d", fontSize: 14 }}>Send the patient an instant 1-click login link via WhatsApp:</p>
        {data.whatsAppShareUrl && (
          <a
            href={data.whatsAppShareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-lims-primary"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 24px", fontSize: 16, background: "#25d366", borderColor: "#16a34a", textDecoration: "none", color: "white", fontWeight: 700, borderRadius: 12 }}
          >
            💬 Share Login Link via WhatsApp
          </a>
        )}
      </div>

      <div style={{ background: "#f8fafc", padding: 20, borderRadius: 12, border: "1px solid #e2e8f0", margin: "16px 0", textAlign: "left" }}>
        <h4 style={{ margin: "0 0 8px 0", fontSize: 15, color: "#334155" }}>🔑 Alternative Mobile OTP Login Steps:</h4>
        <ol style={{ margin: 0, paddingLeft: 20, color: "#475569", fontSize: 14, lineHeight: 1.6 }}>
          <li>Go to the Patient Portal website on your mobile phone browser.</li>
          <li>Enter your registered 10-digit mobile number.</li>
          <li>Enter the 6-digit OTP code sent to your mobile to view reports & bills instantly.</li>
        </ol>
      </div>

      <p style={{ fontSize: 12, color: "#64748b" }}>Secure Access · Active Account · Keep this information confidential</p>
    </section>
    <style jsx global>{`@media print { .no-print, .dash-sidebar, .dash-topbar { display:none!important; } .dash-content { padding:0!important; } }`}</style>
  </div>;
}
