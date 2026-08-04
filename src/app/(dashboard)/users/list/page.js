"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import UserManager from "../../settings/UserManager";
import SuccessDialog from "@/app/components/SuccessDialog";
import { Icons } from "@/app/components/Icons";
import { cachedJsonFetch, clearCachedApi, useTenantShell } from "@/app/lib/use-current-user";
import { hasPermission } from "@/app/lib/client-rbac";

export default function StaffUserListPage() {
  const { theme, user } = useTenantShell();
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [userSaving, setUserSaving] = useState(false);
  const [pageError, setPageError] = useState("");
  const [userMessage, setUserMessage] = useState("");

  const canManageUsers = hasPermission(user, "users.manage");

  const loadUsers = useCallback(async () => {
    try {
      setPageError("");
      if (!user || !canManageUsers) return;

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

      setRoles(roleResponse.data.roles || []);
      setUsers(userResponse.data.users || []);
    } catch (err) {
      setPageError(err.message);
    } finally {
      setLoadingUsers(false);
    }
  }, [canManageUsers, user]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const editUserErrors = useMemo(() => ({}), []);

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
      if (!response.ok) throw new Error(data.error || data.details || "Unable to update user");

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

  return (
    <section className="settings-page">
      <div className="settings-header settings-subpage-header">
        <div>
          <p className="module-kicker">Lab Admin</p>
          <h1>User List</h1>
          <span>{theme?.labName || "Tenant Lab"} staff accounts and login access.</span>
        </div>
        <Link href="/users" className="developer-secondary-link">{Icons.arrowLeft || Icons.back} User Assignment</Link>
      </div>

      <SuccessDialog message={userMessage} onClose={() => setUserMessage("")} />
      {pageError && <div className="developer-alert">{pageError}</div>}

      {loadingUsers ? (
        <p className="developer-empty">Loading users...</p>
      ) : canManageUsers ? (
        <UserManager
          newUser={{ name: "", email: "", password: "", confirmPassword: "", roleId: "" }}
          setNewUser={() => {}}
          newUserErrors={editUserErrors}
          roles={roles}
          createUser={() => {}}
          userSaving={userSaving}
          rolesDirty={false}
          canCreateUser={false}
          users={users}
          doctorPortalUsers={[]}
          editingUser={editingUser}
          setEditingUser={setEditingUser}
          startEditUser={startEditUser}
          cancelEditUser={cancelEditUser}
          saveUserEdit={saveUserEdit}
          deleteUser={deleteUser}
          showCreate={false}
          showLists
          listMode="staff"
        />
      ) : (
        <section className="settings-panel">
          <p className="developer-empty">Your role does not have permission to manage users.</p>
        </section>
      )}
    </section>
  );
}
