"use client";

import { useEffect, useState } from "react";
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
      label: "Total Patients",
      value: stats?.totalPatients || 0,
      permission: "patients.view",
      trend: "up",
      change: "Live",
      icon: Icons.patients,
      color: "#0d9488",
      bg: "linear-gradient(135deg, #f0fdfa, #ccfbf1)",
    },
    {
      label: "Registrations Today",
      value: stats?.todayPatients || 0,
      permission: "patients.view",
      trend: "up",
      change: "Today",
      icon: Icons.flask,
      color: "#7c3aed",
      bg: "linear-gradient(135deg, #f5f3ff, #ede9fe)",
    },
    {
      label: "Consulting Doctors",
      value: stats?.totalDoctors || 0,
      permission: "doctors.view",
      trend: "up",
      change: "Active",
      icon: Icons.stethoscope,
      color: "#2563eb",
      bg: "linear-gradient(135deg, #eff6ff, #dbeafe)",
    },
    {
      label: "Reports Ready",
      value: stats?.reportsReady || 0,
      permission: "reports.view",
      trend: "up",
      change: "Ready",
      icon: Icons.report,
      color: "#ea580c",
      bg: "linear-gradient(135deg, #fff7ed, #ffedd5)",
    },
    {
      label: "Pending Reports",
      value: stats?.pendingReports || 0,
      permission: "reports.view",
      trend: "down",
      change: "Action",
      icon: Icons.clock,
      color: "#f43f5e",
      bg: "linear-gradient(135deg, #fff1f2, #ffe4e6)",
    },
  ];
  const visibleStatCards = statCards.filter((stat) => hasPermission(user, stat.permission));
  const canRegisterPatients = hasPermission(user, "patients.register");
  const canViewPatients = hasPermission(user, "patients.view");
  const canEditTests = hasPermission(user, "tests.edit");

  const recentPatients = stats?.recentPatients || [];
  const activityFeed = recentPatients.map((patient) => ({
    text: `New patient ${patient.name} registered`,
    time: getTimeAgo(patient.createdAt),
    type: "register",
  }));

  if (loading) return <div className="p-5">Loading dashboard data...</div>;

  if (error) {
    return (
      <div className="dash-card">
        <div className="dash-card-header">
          <h3>{Icons.alertCircle} Dashboard unavailable</h3>
        </div>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <>
      <div className="dash-welcome">
        <div className="dash-welcome-text">
          <h1>
            {getGreeting()},{" "}
            <span className="dash-welcome-name">{(user?.email || "Admin").split("@")[0]}</span>
          </h1>
          <p className="dash-welcome-date">
            {Icons.calendar} {today}
          </p>
        </div>
        <div className="dash-welcome-actions">
          {canRegisterPatients && (
            <button className="dash-btn-primary" onClick={() => router.push("/patients/register")}>
              {Icons.plus} Register Patient
            </button>
          )}
          {canEditTests && (
            <button className="dash-btn-secondary" onClick={() => router.push("/tests")}>
              {Icons.flask} New Test
            </button>
          )}
        </div>
      </div>

      <div className="dash-stats-grid">
        {visibleStatCards.map((stat) => (
          <div key={stat.label} className="dash-stat-card">
            <div className="dash-stat-header">
              <div className="dash-stat-icon" style={{ background: stat.bg, color: stat.color }}>
                {stat.icon}
              </div>
              <span className={`dash-stat-change ${stat.trend}`}>
                {stat.trend === "up" ? Icons.trendUp : Icons.trendDown}
                {stat.change}
              </span>
            </div>
            <div className="dash-stat-value">{stat.value}</div>
            <div className="dash-stat-label">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="dash-content-grid">
        {canViewPatients && (
        <div className="dash-card dash-recent-patients">
          <div className="dash-card-header">
            <h3>{Icons.activity} Recent Patients</h3>
            {canViewPatients && (
              <button className="dash-card-action" onClick={() => router.push("/patients")}>
                View All {Icons.chevronRight}
              </button>
            )}
          </div>

          <div className="dash-patient-table">
            <div className="dash-table-header">
              <span className="dash-th" style={{ flex: 2 }}>
                Patient
              </span>
              <span className="dash-th" style={{ flex: 1.2 }}>
                Record ID
              </span>
              <span className="dash-th" style={{ flex: 1 }}>
                Status
              </span>
              <span className="dash-th" style={{ flex: 0.8, textAlign: "right" }}>
                Registered
              </span>
            </div>

            {recentPatients.length === 0 ? (
              <div className="dash-table-row">
                <div className="dash-td" style={{ flex: 1 }}>
                  No patients registered yet.
                </div>
              </div>
            ) : (
              recentPatients.map((patient) => (
                <div key={patient._id || patient.patientId} className="dash-table-row">
                  <div className="dash-td" style={{ flex: 2 }}>
                    <div className="dash-patient-cell">
                      <div className="dash-mini-avatar">{getInitials(patient.name)}</div>
                      <div>
                        <div className="dash-patient-name">{patient.name}</div>
                        <div className="dash-patient-meta">
                          {patient.age} Yrs - {patient.gender}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="dash-td" style={{ flex: 1.2 }}>
                    <span className="dash-test-name">{patient.patientId}</span>
                  </div>
                  <div className="dash-td" style={{ flex: 1 }}>
                    <span className="dash-status-badge" style={{ background: "#ecfdf5", color: "#065f46" }}>
                      <span className="dash-status-dot" style={{ background: "#10b981" }} />
                      Active
                    </span>
                  </div>
                  <div className="dash-td" style={{ flex: 0.8, textAlign: "right" }}>
                    <span className="dash-time">{getTimeAgo(patient.createdAt)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        )}

        <div className="dash-card dash-activity-feed">
          <div className="dash-card-header">
            <h3>{Icons.clock} Activity Feed</h3>
          </div>

          <div className="dash-activity-list">
            {activityFeed.length === 0 ? (
              <div className="dash-activity-item">
                <div className="dash-activity-content">
                  <div className="dash-activity-text">No recent activity yet.</div>
                </div>
              </div>
            ) : (
              activityFeed.map((activity, index) => (
                <div key={`${activity.text}-${activity.time}`} className="dash-activity-item">
                  <div className="dash-activity-icon-wrap">
                    <div className={`dash-activity-dot ${activity.type}`} />
                    {index < activityFeed.length - 1 && <div className="dash-activity-line" />}
                  </div>
                  <div className="dash-activity-content">
                    <div className="dash-activity-text">{activity.text}</div>
                    <div className="dash-activity-time">{activity.time}</div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="dash-quick-stats">
            <div className="dash-quick-title">Quick Summary</div>
            <div className="dash-quick-row">
              <span className="dash-quick-label">Total Doctors</span>
              <span className="dash-quick-value">
                {hasPermission(user, "doctors.view") ? stats?.totalDoctors || 0 : "Hidden"}
              </span>
            </div>
            <div className="dash-quick-row">
              <span className="dash-quick-label">Registrations Today</span>
              <span className="dash-quick-value">
                {canViewPatients ? stats?.todayPatients || 0 : "Hidden"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
