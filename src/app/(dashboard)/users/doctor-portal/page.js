"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import UserManager from "../../settings/UserManager";
import SuccessDialog from "@/app/components/SuccessDialog";
import { Icons } from "@/app/components/Icons";
import { cachedJsonFetch, clearCachedApi, useTenantShell } from "@/app/lib/use-current-user";
import { hasPermission } from "@/app/lib/client-rbac";

export default function DoctorPortalUsersPage() {
  const { theme, user } = useTenantShell();
  const [doctorPortalUsers, setDoctorPortalUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [userSaving, setUserSaving] = useState(false);
  const [pageError, setPageError] = useState("");
  const [userMessage, setUserMessage] = useState("");

  const canManageUsers = hasPermission(user, "users.manage");

  const loadUsers = useCallback(async () => {
    try {
      setPageError("");
      if (!user || !canManageUsers) return;

      const userResponse = await cachedJsonFetch("/api/settings/users", { ttl: 10_000 });
      if (!userResponse.response.ok) {
        throw new Error(userResponse.data.error || userResponse.data.details || "Unable to load doctor portal users");
      }

      setDoctorPortalUsers(userResponse.data.doctorPortalUsers || []);
    } catch (err) {
      setPageError(err.message);
    } finally {
      setLoadingUsers(false);
    }
  }, [canManageUsers, user]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

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
      <div className="settings-header settings-subpage-header">
        <div>
          <p className="module-kicker">Lab Admin</p>
          <h1>Doctor Portal Users</h1>
          <span>{theme?.labName || "Tenant Lab"} linked doctor login accounts.</span>
        </div>
        <Link href="/users" className="developer-secondary-link">{Icons.arrowLeft || Icons.back} User Assignment</Link>
      </div>

      <SuccessDialog message={userMessage} onClose={() => setUserMessage("")} />
      {pageError && <div className="developer-alert">{pageError}</div>}

      {loadingUsers ? (
        <p className="developer-empty">Loading doctor portal users...</p>
      ) : canManageUsers ? (
        <UserManager
          newUser={{ name: "", email: "", password: "", confirmPassword: "", roleId: "" }}
          setNewUser={() => {}}
          newUserErrors={{}}
          roles={[]}
          createUser={() => {}}
          userSaving={userSaving}
          rolesDirty={false}
          canCreateUser={false}
          users={[]}
          doctorPortalUsers={doctorPortalUsers}
          editingUser={null}
          setEditingUser={() => {}}
          startEditUser={() => {}}
          cancelEditUser={() => {}}
          saveUserEdit={() => {}}
          deleteUser={() => {}}
          resendDoctorInvitation={resendDoctorInvitation}
          showCreate={false}
          showLists
          listMode="doctorPortal"
        />
      ) : (
        <section className="settings-panel">
          <p className="developer-empty">Your role does not have permission to manage users.</p>
        </section>
      )}
    </section>
  );
}
