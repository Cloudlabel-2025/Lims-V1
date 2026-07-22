"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PasswordField from "@/app/components/PasswordField";

function ActivationForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") || "");
  const [tenantId, setTenantId] = useState(params.get("tenantId") || "");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, tenantId, otp, password, confirmPassword, userType: "tenant" }),
    });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) return setError(data.error || "Unable to activate account");
    setMessage("Your doctor portal account is active. You can now sign in.");
    setTimeout(() => router.replace(`/?access=lab&tenantId=${encodeURIComponent(tenantId)}`), 1500);
  }

  return (
    <main className="login-page">
      <div className="login-card" style={{ maxWidth: 520, margin: "40px auto" }}>
        <div className="login-form-side" style={{ width: "100%" }}>
          <h2>Activate doctor portal</h2>
          <p className="login-subtitle">Enter the OTP from your invitation and create your password.</p>
          {error && <div className="lims-alert danger">{error}</div>}
          {message && <div className="lims-alert success">{message}</div>}
          <form onSubmit={submit} className="login-form">
            <label className="login-label">Lab ID<input className="login-input" value={tenantId} onChange={(e) => setTenantId(e.target.value)} required /></label>
            <label className="login-label">Registered email<input type="email" className="login-input" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
            <label className="login-label">6-digit OTP<input inputMode="numeric" maxLength={6} className="login-input" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} required /></label>
            <PasswordField label="New password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <PasswordField label="Confirm password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            <button className="login-submit" disabled={loading}>{loading ? "Activating..." : "Activate account"}</button>
          </form>
        </div>
      </div>
    </main>
  );
}

export default function ActivateAccountPage() {
  return <Suspense fallback={<div className="login-page" />}><ActivationForm /></Suspense>;
}
