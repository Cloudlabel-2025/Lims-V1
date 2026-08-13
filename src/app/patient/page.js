"use client";

import { Suspense, useEffect, useState } from "react";
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

  const [tenantId, setTenantId] = useState("");
  const [initialTenant, setInitialTenant] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const tenant = tenantFromBrowser(params);
    setInitialTenant(tenant);
    if (tenant) {
      setTenantId(tenant);
    }
  }, [params]);

  // Handle Login
  async function handleLogin(e) {
    e.preventDefault();
    if (!phone || phone.replace(/\D/g, "").length !== 10) {
      return setError("Please enter a valid 10-digit mobile number");
    }
    if (!dob) {
      return setError("Please select your date of birth");
    }
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/patient-portal/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          phone: phone.replace(/\D/g, ""),
          dob
        }),
      });
      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        return setError(data.error || "Invalid mobile number or date of birth");
      }

      router.replace(`/patient/portal?tenantId=${encodeURIComponent(tenantId)}`);
    } catch {
      setLoading(false);
      setError("Network error. Please try again.");
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(135deg, #f0fdfa 0%, #e0f2fe 100%)", padding: "24px 14px", display: "grid", placeItems: "center" }}>
      <section style={{ width: "100%", maxWidth: 460, background: "white", borderRadius: 24, padding: 32, boxShadow: "0 20px 40px rgba(15,118,110,.12)", border: "1px solid #ccfbf1" }}>
        
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 52, marginBottom: 8 }}>🏥</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", margin: "4px 0" }}>Patient Portal</h1>
          <p style={{ color: "#0d9488", fontSize: 16, fontWeight: 700, margin: 0 }}>நோயாளி போர்டல்</p>
          <small style={{ color: "#64748b", fontSize: 13, display: "block", marginTop: 4 }}>Access your test reports, visit history & billing receipts</small>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", padding: "12px 16px", borderRadius: 12, marginBottom: 18, fontSize: 14, fontWeight: 600 }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: "grid", gap: 18 }}>
          {!initialTenant && (
            <label style={labelStyle}>
              Lab Code / lab ID
              <input
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                style={fieldStyle}
                placeholder="e.g. your-lab-code"
                required
              />
            </label>
          )}

          <label style={labelStyle}>
            Username (Mobile Number) / கைபேசி எண்
            <div style={{ position: "relative", marginTop: 6 }}>
              <span style={{ position: "absolute", left: 14, top: 16, fontSize: 16, fontWeight: 700, color: "#64748b" }}>+91</span>
              <input
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                style={{ ...fieldStyle, marginTop: 0, paddingLeft: 54 }}
                placeholder="9876543210"
                required
                autoFocus
              />
            </div>
          </label>

          <label style={{ ...labelStyle, display: "block", marginTop: 10 }}>
            Password (Date of Birth) / பிறந்த தேதி
            <input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              style={fieldStyle}
              required
            />
          </label>

          <button disabled={loading} style={primaryBtnStyle}>
            {loading ? "Signing in..." : "🔓 Sign In / உள்நுழைக"}
          </button>
        </form>


        {/* Footer Guidance */}
        <div style={{ marginTop: 24, paddingTop: 18, borderTop: "1px solid #f1f5f9", textAlign: "center", color: "#64748b", fontSize: 13, lineHeight: "1.5" }}>
          🔒 Your Username is your registered Mobile Number and your Password is your Date of Birth.
          <div style={{ marginTop: 12 }}>
            <a href="/login" style={{ color: "#0d9488", fontWeight: 700, textDecoration: "underline" }}>
              👨‍⚕️ Staff or Doctor? Sign in to Console here
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}

const labelStyle = { fontWeight: 700, fontSize: 15, color: "#334155" };
const fieldStyle = { width: "100%", boxSizing: "border-box", marginTop: 6, minHeight: 52, border: "2px solid #cbd5e1", borderRadius: 12, padding: "10px 14px", fontSize: 18, outline: "none" };
const primaryBtnStyle = { minHeight: 56, border: 0, borderRadius: 12, background: "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)", color: "white", fontSize: 17, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 12px rgba(13,148,136,0.3)" };

export default function PatientLoginPage() {
  return (
    <Suspense fallback={null}>
      <PatientLogin />
    </Suspense>
  );
}
