"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import PasswordField from "@/app/components/PasswordField";
import { Icons } from "@/app/components/Icons";

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
    <main className="activation-page">
      <section className="activation-shell">
        <header className="activation-brand">
          <span className="activation-brand-icon">{Icons.logo}</span>
          <div><strong>CHC LIMS</strong><small>Secure account activation</small></div>
        </header>
        <div className="activation-card">
          <div className="activation-heading">
            <p>Invitation verification</p>
            <h1>Activate your account</h1>
            <span>Confirm your laboratory invitation and create a secure password.</span>
          </div>

          <div className="activation-context" aria-label="Invitation details">
            <div><small>Laboratory ID</small><strong>{tenantId || "Enter below"}</strong></div>
            <div><small>Access type</small><strong>Doctor portal</strong></div>
            <div><small>Registered email</small><strong>{email || "Enter below"}</strong></div>
          </div>

          {error && <div className="lims-alert danger">{error}</div>}
          {message && <div className="lims-alert success">{message}</div>}
          <form onSubmit={submit} className="login-form activation-form">
            <label className="login-label">Lab ID<input className="login-input" value={tenantId} onChange={(e) => setTenantId(e.target.value)} placeholder="Your laboratory ID" required /></label>
            <label className="login-label">Registered email<input type="email" className="login-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" required /></label>
            <label className="login-label">6-digit invitation code<input inputMode="numeric" maxLength={6} className="login-input activation-otp" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" autoComplete="one-time-code" required /></label>
            <PasswordField label="New password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <PasswordField label="Confirm password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            <div className="activation-security-note">{Icons.shield}<span>Use at least 8 characters with a number and symbol.</span></div>
            <button className="login-submit" disabled={loading}>{loading ? "Activating account..." : "Activate my account"}</button>
          </form>
          <footer className="activation-footer">Already activated? <Link href="/">Sign in</Link></footer>
        </div>
        <p className="activation-trust">{Icons.lock} Invitation details are transmitted securely.</p>
      </section>
    </main>
  );
}

export default function ActivateAccountPage() {
  return <Suspense fallback={<div className="login-page" />}><ActivationForm /></Suspense>;
}
