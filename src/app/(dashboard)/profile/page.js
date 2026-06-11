"use client";

import { Icons } from "@/app/components/Icons";
import { useTenantShell } from "@/app/lib/use-current-user";

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
    </section>
  );
}
