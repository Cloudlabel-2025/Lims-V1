"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
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
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [userSaving, setUserSaving] = useState(false);
  const [pageError, setPageError] = useState("");
  const [userMessage, setUserMessage] = useState("");

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
      if (!response.ok) throw new Error(data.error || data.details || "Unable to create user");

      clearCachedApi("/api/settings/users");
      setUsers((current) => [data.user, ...current]);
      setUserMessage(`User created. Login User ID: ${data.user.userId}`);
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
      if (!response.ok) throw new Error(data.error || data.details || "Unable to update user");

      clearCachedApi("/api/settings/users");
      setUsers((current) => current.map((item) => (item.id === data.user.id ? data.user : item)));
      setEditingUser(null);
      setUserMessage(`User ${data.user.userId} updated.`);
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
      setUserMessage(`User ${userRecord.userId} deleted.`);
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

      {pageError && <div className="developer-alert">{pageError}</div>}
      {userMessage && <div className="developer-success">{userMessage}</div>}

      {loadingUsers ? (
        <p className="developer-empty">Loading users...</p>
      ) : canManageUsers ? (
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
          editingUser={editingUser}
          setEditingUser={setEditingUser}
          startEditUser={startEditUser}
          cancelEditUser={cancelEditUser}
          saveUserEdit={saveUserEdit}
          deleteUser={deleteUser}
        />
      ) : (
        <section className="settings-panel">
          <p className="developer-empty">Your role does not have permission to manage users.</p>
        </section>
      )}
    </section>
  );
}
