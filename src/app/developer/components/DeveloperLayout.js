"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Icons } from "@/app/components/Icons";
import { applyCmsTheme } from "@/app/components/ThemeProvider";

const sections = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", href: "/developer/dashboard", icon: Icons.home },
    ],
  },
  {
    label: "Lab Management",
    items: [
      { label: "Create Lab", href: "/developer/labs/create", icon: Icons.plus },
      { label: "Lab List", href: "/developer/labs", icon: Icons.list },
    ],
  },
  {
    label: "Platform Control",
    items: [
      { label: "Module Management", href: "/developer/modules", icon: Icons.grid },
      { label: "Default Lab Setup", href: "/developer/defaults", icon: Icons.flask },
    ],
  },
  {
    label: "System",
    items: [
      { label: "System Configuration", href: "/developer/system", icon: Icons.settings },
    ],
  },
];

function getPageTitle(pathname) {
  const item = sections.flatMap((section) => section.items).find((entry) => entry.href === pathname);
  return item?.label || "Developer Panel";
}

export default function DeveloperLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const pageTitle = useMemo(() => getPageTitle(pathname), [pathname]);

  useEffect(() => {
    applyCmsTheme();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadDeveloperSession() {
      try {
        const response = await fetch("/api/auth/me", { credentials: "include" });
        const data = await response.json();

        if (!response.ok || data.user?.userType !== "developer") {
          router.replace("/");
          return;
        }

        if (!cancelled) setUser(data.user);
      } catch {
        if (!cancelled) router.replace("/");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadDeveloperSession();

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.replace("/");
  }

  if (loading) return <main className="developer-page">Loading developer access...</main>;

  return (
    <div className="developer-shell">
      <div
        className={`developer-sidebar-backdrop ${sidebarOpen ? "open" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />
      <aside className={`developer-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="developer-sidebar-brand">
          <div className="developer-sidebar-logo">{Icons.logo}</div>
          <div>
            <strong>Developer</strong>
            <span>Control Panel</span>
          </div>
        </div>

        <nav className="developer-sidebar-nav">
          {sections.map((section) => (
            <div className="developer-sidebar-section" key={section.label}>
              <p>{section.label}</p>
              {section.items.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    className={`developer-sidebar-link ${active ? "active" : ""}`}
                    href={item.href}
                    key={item.href}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <span>{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <button type="button" className="developer-sidebar-logout" onClick={handleLogout}>
          {Icons.logout}
          Logout
        </button>
      </aside>

      <div className="developer-main">
        <header className="developer-topbar">
          <button
            type="button"
            className="developer-menu-button"
            onClick={() => setSidebarOpen((current) => !current)}
            aria-label="Toggle developer navigation"
          >
            {Icons.menu}
          </button>
          <div>
            <p className="developer-kicker">Developer Access</p>
            <h1>{pageTitle}</h1>
          </div>
          <div className="developer-user-pill">
            {Icons.shield}
            <span>{user?.email}</span>
          </div>
        </header>

        <main className="developer-content">{children}</main>
      </div>
    </div>
  );
}
