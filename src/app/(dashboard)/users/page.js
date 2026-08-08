"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import SuccessDialog from "@/app/components/SuccessDialog";
import { Icons } from "@/app/components/Icons";
import { cachedJsonFetch, clearCachedApi, useTenantShell } from "@/app/lib/use-current-user";
import { hasPermission } from "@/app/lib/client-rbac";

const UserManager = dynamic(() => import("../settings/UserManager"), {
  ssr: false,
  loading: () => (
    <section className="settings-panel">
      <p className="developer-empty">Loading users...</p>
    </section>
  ),
});

export default function UserAssignmentPage() {
  const { theme, user } = useTenantShell();
  const [roles, setRoles] = useState([]);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    roleId: "",
  });
  const [editingUser, setEditingUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [doctorPortalUsers, setDoctorPortalUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [userSaving, setUserSaving] = useState(false);
  const [pageError, setPageError] = useState("");
  const [userMessage, setUserMessage] = useState("");
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [quotaAddonDetails, setQuotaAddonDetails] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadUsers() {
      try {
        setPageError("");
        if (!user) return;
        if (!hasPermission(user, "users.manage")) return;

        const [roleResponse, userResponse] = await Promise.all([
          cachedJsonFetch("/api/settings/roles", { ttl: 10_000 }),
          cachedJsonFetch("/api/settings/users", { ttl: 10_000 }),
        ]);

        if (!roleResponse.response.ok) {
          throw new Error(roleResponse.data.error || roleResponse.data.details || "Unable to load roles");
        }

        if (!userResponse.response.ok) {
          throw new Error(userResponse.data.error || userResponse.data.details || "Unable to load users");
        }

        if (!cancelled) {
          const loadedRoles = roleResponse.data.roles || [];
          setRoles(loadedRoles);
          setUsers(userResponse.data.users || []);
          setDoctorPortalUsers(userResponse.data.doctorPortalUsers || []);
          setNewUser((current) => ({
            ...current,
            roleId: current.roleId || loadedRoles[0]?.id || "",
          }));
        }
      } catch (err) {
        if (!cancelled) setPageError(err.message);
      } finally {
        if (!cancelled) setLoadingUsers(false);
      }
    }

    loadUsers();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const canManageUsers = hasPermission(user, "users.manage");
  const newUserErrors = useMemo(() => {
    const errors = {};

    if (newUser.password && newUser.password.length < 8) {
      errors.password = "Password must be at least 8 characters.";
    }

    if (newUser.password && !newUser.confirmPassword) {
      errors.confirmPassword = "Confirm password is required.";
    } else if (newUser.password && newUser.password !== newUser.confirmPassword) {
      errors.confirmPassword = "Password and confirm password must match.";
    }

    return errors;
  }, [newUser.confirmPassword, newUser.password]);
  const canCreateUser =
    Boolean(newUser.password && newUser.confirmPassword) && Object.keys(newUserErrors).length === 0;

  async function createUser() {
    setUserSaving(true);
    setUserMessage("");
    setPageError("");

    try {
      const response = await fetch("/api/settings/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(newUser),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.error && data.error.includes("Active staff account limit exceeded")) {
          if (data.addon) {
            setQuotaAddonDetails(data.addon);
          }
          setShowQuotaModal(true);
        }
        throw new Error(data.error || data.details || "Unable to create user");
      }

      clearCachedApi("/api/settings/users");
      setUsers((current) => [data.user, ...current]);
      setUserMessage(`User created successfully. Login User ID: ${data.user.userId}.`);
      setNewUser({
        name: "",
        email: "",
        password: "",
        confirmPassword: "",
        roleId: roles[0]?.id || "",
      });
    } catch (err) {
      setPageError(err.message);
    } finally {
      setUserSaving(false);
    }
  }

  function startEditUser(userRecord) {
    setUserMessage("");
    setPageError("");
    setEditingUser({
      id: userRecord.id,
      name: [userRecord.firstName, userRecord.lastName].filter(Boolean).join(" "),
      email: userRecord.email || "",
      roleId: userRecord.role?.id || roles[0]?.id || "",
      status: userRecord.status || "active",
      password: "",
      confirmPassword: "",
    });
  }

  function cancelEditUser() {
    setEditingUser(null);
    setUserMessage("");
  }

  async function saveUserEdit() {
    if (!editingUser) return;

    setUserSaving(true);
    setUserMessage("");
    setPageError("");

    try {
      const response = await fetch("/api/settings/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(editingUser),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.error && data.error.includes("Active staff account limit exceeded")) {
          if (data.addon) {
            setQuotaAddonDetails(data.addon);
          }
          setShowQuotaModal(true);
        }
        throw new Error(data.error || data.details || "Unable to update user");
      }

      clearCachedApi("/api/settings/users");
      setUsers((current) => current.map((item) => (item.id === data.user.id ? data.user : item)));
      setEditingUser(null);
      setUserMessage(`User ${data.user.userId} updated successfully.`);
    } catch (err) {
      setPageError(err.message);
    } finally {
      setUserSaving(false);
    }
  }

  async function deleteUser(userRecord) {
    const confirmed = window.confirm(`Delete user ${userRecord.userId || userRecord.email}?`);
    if (!confirmed) return;

    setUserSaving(true);
    setUserMessage("");
    setPageError("");

    try {
      const response = await fetch(`/api/settings/users?id=${encodeURIComponent(userRecord.id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.details || "Unable to delete user");

      clearCachedApi("/api/settings/users");
      setUsers((current) => current.filter((item) => item.id !== userRecord.id));
      if (editingUser?.id === userRecord.id) setEditingUser(null);
      setUserMessage(`User ${userRecord.userId} deleted successfully.`);
    } catch (err) {
      setPageError(err.message);
    } finally {
      setUserSaving(false);
    }
  }

  async function resendDoctorInvitation(portalUser) {
    const doctorId = portalUser?.doctor?.id;
    if (!doctorId) {
      setPageError("Linked doctor profile was not found for this portal user.");
      return;
    }

    setUserSaving(true);
    setUserMessage("");
    setPageError("");

    try {
      const response = await fetch(`/api/doctor/${doctorId}/resend-invitation`, {
        method: "POST",
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.details || "Unable to resend invitation");

      clearCachedApi("/api/settings/users");
      setUserMessage(data.message || `Invitation sent to ${portalUser.email}.`);
      setDoctorPortalUsers((current) =>
        current.map((item) => (
          item.id === portalUser.id
            ? { ...item, status: "invited" }
            : item
        ))
      );
    } catch (err) {
      setPageError(err.message);
    } finally {
      setUserSaving(false);
    }
  }

  return (
    <section className="settings-page">
      <div className="settings-header">
        <div>
          <p className="module-kicker">Lab Admin</p>
          <h1>User Assignment</h1>
          <span>{theme?.labName || "Tenant Lab"} users, roles, account status, and login access.</span>
        </div>
      </div>

      <SuccessDialog message={userMessage} onClose={() => setUserMessage("")} />
      {pageError && <div className="developer-alert">{pageError}</div>}

      {loadingUsers ? (
        <p className="developer-empty">Loading users...</p>
      ) : canManageUsers ? (
        <>
          <UserManager
            newUser={newUser}
            setNewUser={setNewUser}
            newUserErrors={newUserErrors}
            roles={roles}
            createUser={createUser}
            userSaving={userSaving}
            rolesDirty={false}
            canCreateUser={canCreateUser}
            users={users}
            doctorPortalUsers={doctorPortalUsers}
            editingUser={editingUser}
            setEditingUser={setEditingUser}
            startEditUser={startEditUser}
            cancelEditUser={cancelEditUser}
            saveUserEdit={saveUserEdit}
            deleteUser={deleteUser}
            resendDoctorInvitation={resendDoctorInvitation}
            showLists={false}
          />

          <section className="settings-panel">
            <div className="settings-panel-header">
              <h2>User Assignment Lists</h2>
              <p>Open staff users or doctor portal accounts in their own workspace.</p>
            </div>
            <div className="user-assignment-link-grid">
              <Link href="/users/list" className="user-assignment-link-card">
                <span>{Icons.users || Icons.person}</span>
                <strong>User List</strong>
                <small>{users.length} staff accounts</small>
              </Link>
              <Link href="/users/doctor-portal" className="user-assignment-link-card">
                <span>{Icons.stethoscope}</span>
                <strong>Doctor Portal Users</strong>
                <small>{doctorPortalUsers.length} linked accounts</small>
              </Link>
            </div>
          </section>
        </>
      ) : (
        <section className="settings-panel">
          <p className="developer-empty">Your role does not have permission to manage users.</p>
        </section>
      )}

      {/* Quota Exceeded Buy Add-on Modal */}
      {showQuotaModal && (
        <>
          <div 
            style={{ 
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", 
              backdropFilter: "blur(4px)", zIndex: 1000,
              animation: "fadeIn 0.2s ease"
            }} 
            onClick={() => setShowQuotaModal(false)} 
          />
          <div style={{ 
            position: "fixed", top: "50%", left: "50%", 
            transform: "translate(-50%, -50%)", 
            background: "#fff", borderRadius: "16px", 
            padding: "32px", width: "440px", maxWidth: "90vw",
            boxShadow: "0 20px 60px rgba(0,0,0,0.15)", 
            zIndex: 1001,
            animation: "slideUp 0.25s ease"
          }}>
            <div style={{ textAlign: "center", marginBottom: "20px" }}>
              <div style={{ 
                width: "56px", height: "56px", borderRadius: "28px", 
                background: "#fef3c7", display: "flex", alignItems: "center", 
                justifyContent: "center", margin: "0 auto 16px", color: "#d97706" 
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-primary)", margin: "0 0 8px" }}>Active Staff Limit Reached</h3>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: "1.5", margin: "0 0 16px" }}>
                You have used all active staff seats. To add or activate this user, you can purchase the **Staff User Add-on** ({quotaAddonDetails?.units === 1 ? "+1 Seat" : `+${quotaAddonDetails?.units ?? 1} Seats`} for {quotaAddonDetails ? new Intl.NumberFormat("en-IN", { style: "currency", currency: quotaAddonDetails.currency || "INR", maximumFractionDigits: 2 }).format(quotaAddonDetails.priceMinor / 100) : "₹200"}).
              </p>
            </div>
            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={() => setShowQuotaModal(false)}
                style={{ 
                  flex: 1, height: "42px", border: "1.5px solid var(--border)", 
                  borderRadius: "10px", background: "#fff", color: "var(--text-primary)",
                  cursor: "pointer", fontWeight: "600", fontSize: "13px",
                  transition: "all 0.2s"
                }}
              >
                Cancel
              </button>
              <button 
                onClick={() => router.push("/subscription?buy=staffUsers")}
                style={{ 
                  flex: 1, height: "42px", border: "none", 
                  borderRadius: "10px", background: "#0d9488", color: "#fff",
                  cursor: "pointer", fontWeight: "600", fontSize: "13px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.2s"
                }}
              >
                Buy Add-on ({quotaAddonDetails ? new Intl.NumberFormat("en-IN", { style: "currency", currency: quotaAddonDetails.currency || "INR", maximumFractionDigits: 2 }).format(quotaAddonDetails.priceMinor / 100) : "₹200"})
              </button>
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translate(-50%, -45%); }
          to { opacity: 1; transform: translate(-50%, -50%); }
        }
      `}</style>
    </section>
  );
}
