"use client";
import { useState, useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { canAccessPath, getFirstAllowedHref } from "@/app/lib/client-rbac";
import { applyTheme } from "@/app/components/ThemeProvider";
import { TenantShellProvider } from "@/app/lib/use-current-user";
import { availableLabModules, defaultLabModules } from "@/app/lib/modules";

const DISABLED_MODULE_PREVIEW_SECONDS = 12;
const disabledModulePreviewStoragePrefix = "lims.disabled-module-preview.seen";

function isCurrentTenantHost(tenantId) {
  if (typeof window === "undefined" || !tenantId) return false;

  const hostname = window.location.hostname.toLowerCase();
  return hostname === `${tenantId}.localhost` || hostname.startsWith(`${tenantId}.`);
}

function getDisabledModulePreviewKey(tenantId, moduleId) {
  if (!tenantId || !moduleId) return "";
  return `${disabledModulePreviewStoragePrefix}:${tenantId}:${moduleId}`;
}

function hasSeenDisabledModulePreview(storageKey) {
  if (typeof window === "undefined" || !storageKey) return false;

  try {
    return window.localStorage.getItem(storageKey) === "1";
  } catch {
    return false;
  }
}

function markDisabledModulePreviewSeen(storageKey) {
  if (typeof window === "undefined" || !storageKey) return;

  try {
    window.localStorage.setItem(storageKey, "1");
  } catch {
    // If storage is unavailable, keep the in-memory timer behavior for this visit.
  }
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
  const [timeLeft, setTimeLeft] = useState(DISABLED_MODULE_PREVIEW_SECONDS);
  const [isLocked, setIsLocked] = useState(false);

  const currentModule = useMemo(
    () =>
      availableLabModules.find(
        (m) => m.href !== "/dashboard" && (pathname === m.href || pathname.startsWith(`${m.href}/`))
      ),
    [pathname]
  );

  const isPreviewMode = useMemo(() => {
    if (loading || !theme || !currentModule) return false;
    const enabledModules = new Set(theme.enabledModules || defaultLabModules);
    return !enabledModules.has(currentModule.id);
  }, [currentModule, loading, theme]);

  const previewStorageKey = useMemo(() => {
    const tenantId = user?.tenantId || theme?.tenantId;
    return getDisabledModulePreviewKey(tenantId, currentModule?.id);
  }, [currentModule, theme, user]);

  const previewAlreadySeen = useMemo(
    () => isPreviewMode && hasSeenDisabledModulePreview(previewStorageKey),
    [isPreviewMode, previewStorageKey]
  );

  const currentModuleName = useMemo(() => currentModule?.label || "this", [currentModule]);

  useEffect(() => {
    if (!isPreviewMode) {
      setIsLocked(false);
      setTimeLeft(DISABLED_MODULE_PREVIEW_SECONDS);
      return;
    }

    if (hasSeenDisabledModulePreview(previewStorageKey)) {
      setIsLocked(true);
      setTimeLeft(0);
      return;
    }

    setIsLocked(false);
    setTimeLeft(DISABLED_MODULE_PREVIEW_SECONDS);

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          markDisabledModulePreviewSeen(previewStorageKey);
          setIsLocked(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [isPreviewMode, pathname, previewStorageKey]);

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
  const effectiveIsLocked = isPreviewMode && (isLocked || previewAlreadySeen);

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
          {isPreviewMode && !effectiveIsLocked && (
            <div className="preview-topbar">
              <span>
                ⚡ <strong>Preview Mode:</strong> You are exploring the <strong>{currentModuleName}</strong> module. 
                This page will lock in <strong>{timeLeft}</strong> seconds.
              </span>
            </div>
          )}
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
            <main
              className={`tenant-page-viewport${effectiveIsLocked ? " preview-locked-viewport" : ""}`}
              style={{ position: "relative" }}
            >
              <div className={effectiveIsLocked ? "preview-locked-blur" : ""} style={{ transition: "filter 0.3s ease-in-out" }}>
                {hasPageAccess ? (
                  children
                ) : (
                  <section className="dash-card tenant-access-denied">
                    <div className="dash-card-header">
                      <h3>Access denied</h3>
                    </div>
                    <p>Your role does not have permission to view this page.</p>
                  </section>
                )}
              </div>

              {effectiveIsLocked && (
                <div className="preview-locked-overlay">
                  <div className="preview-locked-card">
                    <div className="preview-locked-icon">🔒</div>
                    <h2>Unlock Full Access</h2>
                    <p>
                      The <strong>{currentModuleName}</strong> module is not included in your current subscription package. 
                      Upgrade your plan to unlock full access and manage your workflows.
                    </p>
                    <div className="preview-locked-features">
                      <div className="feature-item">✓ Full features & data management</div>
                      <div className="feature-item">✓ Active system workflow support</div>
                      <div className="feature-item">✓ 24/7 dedicated enterprise support</div>
                    </div>
                    <button
                      className="dash-btn-primary preview-upgrade-btn"
                      onClick={() => {
                        const settingsPath = buildTenantQueryPath("/subscription", user?.tenantId);
                        router.push(settingsPath);
                      }}
                    >
                      Upgrade Subscription Plan
                    </button>
                  </div>
                </div>
              )}
            </main>
          </div>
        </div>
      </div>
    </TenantShellProvider>
  );
}
