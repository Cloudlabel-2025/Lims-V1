"use client";

import { useCallback, useEffect, useState } from "react";
import { Icons } from "@/app/components/Icons";
import SuccessDialog from "@/app/components/SuccessDialog";

export default function DeveloperProfilePage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        const data = await res.json();
        if (!cancelled) {
          if (res.ok && data.user?.userType === "developer") {
            setUser(data.user);
          } else {
            setError("Unauthorized access");
          }
        }
      } catch {
        if (!cancelled) setError("Failed to load profile");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadProfile();
    return () => { cancelled = true; };
  }, []);

  async function handleChangePassword(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("All password fields are required");
      return;
    }
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Password and confirm password must match");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Unable to change password");
        return;
      }
      setSuccess("Password changed successfully. Please log in again.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setError("Unable to change password");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="developer-page"><p className="developer-empty">Loading profile...</p></div>;

  const displayName = user?.name || user?.email?.split("@")[0] || "Developer";

  return (
    <section className="developer-page">
      <div className="developer-page-actions">
        <div>
          <p className="developer-kicker">Account</p>
          <h2>Profile</h2>
          <span>Your developer platform access and account details.</span>
        </div>
      </div>

      {error && <div className="developer-alert">{error}</div>}
      <SuccessDialog message={success} onClose={() => setSuccess("")} />

      <div className="developer-two-column">
        <section className="developer-panel">
          <div className="developer-panel-header">
            <h2>User Details</h2>
            <p>Basic identity for developer platform access.</p>
          </div>
          <dl style={{ display: "grid", gap: 16, fontSize: 14 }}>
            <div>
              <dt style={{ fontWeight: 600, color: "var(--text-muted)", fontSize: 12, textTransform: "uppercase" }}>Name</dt>
              <dd style={{ margin: "4px 0 0" }}>{displayName}</dd>
            </div>
            <div>
              <dt style={{ fontWeight: 600, color: "var(--text-muted)", fontSize: 12, textTransform: "uppercase" }}>Email</dt>
              <dd style={{ margin: "4px 0 0" }}>{user?.email || "-"}</dd>
            </div>
            <div>
              <dt style={{ fontWeight: 600, color: "var(--text-muted)", fontSize: 12, textTransform: "uppercase" }}>User ID</dt>
              <dd style={{ margin: "4px 0 0" }}>{user?.userCode || user?.id || "-"}</dd>
            </div>
            <div>
              <dt style={{ fontWeight: 600, color: "var(--text-muted)", fontSize: 12, textTransform: "uppercase" }}>Access Type</dt>
              <dd style={{ margin: "4px 0 0" }}>Developer Access</dd>
            </div>
          </dl>
        </section>

        <section className="developer-panel">
          <div className="developer-panel-header">
            <h2>Change Password</h2>
            <p>Update your developer account password.</p>
          </div>

          <form onSubmit={handleChangePassword} style={{ display: "grid", gap: 16 }}>
            <label style={{ display: "grid", gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Current Password</span>
              <div style={{ position: "relative" }}>
                <input
                  type={showCurrent ? "text" : "password"}
                  className="lims-input"
                  style={{ width: "100%", paddingRight: 40 }}
                  placeholder="Enter current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent((v) => !v)}
                  style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 4 }}
                  aria-label={showCurrent ? "Hide password" : "Show password"}
                >
                  {showCurrent ? Icons.eyeOff : Icons.eye}
                </button>
              </div>
            </label>

            <label style={{ display: "grid", gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>New Password</span>
              <div style={{ position: "relative" }}>
                <input
                  type={showNew ? "text" : "password"}
                  className="lims-input"
                  style={{ width: "100%", paddingRight: 40 }}
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 4 }}
                  aria-label={showNew ? "Hide password" : "Show password"}
                >
                  {showNew ? Icons.eyeOff : Icons.eye}
                </button>
              </div>
            </label>

            <label style={{ display: "grid", gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Confirm New Password</span>
              <div style={{ position: "relative" }}>
                <input
                  type={showConfirm ? "text" : "password"}
                  className="lims-input"
                  style={{ width: "100%", paddingRight: 40 }}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 4 }}
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                >
                  {showConfirm ? Icons.eyeOff : Icons.eye}
                </button>
              </div>
            </label>

            <button type="submit" className="developer-primary-link" disabled={saving} style={{ justifyContent: "center", marginTop: 4 }}>
              {saving ? "Updating..." : "Update Password"}
            </button>
          </form>
        </section>
      </div>
    </section>
  );
}
