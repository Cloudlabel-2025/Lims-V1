"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icons } from "@/app/components/Icons";
import SuccessDialog from "@/app/components/SuccessDialog";
import { applyCmsTheme } from "@/app/components/ThemeProvider";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState("request"); // "request" | "verify"
  const [email, setEmail] = useState("");
  const [userType, setUserType] = useState("tenant");
  const [tenantId, setTenantId] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    applyCmsTheme();
    const params = new URLSearchParams(window.location.search);
    setUserType(params.get("userType") === "developer" ? "developer" : "tenant");
    setTenantId(params.get("tenantId") || "");
  }, []);

  async function handleRequestOtp(event) {
    event.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Enter your email");
      return;
    }

    if (userType === "tenant" && !tenantId.trim()) {
      setError("Tenant ID is required");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: email.trim(),
          userType,
          tenantId: tenantId.trim() || undefined,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Unable to send OTP");
        return;
      }

      setSuccess("OTP sent to your email. Check your inbox.");
      setStep("verify");
    } catch {
      setError("Unable to send OTP");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!otp.trim()) {
      setError("Enter the OTP sent to your email");
      return;
    }

    if (!password || !confirmPassword) {
      setError("Enter new password and confirm password");
      return;
    }

    if (password !== confirmPassword) {
      setError("Password and confirm password must match");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: email.trim(),
          otp: otp.trim(),
          password,
          confirmPassword,
          userType,
          tenantId: tenantId.trim() || undefined,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Unable to reset password");
        return;
      }

      setSuccess("Password reset successfully. You can now log in.");
      setOtp("");
      setPassword("");
      setConfirmPassword("");
    } catch {
      setError("Unable to reset password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-bg">
        <div className="login-bg-orb login-bg-orb-1" />
        <div className="login-bg-orb login-bg-orb-2" />
        <div className="login-bg-orb login-bg-orb-3" />
        <div className="login-bg-grid" />
      </div>

      <div className="login-container">
        <div className="login-brand-panel">
          <div className="login-floating-icons">
            <div className="floating-icon fi-1">{Icons.lock}</div>
            <div className="floating-icon fi-2">{Icons.shield}</div>
            <div className="floating-icon fi-3">{Icons.mail}</div>
            <div className="floating-icon fi-4">{Icons.alertCircle}</div>
          </div>
          <div className="login-brand-content">
            <div className="login-brand-logo">
              <div className="login-brand-logo-icon">{Icons.logo}</div>
            </div>
            <h1 className="login-brand-title">Reset Access</h1>
            <p className="login-brand-subtitle">
              {step === "request" ? "We'll send an OTP to your email" : "Enter the OTP from your email"}
            </p>
            <div className="login-brand-divider" />
            <div className="login-brand-features">
              <div className="login-feature">
                <div className="login-feature-dot" />
                <span>6-digit OTP sent to your email</span>
              </div>
              <div className="login-feature">
                <div className="login-feature-dot" />
                <span>OTP expires in 10 minutes</span>
              </div>
              <div className="login-feature">
                <div className="login-feature-dot" />
                <span>Password policy protected</span>
              </div>
            </div>
          </div>
        </div>

        <div className="login-form-panel">
          <div className="login-form-wrapper">
            <div className="login-form-header">
              <h2>{step === "request" ? "Forgot password" : "Enter OTP"}</h2>
              <p>
                {step === "request"
                  ? "Enter your email to receive a 6-digit OTP"
                  : `OTP sent to ${email}. Check your inbox.`}
              </p>
            </div>

            {error && (
              <div className="login-error">
                {Icons.alertCircle}
                {error}
              </div>
            )}

            <SuccessDialog message={success} onClose={() => setSuccess("")} />

            {step === "request" && (
              <form className="login-form" onSubmit={handleRequestOtp}>
                <div className="login-field">
                  <label className="login-label" htmlFor="forgot-email">Email</label>
                  <div className="login-input-wrapper">
                    <span className="login-input-icon">{Icons.mail}</span>
                    <input
                      id="forgot-email"
                      type="email"
                      className="login-input"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>

                <button type="submit" className="login-submit" disabled={loading}>
                  {loading ? (
                    <><div className="login-spinner" />Sending OTP...</>
                  ) : (
                    <>Send OTP {Icons.arrowRight}</>
                  )}
                </button>
              </form>
            )}

            {step === "verify" && !success && (
              <form className="login-form" onSubmit={handleResetPassword}>
                <div className="login-field">
                  <label className="login-label" htmlFor="reset-otp">6-digit OTP</label>
                  <div className="login-input-wrapper">
                    <span className="login-input-icon">{Icons.shield}</span>
                    <input
                      id="reset-otp"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      className="login-input"
                      placeholder="Enter 6-digit OTP"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      autoComplete="one-time-code"
                      required
                    />
                  </div>
                </div>

                <div className="login-field">
                  <label className="login-label" htmlFor="reset-password">New Password</label>
                  <div className="login-input-wrapper">
                    <span className="login-input-icon">{Icons.lock}</span>
                    <input
                      id="reset-password"
                      type={showPassword ? "text" : "password"}
                      className="login-input"
                      placeholder="Enter new password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      className="login-toggle-pw"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? Icons.eyeOff : Icons.eye}
                    </button>
                  </div>
                </div>

                <div className="login-field">
                  <label className="login-label" htmlFor="reset-confirm-password">Confirm Password</label>
                  <div className="login-input-wrapper">
                    <span className="login-input-icon">{Icons.lock}</span>
                    <input
                      id="reset-confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      className="login-input"
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      className="login-toggle-pw"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showConfirmPassword ? Icons.eyeOff : Icons.eye}
                    </button>
                  </div>
                </div>

                <button type="submit" className="login-submit" disabled={loading}>
                  {loading ? (
                    <><div className="login-spinner" />Resetting...</>
                  ) : (
                    <>Reset Password {Icons.arrowRight}</>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => { setStep("request"); setError(""); setOtp(""); }}
                  style={{ background: "none", border: "none", color: "var(--primary)", cursor: "pointer", fontSize: "13px", marginTop: "8px", width: "100%", textAlign: "center" }}
                >
                  Resend OTP
                </button>
              </form>
            )}

            <div className="login-form-footer">
              <p>
                Remember your password? <Link className="login-link" href="/">Back to login</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
