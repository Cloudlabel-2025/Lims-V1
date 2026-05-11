"use client";
import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { canAccessPath, getFirstAllowedHref } from "@/app/lib/client-rbac";

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
            router.replace("/");
          }
        }
      } catch {
        if (!cancelled) router.replace("/");
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
    if (canAccessPath(user, theme, pathname)) return;

    const firstAllowedHref = getFirstAllowedHref(user, theme);
    if (firstAllowedHref && pathname === "/dashboard") {
      router.replace(firstAllowedHref);
    }
  }, [loading, pathname, router, theme, user]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.push("/");
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
