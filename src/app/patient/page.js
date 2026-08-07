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
  const initialTenant = tenantFromBrowser(params);

  const [tenantId, setTenantId] = useState(() => initialTenant || "");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState("phone"); // 'phone' | 'otp'
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [loading, setLoading] = useState(false);

  // Check for auto-login via WhatsApp token link parameter
  useEffect(() => {
    const token = params.get("token");
    const tenantParam = params.get("tenantId") || initialTenant;
    if (token && tenantParam) {
      setLoading(true);
      fetch("/api/patient-portal/token-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: tenantParam, token }),
      })
        .then(async (res) => {
          const data = await res.json();
          if (res.ok) {
            router.replace(`/patient/portal?tenantId=${encodeURIComponent(tenantParam)}`);
          } else {
            setError(data.error || "Invalid or expired WhatsApp login link.");
            setLoading(false);
          }
        })
        .catch(() => {
          setError("Unable to process WhatsApp login link.");
          setLoading(false);
        });
    }
  }, [params, initialTenant, router]);

  // Handle Send OTP
  async function handleSendOtp(e) {
    e.preventDefault();
    if (!phone || phone.replace(/\D/g, "").length !== 10) {
      return setError("Please enter a valid 10-digit mobile number");
    }
    setLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/patient-portal/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, phone: phone.replace(/\D/g, "") }),
      });
      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        return setError(data.error || "Unable to send OTP");
      }

      setSuccessMsg(data.message || "OTP sent successfully!");
      if (data.devOtp) setDevOtp(data.devOtp);
      setStep("otp");
    } catch (err) {
      setLoading(false);
      setError("Network error. Please try again.");
    }
  }

  // Handle Verify OTP
  async function handleVerifyOtp(e) {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      return setError("Please enter the 6-digit OTP sent to your mobile");
    }
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/patient-portal/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, phone: phone.replace(/\D/g, ""), otp }),
      });
      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        return setError(data.error || "Invalid OTP code");
      }

      router.replace(`/patient/portal?tenantId=${encodeURIComponent(tenantId)}`);
    } catch (err) {
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
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", margin: "4px 0" }}>Patient Portal Login</h1>
          <p style={{ color: "#0d9488", fontSize: 16, fontWeight: 700, margin: 0 }}>எனது ஆய்வக அறிக்கைகள்</p>
          <small style={{ color: "#64748b", fontSize: 13, display: "block", marginTop: 4 }}>Access your test reports, visit history & billing receipts</small>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", padding: "12px 16px", borderRadius: 12, marginBottom: 18, fontSize: 14, fontWeight: 600 }}>
            {error}
          </div>
        )}

        {/* Success Alert */}
        {successMsg && (
          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534", padding: "12px 16px", borderRadius: 12, marginBottom: 18, fontSize: 14, fontWeight: 600 }}>
            {successMsg}
            {devOtp && (
              <div style={{ marginTop: 6, fontSize: 13, background: "#dcfce7", padding: "4px 8px", borderRadius: 6, display: "inline-block" }}>
                🔑 Dev Testing OTP: <strong>{devOtp}</strong>
              </div>
            )}
          </div>
        )}

        {/* Step 1: Phone Entry Form */}
        {step === "phone" && (
          <form onSubmit={handleSendOtp} style={{ display: "grid", gap: 18 }}>
            {!initialTenant && (
              <label style={labelStyle}>
                Lab Code / lab ID
                <input
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  style={fieldStyle}
                  placeholder="e.g. mega"
                  required
                />
              </label>
            )}

            <label style={labelStyle}>
              Mobile Number / கைபேசி எண்
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

            <button disabled={loading} style={primaryBtnStyle}>
              {loading ? "Sending OTP..." : "📱 Get Login OTP / OTP பெறுக"}
            </button>
          </form>
        )}

        {/* Step 2: OTP Verification Form */}
        {step === "otp" && (
          <form onSubmit={handleVerifyOtp} style={{ display: "grid", gap: 18 }}>
            <div style={{ background: "#f8fafc", padding: "10px 14px", borderRadius: 10, fontSize: 14, color: "#334155", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Sending OTP to: <strong>+91 {phone}</strong></span>
              <button
                type="button"
                onClick={() => { setStep("phone"); setError(""); setSuccessMsg(""); }}
                style={{ border: 0, background: "transparent", color: "#0d9488", fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}
              >
                Change
              </button>
            </div>

            <label style={labelStyle}>
              Enter 6-digit OTP / OTP உள்ளிடவும்
              <input
                type="text"
                inputMode="numeric"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                style={{ ...fieldStyle, fontSize: 28, letterSpacing: 10, textAlign: "center", fontWeight: 800 }}
                placeholder="••••••"
                required
                autoFocus
              />
            </label>

            <button disabled={loading} style={primaryBtnStyle}>
              {loading ? "Verifying..." : "🔓 Verify & Open My Reports / அறிக்கைகளைத் திற"}
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={handleSendOtp}
              style={{ border: "1px solid #cbd5e1", borderRadius: 12, background: "white", padding: 12, fontSize: 14, fontWeight: 700, color: "#475569", cursor: "pointer" }}
            >
              🔄 Resend OTP
            </button>
          </form>
        )}

        {/* Footer Guidance */}
        <div style={{ marginTop: 24, paddingTop: 18, borderTop: "1px solid #f1f5f9", textAlign: "center", color: "#64748b", fontSize: 13 }}>
          💡 <strong>WhatsApp Login:</strong> If you received a login link on WhatsApp from your diagnostic lab, simply click the link to sign in instantly!
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
