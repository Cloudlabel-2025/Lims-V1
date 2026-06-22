"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icons } from "@/app/components/Icons";
import { availableLabModules } from "@/app/lib/modules";
import { getAllowedNavItems } from "@/app/lib/client-rbac";

const RECENT_KEY = "lims_recent_searches";
const MAX_RECENT = 5;

function loadRecentSearches() {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveRecentSearches(items) {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(items.slice(0, MAX_RECENT))); }
  catch { /* noop */ }
}

export default function Topbar({ onToggleSidebar, user, theme }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [apiResults, setApiResults] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [hasUnread, setHasUnread] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState(loadRecentSearches);
  const searchTimer = useRef(null);
  const topbarRef = useRef(null);
  const notifVersion = useRef("");
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

  const allowedHrefs = useMemo(() => new Set(allowedModuleItems.map((module) => module.href)), [allowedModuleItems]);

  const visibleSuggestions = useMemo(() => {
    const source = query.trim()
      ? [...moduleSuggestions, ...apiResults]
      : recentSearches.filter((item) => allowedHrefs.has(item.href));
    const normalizedQuery = query.trim().toLowerCase();
    return source
      .filter((item) => !normalizedQuery || item.label.toLowerCase().includes(normalizedQuery))
      .slice(0, 8);
  }, [allowedHrefs, moduleSuggestions, apiResults, query, recentSearches]);

  const navigateTo = (item) => {
    setRecentSearches((prev) => {
      const updated = [{ ...item, type: "Recent" }, ...prev.filter((r) => r.href !== item.href)].slice(0, MAX_RECENT);
      saveRecentSearches(updated);
      return updated;
    });
    setQuery(item.label);
    setSearchOpen(false);
    router.push(item.href);
  };

  const doSearch = useCallback(async (q) => {
    if (q.trim().length < 2) { setApiResults([]); return; }
    try {
      const resp = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { credentials: "include" });
      const data = await resp.json();
      if (resp.ok) setApiResults(data.results || []);
    } catch { setApiResults([]); }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const resp = await fetch("/api/notifications", { credentials: "include" });
      const data = await resp.json();
      if (resp.ok) {
        const next = data.notifications || [];
        const nextVersion = next.map((n) => n.id).join(",");
        if (nextVersion !== notifVersion.current && notifVersion.current !== "") {
          setHasUnread(true);
        }
        notifVersion.current = nextVersion;
        setNotifications(next);
      }
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    const timer = setTimeout(fetchNotifications, 0);
    const interval = setInterval(fetchNotifications, 60000);
    return () => { clearTimeout(timer); clearInterval(interval); };
  }, [fetchNotifications]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => doSearch(query), 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [query, doSearch]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (topbarRef.current && !topbarRef.current.contains(e.target)) {
        setSearchOpen(false);
        setNotificationsOpen(false);
        setAccountOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  };

  return (
    <header className="dash-topbar" ref={topbarRef}>
      <button className="dash-sidebar-toggle" onClick={onToggleSidebar} aria-label="Toggle sidebar">
        {Icons.menu}
      </button>

      <div className="dash-topbar-search">
        <span className="dash-search-icon">{Icons.search}</span>
        <input
          type="text"
          placeholder="Search records — patients, doctors, samples, tests..."
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
                <button type="button" className="dash-dropdown-item" key={`${item.type}-${item.href}`}
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
          <button className="dash-topbar-btn" id="notification-btn" type="button" aria-label="Notifications"
            aria-expanded={notificationsOpen}
            onClick={() => { setNotificationsOpen((o) => !o); setAccountOpen(false); setHasUnread(false); }}
          >
            {Icons.bell}
            {hasUnread && notifications.length > 0 && <span className="dash-notif-dot" />}
          </button>
          {notificationsOpen && (
            <div className="dash-menu-dropdown notifications">
              <div className="dash-dropdown-header">Notifications</div>
              {notifications.length > 0 ? (
                notifications.map((item) => (
                  <button type="button" className="dash-notification-item" key={item.id}
                    onClick={() => { setNotificationsOpen(false); router.push(item.href); }}
                  >
                    <span className={`dash-priority-dot ${item.priority}`} />
                    <span>
                      <strong>{item.title}</strong>
                      <small>{item.detail}</small>
                    </span>
                  </button>
                ))
              ) : (
                <div className="dash-dropdown-empty" style={{ padding: "22px 14px" }}>No new notifications</div>
              )}
            </div>
          )}
        </div>
        <div className="dash-action-wrap">
          <button className="dash-topbar-avatar" type="button" aria-label="User account"
            aria-expanded={accountOpen}
            onClick={() => { setAccountOpen((o) => !o); setNotificationsOpen(false); }}
          >
            <span>{avatarInitial}</span>
          </button>
          {accountOpen && (
            <div className="dash-menu-dropdown account">
              <div className="dash-account-summary">
                <strong>{displayName}</strong>
                <small>{user?.email || "admin@lims.local"}</small>
              </div>
              <button type="button" className="dash-dropdown-item" onClick={() => { setAccountOpen(false); router.push("/profile"); }}>
                <span className="dash-dropdown-icon">{Icons.user}</span>
                <span><strong>View profile</strong><small>Account details</small></span>
              </button>
              <button type="button" className="dash-dropdown-item" onClick={() => { setAccountOpen(false); router.push("/settings"); }}>
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
