"use client";
import { useState, useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { canAccessPath, getFirstAllowedHref } from "@/app/lib/client-rbac";
import { applyTheme } from "@/app/components/ThemeProvider";
import { TenantShellProvider } from "@/app/lib/use-current-user";

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

const shellCache = {
  key: "",
  value: null,
  expiresAt: 0,
  promise: null,
};

function getShellCacheKey() {
  if (typeof window === "undefined") return "";
  return window.location.origin;
}

export function clearShellCache() {
  shellCache.value = null;
  shellCache.expiresAt = 0;
  shellCache.promise = null;
}

if (typeof window !== "undefined") {
  window.__clearShellCache = clearShellCache;
}

async function loadTenantShellData() {
  const cacheKey = getShellCacheKey();
  const now = Date.now();

  if (shellCache.key === cacheKey && shellCache.value && shellCache.expiresAt > now) {
    if (typeof window !== "undefined" && window.__shellInvalidateAt && shellCache.value._loadedAt < window.__shellInvalidateAt) {
      clearShellCache();
    } else {
      return shellCache.value;
    }
  }

  if (shellCache.key === cacheKey && shellCache.promise) {
    return shellCache.promise;
  }

  shellCache.key = cacheKey;
  shellCache.promise = (async () => {
    const response = await fetch("/api/auth/me", { credentials: "include" });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Not authenticated");
    }

    const themeResponse = await fetch("/api/theme", { credentials: "include" });
    const themeData = await themeResponse.json();

    const value = {
      user: data.user,
      theme: themeResponse.ok ? themeData.theme : null,
      _loadedAt: Date.now(),
    };

    shellCache.value = value;
    shellCache.expiresAt = Date.now() + 15_000;
    return value;
  })().finally(() => {
    shellCache.promise = null;
  });

  return shellCache.promise;
}

export default function MainLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        const data = await loadTenantShellData();
        if (!cancelled) {
          setUser(data.user);
          setTheme(data.theme);
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
    applyTheme(theme);

    if (user.userType === "tenant" && user.tenantId && !isCurrentTenantHost(user.tenantId)) {
      const params = new URLSearchParams(window.location.search);
      if (params.get("tenantId") !== user.tenantId) {
        router.replace(buildTenantQueryPath(pathname, user.tenantId));
        return;
      }
    }

    if (user.doctorId && pathname === "/dashboard") {
      router.replace(buildTenantQueryPath("/doctor/dashboard", user.tenantId));
      return;
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
    shellCache.value = null;
    shellCache.expiresAt = 0;
    shellCache.promise = null;
    router.replace(data.redirectUrl || buildTenantLoginFallback());
  };

  const shellContext = useMemo(
    () => ({
      user,
      theme,
      tenantId: user?.tenantId || theme?.tenantId || null,
      setTheme,
    }),
    [theme, user]
  );
  if (loading) return <div style={{ minHeight: "100vh", background: "#f1f5f9" }} />;

  const hasPageAccess = canAccessPath(user, theme, pathname);

  return (
    <TenantShellProvider value={shellContext}>
      <div className="dash-layout">
        <Sidebar
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          setMobileOpen={setMobileOpen}
          onLogout={handleLogout}
          theme={theme}
          user={user}
        />
        <div className="dash-main">
          <Topbar
            onToggleSidebar={() => {
              if (window.innerWidth <= 768) {
                setMobileOpen(!mobileOpen);
              } else {
                setCollapsed(!collapsed);
              }
            }}
            user={user}
            theme={theme}
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
    </TenantShellProvider>
  );
}
