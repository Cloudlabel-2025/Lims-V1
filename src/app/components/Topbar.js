"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icons } from "@/app/components/Icons";
import { availableLabModules } from "@/app/lib/modules";
import { getAllowedNavItems } from "@/app/lib/client-rbac";

const NOTIFICATIONS = [
  {
    id: "doctor-availability",
    title: "Doctor availability needs review",
    detail: "One or more doctors are inactive or marked on leave.",
    href: "/doctors",
    priority: "high",
  },
  {
    id: "sample-stock",
    title: "Sample collection inventory is low",
    detail: "Review sample stock before new collections are assigned.",
    href: "/samples",
    priority: "critical",
  },
];

const DEFAULT_RECENTS = [
  { label: "Doctor master list", href: "/doctors", type: "Recent" },
  { label: "Patient registration", href: "/patients/register", type: "Recent" },
  { label: "Test master", href: "/tests", type: "Recent" },
];

export default function Topbar({ onToggleSidebar, user, theme }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState(DEFAULT_RECENTS);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const displayName = user?.name || user?.email?.split("@")[0] || "Admin";
  const avatarInitial = displayName.trim()[0]?.toUpperCase() || "A";

  const allowedModuleItems = useMemo(() => getAllowedNavItems(user, theme), [user, theme]);

  const moduleSuggestions = useMemo(
    () =>
      allowedModuleItems.map((module) => ({
        label: module.label,
        href: module.href,
        type: "Module",
      })),
    [allowedModuleItems]
  );

  const notificationItems = useMemo(
    () =>
      NOTIFICATIONS.filter((item) => {
        const matchedModule = availableLabModules.find((entry) => item.href === entry.href || item.href.startsWith(`${entry.href}/`));
        return !matchedModule || allowedModuleItems.some((allowed) => allowed.id === matchedModule.id);
      }),
    [allowedModuleItems]
  );

  const allowedHrefs = useMemo(() => new Set(allowedModuleItems.map((module) => module.href)), [allowedModuleItems]);

  const visibleSuggestions = useMemo(() => {
    const source = query.trim()
      ? moduleSuggestions
      : recentSearches.filter((item) => allowedHrefs.has(item.href));
    const normalizedQuery = query.trim().toLowerCase();

    return source
      .filter((item) => !normalizedQuery || item.label.toLowerCase().includes(normalizedQuery))
      .slice(0, 6);
  }, [allowedHrefs, moduleSuggestions, query, recentSearches]);

  const navigateTo = (item) => {
    setRecentSearches((prev) => [
      { ...item, type: "Recent" },
      ...prev.filter((recent) => recent.href !== item.href),
    ].slice(0, 5));
    setQuery(item.label);
    setSearchOpen(false);
    router.push(item.href);
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  };

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
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSearchOpen(true);
          }}
          onFocus={() => setSearchOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && visibleSuggestions[0]) {
              event.preventDefault();
              navigateTo(visibleSuggestions[0]);
            }
            if (event.key === "Escape") setSearchOpen(false);
          }}
        />
        {searchOpen && (
          <div className="dash-search-dropdown">
            <div className="dash-dropdown-header">
              {query.trim() ? "Suggestions" : "Recent searches"}
            </div>
            {visibleSuggestions.length > 0 ? (
              visibleSuggestions.map((item) => (
                <button
                  type="button"
                  className="dash-dropdown-item"
                  key={item.href}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => navigateTo(item)}
                >
                  <span className="dash-dropdown-icon">{Icons.search}</span>
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.type}</small>
                  </span>
                </button>
              ))
            ) : (
              <div className="dash-dropdown-empty">No matching records</div>
            )}
          </div>
        )}
      </div>

      <div className="dash-topbar-actions">
        <button className="dash-topbar-btn" type="button" aria-label="Undo" title="Undo" onClick={() => router.back()}>
          {Icons.undo}
        </button>
        <button className="dash-topbar-btn" type="button" aria-label="Redo" title="Redo" onClick={() => window.history.forward()}>
          {Icons.redo}
        </button>
        <div className="dash-action-wrap">
          <button
            className="dash-topbar-btn"
            id="notification-btn"
            type="button"
            aria-label="Notifications"
            aria-expanded={notificationsOpen}
            onClick={() => {
              setNotificationsOpen((open) => !open);
              setAccountOpen(false);
            }}
          >
            {Icons.bell}
            {notificationItems.length > 0 && <span className="dash-notif-dot" />}
          </button>
          {notificationsOpen && (
            <div className="dash-menu-dropdown notifications">
              <div className="dash-dropdown-header">Notifications</div>
              {notificationItems.map((item) => (
                <button type="button" className="dash-notification-item" key={item.id} onClick={() => router.push(item.href)}>
                  <span className={`dash-priority-dot ${item.priority}`} />
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.detail}</small>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="dash-action-wrap">
          <button
            className="dash-topbar-avatar"
            type="button"
            aria-label="User account"
            aria-expanded={accountOpen}
            onClick={() => {
              setAccountOpen((open) => !open);
              setNotificationsOpen(false);
            }}
          >
            <span>{avatarInitial}</span>
          </button>
          {accountOpen && (
            <div className="dash-menu-dropdown account">
              <div className="dash-account-summary">
                <strong>{displayName}</strong>
                <small>{user?.email || "admin@lims.local"}</small>
              </div>
              <button type="button" className="dash-dropdown-item" onClick={() => {
                setAccountOpen(false);
                router.push("/profile");
              }}>
                <span className="dash-dropdown-icon">{Icons.user}</span>
                <span><strong>View profile</strong><small>Account details</small></span>
              </button>
              <button type="button" className="dash-dropdown-item" onClick={() => {
                setAccountOpen(false);
                router.push("/settings");
              }}>
                <span className="dash-dropdown-icon">{Icons.settings}</span>
                <span><strong>Settings</strong><small>Preferences and access</small></span>
              </button>
              <button type="button" className="dash-dropdown-item danger" onClick={logout}>
                <span className="dash-dropdown-icon">{Icons.logout}</span>
                <span><strong>Logout</strong><small>End current session</small></span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
