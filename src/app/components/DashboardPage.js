"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icons } from "@/app/components/Icons";
import { cachedJsonFetch, useTenantShell } from "@/app/lib/use-current-user";
import { hasPermission } from "@/app/lib/client-rbac";

const getInitials = (name) => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + (parts[1][0] || "")).toUpperCase()
    : parts[0][0].toUpperCase();
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
};

const getTimeAgo = (date) => {
  if (!date) return "Recently";

  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  if (!Number.isFinite(seconds) || seconds < 0) return "Recently";
  if (seconds < 60) return "Just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours > 1 ? "s" : ""} ago`;

  return new Date(date).toLocaleDateString("en-IN");
};

async function loadDashboardStats() {
  const { response, data } = await cachedJsonFetch("/api/dashboard/stats", { ttl: 15_000 });
  if (!response.ok) throw new Error(data.error || "Unable to load dashboard stats");
  return data;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useTenantShell();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function fetchDashboardData() {
      try {
        const statsData = await loadDashboardStats();
        if (!cancelled) setStats(statsData);
      } catch (err) {
        if (!cancelled) setError(err.message || "Unable to load dashboard");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchDashboardData();

    return () => {
      cancelled = true;
    };
  }, []);

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const statCards = [
    {
      label: "Samples Today",
      value: stats?.samplesToday || 0,
      permission: "samples.view",
      trend: "up",
      change: "Today",
      detail: "Collected since midnight",
      icon: Icons.flask,
      color: "#0d9488",
      bg: "#f0fdfa",
      href: "/samples",
    },
    {
      label: "Pending Samples",
      value: stats?.pendingSamples || 0,
      permission: "samples.view",
      trend: "down",
      change: "Needs attention",
      detail: "Awaiting processing",
      icon: Icons.clock,
      color: "#7c3aed",
      bg: "#f5f3ff",
      href: "/samples",
    },
    {
      label: "Reports Pending",
      value: stats?.pendingReports || 0,
      permission: "reports.view",
      trend: "down",
      change: "Review",
      detail: "Awaiting authorization",
      icon: Icons.report,
      color: "#ea580c",
      bg: "#fff7ed",
      href: "/reports",
    },
    {
      label: "Patients Today",
      value: stats?.todayPatients || 0,
      permission: "patients.view",
      trend: "up",
      change: "New",
      detail: "Registered since midnight",
      icon: Icons.users,
      color: "#f43f5e",
      bg: "#fff1f2",
      href: "/patients",
    },
  ];
  const visibleStatCards = statCards.filter((stat) => hasPermission(user, stat.permission));
  const canRegisterPatients = hasPermission(user, "patients.register");
  const canViewPatients = hasPermission(user, "patients.view");
  const adminName = [user?.firstName, user?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim() || user?.name?.trim() || (user?.email || "Admin").split("@")[0];

  const recentPatients = stats?.recentPatients || [];
  const activityFeed = recentPatients.map((patient) => ({
    text: `New patient ${patient.name} registered`,
    time: getTimeAgo(patient.createdAt),
    type: "register",
  }));

  if (loading) {
    return (
      <div className="tenant-dashboard dashboard-loading" aria-label="Loading dashboard data">
        <div className="dashboard-loading-header lims-skeleton" />
        <div className="dashboard-loading-grid">
          {[0, 1, 2, 3].map((item) => <div key={item} className="lims-skeleton" />)}
        </div>
        <div className="dashboard-loading-body lims-skeleton" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="dash-card dashboard-error-state">
        <div className="dash-card-header">
          <h3>{Icons.alertCircle} Dashboard unavailable</h3>
        </div>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="tenant-dashboard">
      <header className="dashboard-page-header">
        <div className="dashboard-heading">
          <span className="dashboard-eyebrow">Laboratory overview</span>
          <h1>
            {getGreeting()},{" "}
            <span>{adminName}</span>
          </h1>
          <p>Review today&apos;s workload, pending actions and latest registrations.</p>
          <span className="dashboard-current-date">{Icons.calendar} {today}</span>
        </div>
        {canRegisterPatients && (
          <button className="dash-btn-primary dashboard-register-button" onClick={() => router.push("/patients/register")}>
            {Icons.plus} Register Patient
          </button>
        )}
      </header>

      <section className="dashboard-kpi-section" aria-label="Today's operational summary">
        <div className="dashboard-section-heading">
          <div>
            <span>Today&apos;s operations</span>
            <h2>Workload summary</h2>
          </div>
          <small>Live tenant activity</small>
        </div>
        <div className="dashboard-kpi-grid">
          {visibleStatCards.map((stat) => (
            <Link key={stat.label} href={stat.href} className="dashboard-kpi-card">
              <div className="dashboard-kpi-topline">
                <span className="dashboard-kpi-icon" style={{ background: stat.bg, color: stat.color }}>
                  {stat.icon}
                </span>
                <span className={`dashboard-kpi-status ${stat.trend}`}>{stat.change}</span>
              </div>
              <strong className="dashboard-kpi-value">{stat.value}</strong>
              <span className="dashboard-kpi-label">{stat.label}</span>
              <small>{stat.detail}</small>
            </Link>
          ))}
        </div>
      </section>
      {/* 👨‍⚕️ Doctor Referred Patients Widget */}
      {stats?.pendingDoctorRequests && stats.pendingDoctorRequests.length > 0 && (
        <section className="dashboard-panel" style={{ marginBottom: "24px", border: "1px solid #99f6e4", background: "#f0fdf4" }}>
          <div className="dashboard-panel-header" style={{ borderBottom: "1px solid #ccfbf1" }}>
            <div>
              <span className="dashboard-panel-icon" style={{ background: "#ccfbf1", color: "#0d9488" }}>👨‍⚕️</span>
              <div>
                <h2 style={{ color: "#0f766e" }}>Doctor Referred Patients ({stats.pendingDoctorRequests.length})</h2>
                <p style={{ color: "#115e59" }}>Incoming doctor test requests waiting for lab billing & processing.</p>
              </div>
            </div>
            <button className="dashboard-text-action" onClick={() => router.push("/billing")} style={{ color: "#0d9488" }}>
              View all orders {Icons.chevronRight}
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 340px), 1fr))", gap: "16px", padding: "16px" }}>
            {stats.pendingDoctorRequests.map((req) => (
              <div
                key={req._id}
                style={{
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: "12px",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  justify: "space-between",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.03)",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                    <div>
                      <strong style={{ fontSize: "15px", color: "#0f172a" }}>{req.patient?.name || "Patient"}</strong>
                      <div style={{ fontSize: "12px", color: "#64748b" }}>{req.patient?.age} Yrs · {req.patient?.gender} · <code>{req.patient?.patientId}</code></div>
                    </div>
                    <span style={{ fontSize: "11px", fontWeight: "600", color: "#0d9488", background: "#ccfbf1", padding: "3px 8px", borderRadius: "12px" }}>
                      Dr. {req.doctor?.name || "Doctor"}
                    </span>
                  </div>

                  <div style={{ fontSize: "12px", color: "#334155", background: "#f8fafc", padding: "8px 12px", borderRadius: "8px", marginBottom: "12px" }}>
                    <strong>Ordered:</strong> {(req.testPackages || []).length} Package(s), {(req.tests || []).length} Test(s)
                  </div>
                </div>

                <button
                  className="btn-lims-primary"
                  style={{ width: "100%", fontSize: "12px", height: "34px", justifyContent: "center" }}
                  onClick={() => router.push(`/billing?patientId=${req.patient?._id || ""}`)}
                >
                  ⚡ Create Bill & Process
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 🔔 Notifications Center Widget */}
      {stats?.notifications && stats.notifications.length > 0 && (
        <section className="dashboard-panel" style={{ marginBottom: "24px" }}>
          <div className="dashboard-panel-header">
            <div>
              <span className="dashboard-panel-icon" style={{ background: "#fef3c7", color: "#d97706" }}>🔔</span>
              <div>
                <h2>System Notifications</h2>
                <p>Actionable alerts and operational notifications.</p>
              </div>
            </div>
            {stats.unreadNotificationsCount > 0 && (
              <span className="dashboard-count-badge" style={{ background: "#ef4444", color: "#fff" }}>
                {stats.unreadNotificationsCount} unread
              </span>
            )}
          </div>

          <div style={{ display: "grid", gap: "10px", padding: "16px" }}>
            {stats.notifications.slice(0, 5).map((notif) => (
              <div
                key={notif.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  borderRadius: "10px",
                  background: notif.unread ? "#fffbeb" : "#f8fafc",
                  border: notif.unread ? "1px solid #fde68a" : "1px solid #e2e8f0",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ fontSize: "14px", fontWeight: "700", color: notif.priority === "critical" ? "#dc2626" : "#d97706" }}>
                    {notif.priority === "critical" ? "🚨" : "⚠️"}
                  </span>
                  <div>
                    <strong style={{ fontSize: "13px", color: "#1e293b", display: "block" }}>{notif.title}</strong>
                    <span style={{ fontSize: "12px", color: "#64748b" }}>{notif.detail}</span>
                  </div>
                </div>
                {notif.href && (
                  <button
                    className="dash-btn-secondary"
                    onClick={() => router.push(notif.href)}
                    style={{ fontSize: "12px", height: "30px", padding: "0 12px", whiteSpace: "nowrap" }}
                  >
                    View
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="dashboard-workspace-grid">
        {canViewPatients && (
          <section className="dashboard-panel dashboard-patients-panel">
            <div className="dashboard-panel-header">
              <div>
                <span className="dashboard-panel-icon">{Icons.activity}</span>
                <div>
                  <h2>Recent patients</h2>
                  <p>Latest patient records created by your team.</p>
                </div>
              </div>
              <button className="dashboard-text-action" onClick={() => router.push("/patients")}>
                View all {Icons.chevronRight}
              </button>
            </div>

            <div className="dashboard-patient-table">
              <div className="dashboard-table-header">
                <span style={{ flex: 2 }}>Patient</span>
                <span style={{ flex: 1.2 }}>Record ID</span>
                <span style={{ flex: 1 }}>Status</span>
                <span style={{ flex: 0.8, textAlign: "right" }}>Registered</span>
              </div>

              {recentPatients.length === 0 ? (
                <div className="dashboard-empty-state">
                  <span>{Icons.users}</span>
                  <strong>No patients registered yet</strong>
                  <p>New registrations will appear here.</p>
                </div>
              ) : (
                recentPatients.map((patient) => (
                  <div
                    key={patient._id || patient.patientId}
                    className="dashboard-patient-row"
                    onClick={() => {
                      const id = patient._id || patient.patientId;
                      if (id) router.push(`/patients/${id}/visits`);
                    }}
                  >
                    <div style={{ flex: 2 }}>
                      <div className="dash-patient-cell">
                        <div className="dash-mini-avatar">{getInitials(patient.name)}</div>
                        <div>
                          <div className="dash-patient-name">{patient.name}</div>
                          <div className="dash-patient-meta">{patient.age} Yrs · {patient.gender}</div>
                        </div>
                      </div>
                    </div>
                    <div className="dashboard-record-id" style={{ flex: 1.2 }}>{patient.patientId}</div>
                    <div style={{ flex: 1 }}>
                      <span className="dash-status-badge">
                        <span className="dash-status-dot" /> Active
                      </span>
                    </div>
                    <div style={{ flex: 0.8, textAlign: "right" }}>
                      <span className="dash-time">{getTimeAgo(patient.createdAt)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        <aside className="dashboard-panel dashboard-activity-panel">
          <div className="dashboard-panel-header">
            <div>
              <span className="dashboard-panel-icon">{Icons.clock}</span>
              <div>
                <h2>Activity feed</h2>
                <p>Latest tenant updates.</p>
              </div>
            </div>
            <span className="dashboard-count-badge">{activityFeed.length}</span>
          </div>

          <div className="dashboard-queue-summary">
            <div>
              <span>Pending samples</span>
              <strong>{hasPermission(user, "samples.view") ? stats?.pendingSamples || 0 : "—"}</strong>
            </div>
            <div>
              <span>Reports to review</span>
              <strong>{hasPermission(user, "reports.view") ? stats?.pendingReports || 0 : "—"}</strong>
            </div>
          </div>

          <div className="dashboard-activity-list">
            {activityFeed.length === 0 ? (
              <div className="dashboard-empty-state compact">
                <strong>No recent activity</strong>
                <p>Updates will appear as work is completed.</p>
              </div>
            ) : (
              activityFeed.map((activity, index) => (
                <div key={`${activity.text}-${activity.time}`} className="dashboard-activity-item">
                  <div className="dashboard-activity-marker">
                    <i />
                    {index < activityFeed.length - 1 && <span />}
                  </div>
                  <div>
                    <strong>{activity.text}</strong>
                    <span>{activity.time}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {canViewPatients && (
            <button className="dashboard-panel-footer" onClick={() => router.push("/patients")}>
              Open patient directory {Icons.chevronRight}
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}
