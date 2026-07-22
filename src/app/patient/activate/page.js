"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function Activate() {
  const params = useSearchParams(); const router = useRouter();
  const tenantId = params.get("tenantId") || ""; const token = params.get("token") || "";
  const [accessPin, setAccessPin] = useState(""); const [dob, setDob] = useState(""); const [portalPin, setPortalPin] = useState(""); const [confirmPortalPin, setConfirmPortalPin] = useState("");
  const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  async function submit(e) { e.preventDefault(); setLoading(true); setError(""); const r = await fetch("/api/patient-portal/activate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId, token, accessPin, dob, portalPin, confirmPortalPin }) }); const data = await r.json(); setLoading(false); if (!r.ok) return setError(data.error || "Unable to activate"); router.replace(`/patient/portal?tenantId=${encodeURIComponent(tenantId)}`); }
  return <main style={{ minHeight: "100vh", background: "#f0fdfa", padding: 14, display: "grid", placeItems: "center" }}><section style={{ width: "100%", maxWidth: 500, background: "white", borderRadius: 20, padding: 28 }}>
    <div style={{ textAlign: "center" }}><div style={{ fontSize: 48 }}>📱</div><h1>Activate Patient Portal</h1><p style={{ fontSize: 17, color: "#475569" }}>உங்கள் நோயாளி போர்ட்டலை செயல்படுத்தவும்</p></div>
    {error && <div style={{ background: "#fef2f2", color: "#b91c1c", padding: 14, borderRadius: 10, fontWeight: 700 }}>{error}</div>}
    <form onSubmit={submit} style={{ display: "grid", gap: 16, marginTop: 20 }}>
      <label style={label}>6-digit access PIN<input inputMode="numeric" value={accessPin} onChange={(e) => setAccessPin(e.target.value.replace(/\D/g, "").slice(0, 6))} style={{ ...field, letterSpacing: 8, textAlign: "center", fontSize: 26 }} required /></label>
      <label style={label}>Patient date of birth<input type="date" value={dob} onChange={(e) => setDob(e.target.value)} style={field} required /></label>
      <label style={label}>Choose a private 4-digit PIN<input inputMode="numeric" value={portalPin} onChange={(e) => setPortalPin(e.target.value.replace(/\D/g, "").slice(0, 4))} style={{ ...field, letterSpacing: 8, textAlign: "center" }} required /></label>
      <label style={label}>Repeat the 4-digit PIN<input inputMode="numeric" value={confirmPortalPin} onChange={(e) => setConfirmPortalPin(e.target.value.replace(/\D/g, "").slice(0, 4))} style={{ ...field, letterSpacing: 8, textAlign: "center" }} required /></label>
      <button disabled={loading} style={primary}>{loading ? "Activating..." : "Activate and View Reports"}</button>
    </form><p style={{ color: "#64748b", textAlign: "center", marginTop: 18 }}>Keep your PIN private. Laboratory staff will never ask for it.</p>
  </section></main>;
}
const label = { fontWeight: 800, fontSize: 16 }; const field = { width: "100%", boxSizing: "border-box", marginTop: 7, minHeight: 54, border: "2px solid #cbd5e1", borderRadius: 10, padding: "10px 14px", fontSize: 18 }; const primary = { minHeight: 60, border: 0, borderRadius: 12, background: "#0d9488", color: "white", fontSize: 18, fontWeight: 800 };
export default function PatientActivatePage() { return <Suspense fallback={null}><Activate /></Suspense>; }
