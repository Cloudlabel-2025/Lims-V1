"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function MainLayout({ children }) {
  const router = useRouter();
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

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.push("/");
    router.refresh();
  };

  if (loading) return <div style={{ minHeight: "100vh", background: "#f1f5f9" }} />;

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
          {children}
        </div>
      </div>
    </div>
  );
}
