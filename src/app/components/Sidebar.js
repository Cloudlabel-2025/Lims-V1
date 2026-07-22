"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icons } from "@/app/components/Icons";
import { tenantModuleGroups } from "@/app/lib/modules";
import { getAllowedNavItems, hasAnyPermission, hasPermission } from "@/app/lib/client-rbac";

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
  };
  const navItems = user?.doctorId
    ? [{ id: "doctor-portal", label: "Doctor Portal", href: "/doctor/dashboard", icon: Icons.home }]
    : getAllowedNavItems(user, theme)
        .map((module) => ({ ...module, icon: iconByModule[module.id] || Icons.settings }));
  const allowedIds = new Set(navItems.map((item) => item.id));

  const groupsWithItems = (user?.doctorId
    ? [{ id: "doctor", label: "Doctor Portal", items: ["doctor-portal"] }]
    : tenantModuleGroups)
    .map((group) => ({
      ...group,
      items: group.items.filter((id) => allowedIds.has(id)),
    }))
    .filter((group) => group.items.length > 0);

  const canOpenSettings = hasAnyPermission(user, ["settings.manage", "users.manage"]);
  const canViewAudit = hasAnyPermission(user, ["settings.manage"]);
  const adminItems = user?.doctorId ? [] : [
    ...(canOpenSettings ? [{ id: "settings", label: "Settings", href: "/settings", icon: Icons.settings }] : []),
    ...(hasAnyPermission(user, ["users.manage"]) ? [{ id: "users", label: "User Assignment", href: "/users", icon: Icons.person }] : []),
    ...(canViewAudit ? [{ id: "audit", label: "Audit Log", href: "/audit", icon: Icons.list }] : []),
  ];

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
        {groupsWithItems.map((group) => (
          <div key={group.id} className="dash-nav-section">
            <div className="dash-nav-section-label">{!collapsed && group.label}</div>
            {group.items.map((itemId) => {
              const item = navItems.find((i) => i.id === itemId);
              if (!item) return null;
              return (
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
              );
            })}
          </div>
        ))}

        {adminItems.length > 0 && (
          <div className="dash-nav-section">
            <div className="dash-nav-section-label">{!collapsed && "Administration"}</div>
            {adminItems.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className={`dash-nav-item ${pathname === item.href ? "active" : ""}`}
                onClick={() => setMobileOpen && setMobileOpen(false)}
              >
                <span className="dash-nav-icon">{item.icon}</span>
                {!collapsed && <span className="dash-nav-label">{item.label}</span>}
                {pathname === item.href && <div className="dash-nav-indicator" />}
              </Link>
            ))}
          </div>
        )}
      </nav>

      {/* Bottom */}
      <div className="dash-sidebar-bottom">
        {user?.doctorId && hasPermission(user, "doctors.view") && (
          <Link
            href="/doctor/profile"
            className={`dash-nav-item ${pathname === "/doctor/profile" ? "active" : ""}`}
            onClick={() => setMobileOpen && setMobileOpen(false)}
          >
            <span className="dash-nav-icon">{Icons.stethoscope}</span>
            {!collapsed && <span className="dash-nav-label">My Profile</span>}
            {pathname === "/doctor/profile" && <div className="dash-nav-indicator" />}
          </Link>
        )}
        <button className="dash-nav-item logout" onClick={onLogout}>
          <span className="dash-nav-icon">{Icons.logout}</span>
          {!collapsed && <span className="dash-nav-label">Logout</span>}
        </button>
      </div>
    </aside>
    </>
  );
}
