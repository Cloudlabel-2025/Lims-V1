"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icons } from "@/app/components/Icons";
import { applyCmsTheme } from "@/app/components/ThemeProvider";

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [userType, setUserType] = useState("tenant");
  const [tenantId, setTenantId] = useState("");
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
    setToken(params.get("token") || "");
    setUserType(params.get("userType") === "developer" ? "developer" : "tenant");
    setTenantId(params.get("tenantId") || "");
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!token) {
      setError("Reset token is missing");
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
          token,
          password,
          confirmPassword,
          userType,
          tenantId: tenantId || undefined,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Unable to reset password");
        return;
      }

      setSuccess(data.message || "Password has been reset successfully");
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
            <div className="floating-icon fi-3">{Icons.eye}</div>
            <div className="floating-icon fi-4">{Icons.alertCircle}</div>
          </div>

          <div className="login-brand-content">
            <div className="login-brand-logo">
              <div className="login-brand-logo-icon">{Icons.logo}</div>
            </div>
            <h1 className="login-brand-title">New Password</h1>
            <p className="login-brand-subtitle">Create a secure password</p>
            <div className="login-brand-divider" />
            <div className="login-brand-features">
              <div className="login-feature">
                <div className="login-feature-dot" />
                <span>Minimum 8 characters</span>
              </div>
              <div className="login-feature">
                <div className="login-feature-dot" />
                <span>Use uppercase, lowercase, number, and symbol</span>
              </div>
            </div>
          </div>
        </div>

        <div className="login-form-panel">
          <div className="login-form-wrapper">
            <div className="login-form-header">
              <h2>Reset password</h2>
              <p>Enter and confirm your new password</p>
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
                <label className="login-label" htmlFor="reset-password">
                  New Password
                </label>
                <div className="login-input-wrapper">
                  <span className="login-input-icon">{Icons.lock}</span>
                  <input
                    id="reset-password"
                    name="reset-password"
                    type={showPassword ? "text" : "password"}
                    className="login-input"
                    placeholder="Enter new password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    className="login-toggle-pw"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? Icons.eyeOff : Icons.eye}
                  </button>
                </div>
              </div>

              <div className="login-field">
                <label className="login-label" htmlFor="reset-confirm-password">
                  Confirm Password
                </label>
                <div className="login-input-wrapper">
                  <span className="login-input-icon">{Icons.lock}</span>
                  <input
                    id="reset-confirm-password"
                    name="reset-confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    className="login-input"
                    placeholder="Enter confirm password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    className="login-toggle-pw"
                    onClick={() => setShowConfirmPassword((value) => !value)}
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? Icons.eyeOff : Icons.eye}
                  </button>
                </div>
              </div>

              <button type="submit" className="login-submit" disabled={loading || Boolean(success)}>
                {loading ? (
                  <>
                    <div className="login-spinner" />
                    Resetting...
                  </>
                ) : (
                  <>
                    Reset Password
                    {Icons.arrowRight}
                  </>
                )}
              </button>
            </form>

            <div className="login-form-footer">
              <p>
                Back to sign in? <Link className="login-link" href="/">Open login</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
