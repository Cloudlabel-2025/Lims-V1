"use client";
import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { canAccessPath, getFirstAllowedHref } from "@/app/lib/client-rbac";

function isCurrentTenantHost(tenantId) {
  if (typeof window === "undefined" || !tenantId) return false;

  const hostname = window.location.hostname.toLowerCase();
  return hostname === `${tenantId}.localhost` || hostname.startsWith(`${tenantId}.`);
}

function buildTenantQueryPath(pathname, tenantId) {
  if (typeof window === "undefined" || !tenantId || isCurrentTenantHost(tenantId)) {
    return pathname;
  }

  const params = new URLSearchParams(window.location.search);
  params.set("tenantId", tenantId);
  return `${pathname}?${params.toString()}`;
}

function buildTenantLoginFallback() {
  if (typeof window === "undefined") return "/";

  const params = new URLSearchParams(window.location.search);
  const tenantId = params.get("tenantId");
  if (!tenantId) return "/";

  params.set("access", "lab");
  return `/?${params.toString()}`;
}

export default function MainLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        const response = await fetch("/api/auth/me", { credentials: "include" });
        const data = await response.json();

        if (!cancelled) {
          if (response.ok) {
            setUser(data.user);
            const themeResponse = await fetch("/api/theme", { credentials: "include" });
            if (themeResponse.ok) {
              const themeData = await themeResponse.json();
              if (!cancelled) setTheme(themeData.theme);
            }
          } else {
            router.replace(buildTenantLoginFallback());
          }
        }
      } catch {
        if (!cancelled) router.replace(buildTenantLoginFallback());
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSession();

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (loading || !user || !theme) return;

    if (user.userType === "tenant" && user.tenantId && !isCurrentTenantHost(user.tenantId)) {
      const params = new URLSearchParams(window.location.search);
      if (params.get("tenantId") !== user.tenantId) {
        router.replace(buildTenantQueryPath(pathname, user.tenantId));
        return;
      }
    }

    if (canAccessPath(user, theme, pathname)) return;

    const firstAllowedHref = getFirstAllowedHref(user, theme);
    if (firstAllowedHref && pathname === "/dashboard") {
      router.replace(buildTenantQueryPath(firstAllowedHref, user.tenantId));
    }
  }, [loading, pathname, router, theme, user]);

  const handleLogout = async () => {
    const response = await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    const data = await response.json().catch(() => ({}));
    router.push(data.redirectUrl || buildTenantLoginFallback());
    router.refresh();
  };

  if (loading) return <div style={{ minHeight: "100vh", background: "#f1f5f9" }} />;

  const hasPageAccess = canAccessPath(user, theme, pathname);

  return (
    <div className="dash-layout">
      <Sidebar 
        collapsed={collapsed} 
        onLogout={handleLogout} 
        theme={theme}
        user={user}
      />
      <div className="dash-main">
        <Topbar 
          onToggleSidebar={() => setCollapsed(!collapsed)} 
          user={user}
        />
        <div className="dash-content">
          {hasPageAccess ? (
            children
          ) : (
            <section className="dash-card">
              <div className="dash-card-header">
                <h3>Access denied</h3>
              </div>
              <p>Your role does not have permission to view this page.</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
