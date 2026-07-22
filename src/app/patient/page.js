"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function tenantFromBrowser(params) {
  const explicit = params.get("tenantId");
  if (explicit) return explicit;
  if (typeof window === "undefined") return "";
  const host = window.location.hostname.toLowerCase();
  return host.endsWith(".localhost") ? host.split(".")[0] : (host.split(".").length > 2 ? host.split(".")[0] : "");
}

function PatientLogin() {
  const router = useRouter();
  const params = useSearchParams();
  const [tenantId, setTenantId] = useState(() => tenantFromBrowser(params));
  const [patientId, setPatientId] = useState("");
  const [dob, setDob] = useState("");
  const [portalPin, setPortalPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(e) {
    e.preventDefault(); setLoading(true); setError("");
    const r = await fetch("/api/patient-portal/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId, patientId, dob, portalPin }) });
    const data = await r.json(); setLoading(false);
    if (!r.ok) return setError(data.error || "Unable to sign in");
    router.replace(`/patient/portal?tenantId=${encodeURIComponent(tenantId)}`);
  }
  return <main style={{ minHeight: "100vh", background: "#f0fdfa", padding: "24px 14px", display: "grid", placeItems: "center" }}>
    <section style={{ width: "100%", maxWidth: 480, background: "white", borderRadius: 20, padding: 28, boxShadow: "0 15px 40px rgba(15,118,110,.12)" }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}><div style={{ fontSize: 48 }}>🏥</div><h1 style={{ fontSize: 28, margin: "8px 0" }}>My Lab Reports</h1><p style={{ color: "#475569", fontSize: 17 }}>எனது ஆய்வக அறிக்கைகள்</p></div>
      {error && <div style={{ background: "#fef2f2", color: "#b91c1c", padding: 14, borderRadius: 10, marginBottom: 14, fontWeight: 700 }}>{error}</div>}
      <form onSubmit={submit} style={{ display: "grid", gap: 16 }}>
        {!tenantFromBrowser(params) && <label style={{ fontWeight: 700 }}>Lab ID<input value={tenantId} onChange={(e) => setTenantId(e.target.value)} style={field} required /></label>}
        <label style={{ fontWeight: 700 }}>Patient ID / நோயாளி எண்<input value={patientId} onChange={(e) => setPatientId(e.target.value.toUpperCase())} style={field} placeholder="Printed on your bill" required /></label>
        <label style={{ fontWeight: 700 }}>Date of birth / பிறந்த தேதி<input type="date" value={dob} onChange={(e) => setDob(e.target.value)} style={field} required /></label>
        <label style={{ fontWeight: 700 }}>4-digit PIN / 4 இலக்க PIN<input inputMode="numeric" value={portalPin} onChange={(e) => setPortalPin(e.target.value.replace(/\D/g, "").slice(0, 4))} style={{ ...field, fontSize: 26, letterSpacing: 8, textAlign: "center" }} required /></label>
        <button disabled={loading} style={primary}>{loading ? "Opening..." : "Open My Reports / அறிக்கைகளைத் திற"}</button>
      </form>
      <p style={{ marginTop: 20, textAlign: "center", color: "#64748b" }}>First time? Scan the QR code printed by the laboratory.</p>
    </section>
  </main>;
}

const field = { width: "100%", boxSizing: "border-box", marginTop: 7, minHeight: 54, border: "2px solid #cbd5e1", borderRadius: 10, padding: "10px 14px", fontSize: 18 };
const primary = { minHeight: 60, border: 0, borderRadius: 12, background: "#0d9488", color: "white", fontSize: 18, fontWeight: 800, cursor: "pointer" };
export default function PatientLoginPage() { return <Suspense fallback={null}><PatientLogin /></Suspense>; }
