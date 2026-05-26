"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icons } from "@/app/components/Icons";
import { applyCmsTheme } from "@/app/components/ThemeProvider";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [userType, setUserType] = useState("tenant");
  const [tenantId, setTenantId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [devResetLink, setDevResetLink] = useState("");

  useEffect(() => {
    applyCmsTheme();
    const params = new URLSearchParams(window.location.search);
    setUserType(params.get("userType") === "developer" ? "developer" : "tenant");
    setTenantId(params.get("tenantId") || "");
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setDevResetLink("");

    if (!email.trim()) {
      setError("Enter email");
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
          tenantId: tenantId || undefined,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Unable to start password reset");
        return;
      }

      setSuccess(data.message || "If the account exists, a password reset link has been generated.");

      if (data.resetToken) {
        const params = new URLSearchParams({
          token: data.resetToken,
          userType: data.resetContext?.userType || userType,
        });
        if (data.resetContext?.tenantId) {
          params.set("tenantId", data.resetContext.tenantId);
        }
        setDevResetLink(`/reset-password?${params.toString()}`);
      }
    } catch {
      setError("Unable to start password reset");
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
            <p className="login-brand-subtitle">Secure password recovery</p>
            <div className="login-brand-divider" />
            <div className="login-brand-features">
              <div className="login-feature">
                <div className="login-feature-dot" />
                <span>Reset link sent securely</span>
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
              <h2>Forgot password</h2>
              <p>Enter your email to receive a reset link</p>
            </div>

            {error && (
              <div className="login-error">
                {Icons.alertCircle}
                {error}
              </div>
            )}

            {success && (
              <div className="login-error" style={{ background: "#ecfdf5", borderColor: "#bbf7d0", color: "#166534" }}>
                {Icons.shield}
                {success}
              </div>
            )}

            <form className="login-form" onSubmit={handleSubmit}>
              <div className="login-field">
                <label className="login-label" htmlFor="forgot-email">
                  Email
                </label>
                <div className="login-input-wrapper">
                  <span className="login-input-icon">{Icons.mail}</span>
                  <input
                    id="forgot-email"
                    name="forgot-email"
                    type="email"
                    className="login-input"
                    placeholder="Enter email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              <button type="submit" className="login-submit" disabled={loading}>
                {loading ? (
                  <>
                    <div className="login-spinner" />
                    Sending link...
                  </>
                ) : (
                  <>
                    Send Reset Link
                    {Icons.arrowRight}
                  </>
                )}
              </button>
            </form>

            {devResetLink && (
              <div className="login-form-footer">
                <p>
                  Development reset link: <Link href={devResetLink}>Open reset page</Link>
                </p>
              </div>
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
