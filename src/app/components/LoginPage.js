"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icons } from "@/app/components/Icons";

const developerLoginFeatures = [
  "Tenant Lab Onboarding",
  "Branding & Module Control",
  "Admin Access Management",
  "Platform Configuration",
];

export default function LoginPage({
  onLogin,
  initialTenantId = "",
  initialUserType = "developer",
  lockUserType = false,
  initialTheme = null,
}) {
  const router = useRouter();
  const [tenantId, setTenantId] = useState(initialTenantId);
  const [userType, setUserType] = useState(initialUserType);
  const [theme, setTheme] = useState(initialTheme);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const isTenantLogin = userType === "tenant";
  const labName = theme?.labName || (isTenantLogin ? "Lab LIMS" : "CHC Lab CMS");
  const brandLogoUrl = isTenantLogin ? theme?.logo : null;
  const brandLogoLabel = theme?.logoAltText || `${labName} logo`;
  const brandLogoStyle = brandLogoUrl ? { backgroundImage: `url("${brandLogoUrl}")` } : undefined;
  const loginFeatures = isTenantLogin
    ? Array.isArray(theme?.loginHighlights)
      ? theme.loginHighlights
      : []
    : developerLoginFeatures;
  const loginThemeStyle =
    isTenantLogin && theme
      ? {
          "--primary": theme.primaryColor || "#0d9488",
          "--primary-light": theme.accentColor || theme.primaryColor || "#14b8a6",
          "--primary-dark": theme.secondaryColor || theme.primaryColor || "#0f766e",
          "--login-accent": theme.accentColor || "#f59e0b",
        }
      : undefined;

  useEffect(() => {
    let cancelled = false;

    async function loadTheme() {
      const activeTenantId = tenantId.trim();

      if (!isTenantLogin || !activeTenantId) {
        if (!cancelled) setTheme(null);
        return;
      }

      const response = await fetch(`/api/theme?tenantId=${encodeURIComponent(activeTenantId)}`, {
        credentials: "include",
      });

      if (!response.ok) return;
      const data = await response.json();
      if (!cancelled) setTheme(data.theme);
    }

    loadTheme();

    return () => {
      cancelled = true;
    };
  }, [isTenantLogin, tenantId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password.trim()) {
      setError("Please enter both email and password.");
      return;
    }
    if (isTenantLogin && !tenantId.trim()) {
      setError("Please enter your lab tenant ID.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email,
          password,
          rememberMe,
          userType,
          tenantId: tenantId.trim() || undefined,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Login failed. Please check your credentials.");
        return;
      }

      if (onLogin) onLogin(data.user);
      router.push(userType === "developer" ? "/developer/dashboard" : "/dashboard");
      router.refresh();
    } catch {
      setError("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page" style={loginThemeStyle}>
      {/* Animated Background */}
      <div className="login-bg">
        <div className="login-bg-orb login-bg-orb-1" />
        <div className="login-bg-orb login-bg-orb-2" />
        <div className="login-bg-orb login-bg-orb-3" />
        <div className="login-bg-grid" />
      </div>

      <div className="login-container">
        {/* Left Panel — Branding */}
        <div className="login-brand-panel">
          {/* Floating Icons */}
          <div className="login-floating-icons">
            <div className="floating-icon fi-1">{Icons.flask}</div>
            <div className="floating-icon fi-2">{Icons.microscope}</div>
            <div className="floating-icon fi-3">{Icons.heartPulse}</div>
            <div className="floating-icon fi-4">{Icons.shield}</div>
          </div>

          <div className="login-brand-content">
            <div className="login-brand-logo">
              <div
                className={`login-brand-logo-icon ${brandLogoUrl ? "has-image" : ""}`}
                role={brandLogoUrl ? "img" : undefined}
                aria-label={brandLogoUrl ? brandLogoLabel : undefined}
                style={brandLogoStyle}
              >
                {!brandLogoUrl && Icons.logo}
              </div>
            </div>
            <h1 className="login-brand-title">{labName}</h1>
            <p className="login-brand-subtitle">
              {isTenantLogin ? "Secure Lab Workspace" : "Developer CMS Access"}
            </p>

            {loginFeatures.length > 0 && (
              <>
                <div className="login-brand-divider" />

                <div className="login-brand-features">
                  {loginFeatures.map((feature) => (
                    <div className="login-feature" key={feature}>
                      <div className="login-feature-dot" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="login-brand-footer">
              <span className="login-brand-badge">
                {isTenantLogin ? "Lab Portal" : "CMS Portal"}
              </span>
              <span className="login-brand-version">v0.1.0</span>
            </div>
          </div>
        </div>

        {/* Right Panel — Login Form */}
        <div className="login-form-panel">
          <div className="login-form-wrapper">
            {/* Mobile Logo */}
            <div className="login-mobile-logo">
              <div
                className={`login-brand-logo-icon small ${brandLogoUrl ? "has-image" : ""}`}
                role={brandLogoUrl ? "img" : undefined}
                aria-label={brandLogoUrl ? brandLogoLabel : undefined}
                style={brandLogoStyle}
              >
                {!brandLogoUrl && Icons.logo}
              </div>
              <span>{labName}</span>
            </div>

            <div className="login-form-header">
              <h2>Welcome back</h2>
              <p>Sign in to your account to continue</p>
            </div>

            {/* Error Alert */}
            {error && (
              <div className="login-error">
                {Icons.alertCircle}
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="login-form">
              {!lockUserType && (
                <div className="login-field">
                <span className="login-label">Access Type</span>
                <div className="login-access-switch" role="tablist" aria-label="Access type">
                  <button
                    type="button"
                    className={`login-access-option ${userType === "tenant" ? "active" : ""}`}
                    onClick={() => setUserType("tenant")}
                    role="tab"
                    aria-selected={userType === "tenant"}
                  >
                    Lab User
                  </button>
                  <button
                    type="button"
                    className={`login-access-option ${userType === "developer" ? "active" : ""}`}
                    onClick={() => setUserType("developer")}
                    role="tab"
                    aria-selected={userType === "developer"}
                  >
                    Developer Access
                  </button>
                </div>
              </div>
              )}

              {isTenantLogin && !lockUserType && (
                <div className="login-field">
                  <label className="login-label" htmlFor="login-tenant">
                    Lab Tenant ID
                  </label>
                  <div className="login-input-wrapper">
                    <span className="login-input-icon">{Icons.shield}</span>
                    <input
                      id="login-tenant"
                      type="text"
                      className="login-input"
                      placeholder="uthiram-main"
                      value={tenantId}
                      onChange={(e) => setTenantId(e.target.value)}
                      autoComplete="organization"
                    />
                  </div>
                </div>
              )}

              {isTenantLogin && lockUserType && (
                <input type="hidden" name="tenantId" value={tenantId} readOnly />
              )}

              {/* Email Field */}
              <div className="login-field">
                <label className="login-label" htmlFor="login-email">
                  Email Address
                </label>
                <div className="login-input-wrapper">
                  <span className="login-input-icon">{Icons.user}</span>
                  <input
                    id="login-email"
                    type="email"
                    className="login-input"
                    placeholder="you@uthiram.lab"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="login-field">
                <label className="login-label" htmlFor="login-password">
                  Password
                </label>
                <div className="login-input-wrapper">
                  <span className="login-input-icon">{Icons.lock}</span>
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    className="login-input"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    className="login-toggle-pw"
                    onClick={() => setShowPassword((p) => !p)}
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? Icons.eyeOff : Icons.eye}
                  </button>
                </div>
              </div>

              {/* Remember + Forgot */}
              <div className="login-options">
                <label className="login-remember">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={() => setRememberMe((p) => !p)}
                  />
                  <span className="login-checkbox-custom" />
                  Remember me
                </label>
                <button type="button" className="login-forgot">
                  Forgot password?
                </button>
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="login-submit"
                disabled={loading}
                id="login-submit-btn"
              >
                {loading ? (
                  <>
                    <div className="login-spinner" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign In
                    {Icons.arrowRight}
                  </>
                )}
              </button>
            </form>

            {/* Footer */}
            <div className="login-form-footer">
              <p>
                Don&apos;t have an account?{" "}
                <button type="button" className="login-link">Contact Admin</button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
