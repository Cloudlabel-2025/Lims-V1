"use client";

import { useState } from "react";
import { Icons } from "@/app/components/Icons";
import { useTenantShell } from "@/app/lib/use-current-user";
import SuccessDialog from "@/app/components/SuccessDialog";

function getInitial(user) {
  const value = user?.name || user?.email || "A";
  return value.trim()[0]?.toUpperCase() || "A";
}

function formatPermissionCount(permissions) {
  if (!Array.isArray(permissions) || permissions.length === 0) return "No permissions assigned";
  if (permissions.includes("*")) return "Full access";
  return `${permissions.length} permission${permissions.length === 1 ? "" : "s"}`;
}

export default function ProfilePage() {
  const { theme, user } = useTenantShell();
  const displayName = user?.name || user?.email?.split("@")[0] || "Lab User";
  const tenantName = theme?.labName || "Tenant Lab";

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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

    setLoading(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = await response.json();

      if (!response.ok) {
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
      setLoading(false);
    }
  }

  return (
    <section className="settings-page profile-page">
      <div className="settings-header">
        <div>
          <p className="developer-kicker">Account</p>
          <h2>Profile</h2>
          <span>Your login details and tenant access information.</span>
        </div>
      </div>

      <section className="profile-hero settings-panel">
        <div className="profile-avatar" aria-hidden="true">
          {getInitial(user)}
        </div>
        <div>
          <h3>{displayName}</h3>
          <p>{user?.email || "No email available"}</p>
        </div>
      </section>

      <div className="profile-grid">
        <section className="settings-panel profile-detail-panel">
          <div className="settings-panel-header">
            <h2>User Details</h2>
            <p>Basic login identity for this lab workspace.</p>
          </div>
          <dl className="profile-detail-list">
            <div>
              <dt>User ID</dt>
              <dd>{user?.userCode || user?.id || "-"}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{user?.email || "-"}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>{user?.roleName || "No active role"}</dd>
            </div>
          </dl>
        </section>

        <section className="settings-panel profile-detail-panel">
          <div className="settings-panel-header">
            <h2>Tenant Access</h2>
            <p>Current lab and permission summary.</p>
          </div>
          <dl className="profile-detail-list">
            <div>
              <dt>Lab</dt>
              <dd>{tenantName}</dd>
            </div>
            <div>
              <dt>Tenant ID</dt>
              <dd>{user?.tenantId || theme?.tenantId || "-"}</dd>
            </div>
            <div>
              <dt>Access</dt>
              <dd>{formatPermissionCount(user?.permissions)}</dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="settings-panel profile-permissions-panel">
        <div className="settings-panel-header">
          <h2>Permissions</h2>
          <p>Access keys currently available through your assigned role.</p>
        </div>
        <div className="profile-permission-list">
          {user?.permissions?.length ? (
            user.permissions.map((permission) => (
              <span key={permission}>
                {Icons.shield}
                {permission}
              </span>
            ))
          ) : (
            <p className="developer-empty">No permissions available for this user.</p>
          )}
        </div>
      </section>

      <section className="settings-panel">
        <div className="settings-panel-header">
          <h2>Change Password</h2>
          <p>Update your account password.</p>
        </div>

        {error && (
          <div className="login-error">
            {Icons.alertCircle} {error}
          </div>
        )}

        <SuccessDialog message={success} onClose={() => setSuccess("")} />

        <form className="login-form" onSubmit={handleChangePassword}>
          <div className="login-field">
            <label className="login-label" htmlFor="change-current-password">Current Password</label>
            <div className="login-input-wrapper">
              <span className="login-input-icon">{Icons.lock}</span>
              <input
                id="change-current-password"
                type={showCurrent ? "text" : "password"}
                className="login-input"
                placeholder="Enter current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="login-toggle-pw"
                onClick={() => setShowCurrent((v) => !v)}
                aria-label={showCurrent ? "Hide password" : "Show password"}
              >
                {showCurrent ? Icons.eyeOff : Icons.eye}
              </button>
            </div>
          </div>

          <div className="login-field">
            <label className="login-label" htmlFor="change-new-password">New Password</label>
            <div className="login-input-wrapper">
              <span className="login-input-icon">{Icons.lock}</span>
              <input
                id="change-new-password"
                type={showNew ? "text" : "password"}
                className="login-input"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                className="login-toggle-pw"
                onClick={() => setShowNew((v) => !v)}
                aria-label={showNew ? "Hide password" : "Show password"}
              >
                {showNew ? Icons.eyeOff : Icons.eye}
              </button>
            </div>
          </div>

          <div className="login-field">
            <label className="login-label" htmlFor="change-confirm-password">Confirm New Password</label>
            <div className="login-input-wrapper">
              <span className="login-input-icon">{Icons.lock}</span>
              <input
                id="change-confirm-password"
                type={showConfirm ? "text" : "password"}
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
                onClick={() => setShowConfirm((v) => !v)}
                aria-label={showConfirm ? "Hide password" : "Show password"}
              >
                {showConfirm ? Icons.eyeOff : Icons.eye}
              </button>
            </div>
          </div>

          <button type="submit" className="login-submit" disabled={loading}>
            {loading ? (
              <><div className="login-spinner" />Updating...</>
            ) : (
              <>Update Password {Icons.arrowRight}</>
            )}
          </button>
        </form>
      </section>
    </section>
  );
}
