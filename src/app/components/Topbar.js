"use client";
import { Icons } from "@/app/components/Icons";

export default function Topbar({ onToggleSidebar, user }) {
  return (
    <header className="dash-topbar">
      <button
        className="dash-sidebar-toggle"
        onClick={onToggleSidebar}
        aria-label="Toggle sidebar"
      >
        {Icons.menu}
      </button>

      <div className="dash-topbar-search">
        <span className="dash-search-icon">{Icons.search}</span>
        <input
          type="text"
          placeholder="Search records"
          className="dash-search-input"
          id="dashboard-search"
        />
      </div>

      <div className="dash-topbar-actions">
        <button className="dash-topbar-btn" id="notification-btn" aria-label="Notifications">
          {Icons.bell}
          <span className="dash-notif-dot" />
        </button>
        <div className="dash-topbar-avatar">
          <span>{user?.email?.[0].toUpperCase() || "A"}</span>
        </div>
      </div>
    </header>
  );
}
