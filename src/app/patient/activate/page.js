"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function Activate() {
  const params = useSearchParams();
  const router = useRouter();
  const tenantId = params.get("tenantId") || "mega";

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [portalPin, setPortalPin] = useState("");
  const [confirmPortalPin, setConfirmPortalPin] = useState("");
  
  // Visibility Toggles for Password / PIN fields (Eye Icons)
  const [showPin, setShowPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);

  const [otpSent, setOtpSent] = useState(false);
  const [devOtp, setDevOtp] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // Send OTP
  async function handleSendOtp() {
    const raw = phone.replace(/\D/g, "");
    if (!raw || raw.length !== 10) {
      return setError("Enter a valid 10-digit mobile number");
    }
    setLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      const r = await fetch("/api/patient-portal/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, phone: raw }),
      });
      const data = await r.json();
      setLoading(false);

      if (!r.ok) {
        return setError(data.error || "Unable to send OTP");
      }

      setOtpSent(true);
      setSuccessMsg(data.message || "OTP sent to your mobile number");
      if (data.devOtp) setDevOtp(data.devOtp);
    } catch {
      setLoading(false);
      setError("Network error. Try again.");
    }
  }

  // Submit Activation
  async function submit(e) {
    e.preventDefault();
    setError("");

    if (!phone || phone.replace(/\D/g, "").length !== 10) {
      return setError("Enter a valid 10-digit mobile number");
    }
    if (!otp || otp.length !== 6) {
      return setError("Enter the 6-digit OTP code");
    }
    if (!portalPin || !/^\d{4}$/.test(portalPin)) {
      return setError("Enter a private 4-digit PIN / Password");
    }
    if (portalPin !== confirmPortalPin) {
      return setError("Password / PIN fields do not match");
    }

    setLoading(true);

    try {
      const r = await fetch("/api/patient-portal/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          phone: phone.replace(/\D/g, ""),
          otp,
          portalPin,
          confirmPortalPin,
        }),
      });
      const data = await r.json();
      setLoading(false);

      if (!r.ok) {
        return setError(data.error || "Unable to activate patient portal");
      }

      router.replace(`/patient/portal?tenantId=${encodeURIComponent(tenantId)}`);
    } catch {
      setLoading(false);
      setError("Network error. Try again.");
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(135deg, #f0fdfa 0%, #e0f2fe 100%)", padding: "20px 14px", display: "grid", placeItems: "center" }}>
      <section style={{ width: "100%", maxWidth: 480, background: "white", borderRadius: 24, padding: 32, boxShadow: "0 20px 40px rgba(15,118,110,.12)", border: "1px solid #ccfbf1" }}>
        
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 52, marginBottom: 6 }}>📱</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", margin: "4px 0" }}>Activate Patient Portal</h1>
          <p style={{ fontSize: 16, fontWeight: 700, color: "#0d9488", margin: 0 }}>உங்கள் நோயாளி போர்ட்டலை செயல்படுத்தவும்</p>
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

        <form onSubmit={submit} style={{ display: "grid", gap: 16 }}>
          
          {/* Mobile Number + Get OTP button */}
          <label style={labelStyle}>
            Mobile Number / கைபேசி எண்
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <div style={{ position: "relative", flex: 1 }}>
                <span style={{ position: "absolute", left: 14, top: 15, fontSize: 15, fontWeight: 700, color: "#64748b" }}>+91</span>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  style={{ ...fieldStyle, marginTop: 0, paddingLeft: 54 }}
                  placeholder="9876543210"
                  required
                />
              </div>
              <button
                type="button"
                disabled={loading || phone.replace(/\D/g, "").length !== 10}
                onClick={handleSendOtp}
                style={{ padding: "0 16px", border: 0, borderRadius: 12, background: "#0d9488", color: "white", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
              >
                {otpSent ? "🔄 Resend" : "📱 Get OTP"}
              </button>
            </div>
          </label>

          {/* 6-Digit OTP */}
          <label style={labelStyle}>
            6-Digit OTP Code / 6 இலக்க OTP
            <input
              type="text"
              inputMode="numeric"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              style={{ ...fieldStyle, fontSize: 26, letterSpacing: 8, textAlign: "center", fontWeight: 800 }}
              placeholder="••••••"
              required
            />
          </label>

          {/* Choose 4-Digit Password / PIN with Eye Toggle Icon */}
          <label style={labelStyle}>
            Choose a private 4-digit PIN / Password
            <div style={{ position: "relative", marginTop: 6 }}>
              <input
                type={showPin ? "text" : "password"}
                inputMode="numeric"
                value={portalPin}
                onChange={(e) => setPortalPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                style={{ ...fieldStyle, marginTop: 0, paddingRight: 48, fontSize: showPin ? 24 : 28, letterSpacing: 8, textAlign: "center" }}
                placeholder="••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                style={{ position: "absolute", right: 12, top: 12, border: 0, background: "transparent", fontSize: 20, cursor: "pointer", color: "#64748b" }}
                title={showPin ? "Hide PIN" : "Show PIN"}
              >
                {showPin ? "👁️‍🗨️" : "👁️"}
              </button>
            </div>
          </label>

          {/* Repeat 4-Digit Password / PIN with Eye Toggle Icon */}
          <label style={labelStyle}>
            Repeat the 4-digit PIN / Password
            <div style={{ position: "relative", marginTop: 6 }}>
              <input
                type={showConfirmPin ? "text" : "password"}
                inputMode="numeric"
                value={confirmPortalPin}
                onChange={(e) => setConfirmPortalPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                style={{ ...fieldStyle, marginTop: 0, paddingRight: 48, fontSize: showConfirmPin ? 24 : 28, letterSpacing: 8, textAlign: "center" }}
                placeholder="••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPin(!showConfirmPin)}
                style={{ position: "absolute", right: 12, top: 12, border: 0, background: "transparent", fontSize: 20, cursor: "pointer", color: "#64748b" }}
                title={showConfirmPin ? "Hide PIN" : "Show PIN"}
              >
                {showConfirmPin ? "👁️‍🗨️" : "👁️"}
              </button>
            </div>
          </label>

          {/* Submit Button */}
          <button disabled={loading} style={primaryBtnStyle}>
            {loading ? "Activating..." : "🚀 Activate & View Reports / செயல்படுத்தவும்"}
          </button>
        </form>

        <p style={{ color: "#64748b", textAlign: "center", marginTop: 20, fontSize: 13 }}>
          🔒 Keep your PIN private. Laboratory staff will never ask for your private PIN.
        </p>
      </section>
    </main>
  );
}

const labelStyle = { fontWeight: 800, fontSize: 15, color: "#334155" };
const fieldStyle = { width: "100%", boxSizing: "border-box", marginTop: 6, minHeight: 52, border: "2px solid #cbd5e1", borderRadius: 12, padding: "10px 14px", fontSize: 18, outline: "none" };
const primaryBtnStyle = { minHeight: 58, border: 0, borderRadius: 12, background: "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)", color: "white", fontSize: 17, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 12px rgba(13,148,136,0.3)" };

export default function PatientActivatePage() {
  return (
    <Suspense fallback={null}>
      <Activate />
    </Suspense>
  );
}
