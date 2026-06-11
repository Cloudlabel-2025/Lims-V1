"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icons } from "@/app/components/Icons";
import { getAllowedNavItems, hasAnyPermission } from "@/app/lib/client-rbac";

export default function Sidebar({ collapsed, mobileOpen, setMobileOpen, onLogout, theme, user }) {
  const pathname = usePathname();
  const labName = theme?.labName || "Uthiram LIMS";
  const [title, subtitle = "LIMS"] = labName.split(/\s+/, 2);

  const iconByModule = {
    dashboard: Icons.home,
    doctors: Icons.stethoscope,
    patients: Icons.person,
    tests: Icons.flask,
    billing: Icons.list,
    samples: Icons.vial,
    reports: Icons.report,
    analytics: Icons.barChart,
    accounts: Icons.wallet,
    inventory: Icons.flask,
    quality: Icons.shield,
  };
  const navItems = getAllowedNavItems(user, theme)
    .map((module) => ({ ...module, icon: iconByModule[module.id] || Icons.settings }));
  const canOpenSettings = hasAnyPermission(user, ["settings.manage", "users.manage"]);
  const canViewAudit = hasAnyPermission(user, ["settings.manage"]);

  const isActive = (href) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  return (
    <>
      {mobileOpen && (
        <div 
          className="sidebar-overlay open" 
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside className={`dash-sidebar ${collapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}>
      {/* Logo */}
      <div className="dash-sidebar-logo">
        <div className="dash-logo-icon">{Icons.logo}</div>
        {!collapsed && (
          <div className="dash-logo-text">
            <span className="dash-logo-title">{title}</span>
            <span className="dash-logo-sub">{subtitle}</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="dash-nav">
        <div className="dash-nav-section-label">{!collapsed && "Main Menu"}</div>
        {navItems.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className={`dash-nav-item ${isActive(item.href) ? "active" : ""}`}
            onClick={() => setMobileOpen && setMobileOpen(false)}
          >
            <span className="dash-nav-icon">{item.icon}</span>
            {!collapsed && <span className="dash-nav-label">{item.label}</span>}
            {isActive(item.href) && <div className="dash-nav-indicator" />}
          </Link>
        ))}

        {canOpenSettings && (
          <>
            <div className="dash-nav-section-label" style={{ marginTop: 20 }}>
              {!collapsed && "Settings"}
            </div>
            <Link
              href="/settings"
              className={`dash-nav-item ${pathname === "/settings" ? "active" : ""}`}
              onClick={() => setMobileOpen && setMobileOpen(false)}
            >
              <span className="dash-nav-icon">{Icons.settings}</span>
              {!collapsed && <span className="dash-nav-label">Settings</span>}
              {pathname === "/settings" && <div className="dash-nav-indicator" />}
            </Link>
            {hasAnyPermission(user, ["users.manage"]) && (
              <Link
                href="/users"
                className={`dash-nav-item ${pathname === "/users" ? "active" : ""}`}
                onClick={() => setMobileOpen && setMobileOpen(false)}
              >
                <span className="dash-nav-icon">{Icons.person}</span>
                {!collapsed && <span className="dash-nav-label">User Assignment</span>}
                {pathname === "/users" && <div className="dash-nav-indicator" />}
              </Link>
            )}
            {canViewAudit && (
              <Link
                href="/audit"
                className={`dash-nav-item ${pathname === "/audit" ? "active" : ""}`}
                onClick={() => setMobileOpen && setMobileOpen(false)}
              >
                <span className="dash-nav-icon">{Icons.list}</span>
                {!collapsed && <span className="dash-nav-label">Audit Log</span>}
                {pathname === "/audit" && <div className="dash-nav-indicator" />}
              </Link>
            )}
          </>
        )}
      </nav>

      {/* Bottom */}
      <div className="dash-sidebar-bottom">
        <button className="dash-nav-item logout" onClick={onLogout}>
          <span className="dash-nav-icon">{Icons.logout}</span>
          {!collapsed && <span className="dash-nav-label">Logout</span>}
        </button>
      </div>
    </aside>
    </>
  );
}
