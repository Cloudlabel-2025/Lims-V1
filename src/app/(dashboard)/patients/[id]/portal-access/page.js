"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";

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
    <section className="form-card" style={{ padding: 32, textAlign: "center", border: "2px solid #0d9488" }}>
      <h2 style={{ marginBottom: 4 }}>Patient Portal Access</h2><p style={{ color: "#64748b" }}>Scan to see reports and bills securely</p>
      <h3>{data.patient.name}</h3><p>Patient ID: <strong>{data.patient.patientId}</strong> · Mobile ending {data.patient.phoneLast4}</p>
      <Image src={data.qrDataUrl} alt="Patient portal activation QR code" width={280} height={280} unoptimized />
      <p style={{ marginBottom: 6 }}>After scanning, enter this one-time access PIN:</p>
      <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: 10, color: "#0d9488", border: "2px dashed #0d9488", borderRadius: 12, padding: "14px 18px", display: "inline-block" }}>{data.accessPin}</div>
      <p style={{ marginTop: 18 }}>Confirm the patient&apos;s date of birth, then choose a private 4-digit portal PIN.</p>
      <p style={{ fontSize: 12, color: "#64748b" }}>Single use · Expires {new Date(data.expiresAt).toLocaleString("en-IN")} · Keep this slip private</p>
    </section>
    <style jsx global>{`@media print { .no-print, .dash-sidebar, .dash-topbar { display:none!important; } .dash-content { padding:0!important; } }`}</style>
  </div>;
}
