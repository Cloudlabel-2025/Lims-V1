"use client";

import { useState } from "react";
import PasswordField from "@/app/components/PasswordField";

const SAFE_NAME = /^[A-Za-z0-9 .&'\/,()@_-]+$/;
const URL_RE = /https?:\/\//;

function validateUserName(v) {
  if (!v || !v.trim()) return "User name is required";
  if (URL_RE.test(v)) return "URLs are not allowed in user name";
  if (!SAFE_NAME.test(v.trim())) return "User name contains invalid characters";
  return "";
}

function validateUserEmail(v) {
  const trimmed = (v || "").trim();
  if (URL_RE.test(trimmed)) return "URLs are not allowed in email";
  if (!trimmed) return "Login email is required";
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(trimmed)) return "Valid login email is required";
  return "";
}

export default function UserManager({
  newUser,
  setNewUser,
  newUserErrors,
  roles,
  createUser,
  userSaving,
  rolesDirty,
  canCreateUser,
  users,
  editingUser,
  setEditingUser,
  startEditUser,
  cancelEditUser,
  saveUserEdit,
  deleteUser,
}) {
  const [localErrors, setLocalErrors] = useState({});

  function handleNewUserNameChange(value) {
    setNewUser((current) => ({ ...current, name: value }));
    const err = validateUserName(value);
    setLocalErrors((prev) => ({ ...prev, newName: err }));
  }

  function handleNewUserEmailChange(value) {
    setNewUser((current) => ({ ...current, email: value }));
    const err = validateUserEmail(value);
    setLocalErrors((prev) => ({ ...prev, newEmail: err }));
  }

  function handleEditNameChange(value) {
    setEditingUser((current) => ({ ...current, name: value }));
    const err = validateUserName(value);
    setLocalErrors((prev) => ({ ...prev, editName: err }));
  }

  function handleEditEmailChange(value) {
    setEditingUser((current) => ({ ...current, email: value }));
    const err = validateUserEmail(value);
    setLocalErrors((prev) => ({ ...prev, editEmail: err }));
  }

  function handleCreateUser() {
    const nameErr = validateUserName(newUser.name);
    const emailErr = validateUserEmail(newUser.email);
    const passwordErr = !newUser.password ? "Password is required" : "";
    const confirmErr = !newUser.password ? "" : (newUser.password !== newUser.confirmPassword ? "Passwords do not match" : "");
    setLocalErrors({ newName: nameErr, newEmail: emailErr, newPassword: passwordErr, newConfirm: confirmErr });
    if (nameErr || emailErr || passwordErr || confirmErr) return;
    createUser();
  }

  function handleSaveUserEdit() {
    if (!editingUser) return;
    const nameErr = validateUserName(editingUser.name);
    const emailErr = validateUserEmail(editingUser.email);
    setLocalErrors({ editName: nameErr, editEmail: emailErr });
    if (nameErr || emailErr) return;
    saveUserEdit();
  }

  function handleCancelEdit() {
    setLocalErrors((prev) => ({ ...prev, editName: "", editEmail: "" }));
    cancelEditUser();
  }

  return (
    <>
      <section className="settings-panel">
        <div className="settings-panel-header">
          <h2>Create User</h2>
          <p>Create lab users and assign one role for this lab.</p>
        </div>
        <div className="settings-form-grid">
          <label>
            User Name
            <input
              className={"lims-input" + (localErrors.newName ? " invalid" : "")}
              value={newUser.name}
              onChange={(event) => handleNewUserNameChange(event.target.value)}
              placeholder="Enter name"
            />
            {localErrors.newName && <em style={{ color: "#b91c1c", fontSize: 11 }}>{localErrors.newName}</em>}
          </label>
          <label>
            Login Email
            <input
              className={"lims-input" + (localErrors.newEmail ? " invalid" : "")}
              type="email"
              name="lab-settings-new-user-email"
              value={newUser.email}
              onChange={(event) => handleNewUserEmailChange(event.target.value)}
              placeholder="Enter email"
              autoComplete="section-lab-settings-new-user username"
            />
            {localErrors.newEmail && <em style={{ color: "#b91c1c", fontSize: 11 }}>{localErrors.newEmail}</em>}
          </label>
            <label>
            Password
            <PasswordField
              name="lab-settings-new-user-password"
              value={newUser.password}
              onChange={(event) => { setNewUser((current) => ({ ...current, password: event.target.value })); setLocalErrors((p) => ({ ...p, newPassword: "" })); }}
              placeholder="Enter password"
              autoComplete="section-lab-settings-new-user new-password"
              invalid={Boolean(newUserErrors.password || localErrors.newPassword)}
              toggleLabel="user password"
            />
            {(localErrors.newPassword || newUserErrors.password) && <em style={{ color: "#b91c1c", fontSize: 11 }}>{localErrors.newPassword || newUserErrors.password}</em>}
          </label>
          <label>
            Confirm Password
            <PasswordField
              name="lab-settings-new-user-confirm-password"
              value={newUser.confirmPassword}
              onChange={(event) => { setNewUser((current) => ({ ...current, confirmPassword: event.target.value })); setLocalErrors((p) => ({ ...p, newConfirm: "" })); }}
              placeholder="Enter confirm password"
              autoComplete="section-lab-settings-new-user new-password"
              invalid={Boolean(newUserErrors.confirmPassword || localErrors.newConfirm)}
              toggleLabel="confirm user password"
            />
            {(localErrors.newConfirm || newUserErrors.confirmPassword) && <em style={{ color: "#b91c1c", fontSize: 11 }}>{localErrors.newConfirm || newUserErrors.confirmPassword}</em>}
          </label>
          <label>
            Role
            <select
              value={newUser.roleId}
              onChange={(event) => setNewUser((current) => ({ ...current, roleId: event.target.value }))}
            >
              {roles.map((role) => (
                <option key={role.id || role.name} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="developer-config-actions">
          <button
            type="button"
            className="developer-primary-link"
            onClick={handleCreateUser}
            disabled={userSaving || rolesDirty || !canCreateUser || Boolean(localErrors.newName || localErrors.newEmail)}
          >
            {userSaving ? "Creating..." : "Create Lab User"}
          </button>
        </div>
        {rolesDirty && <p className="developer-empty">Save role configuration before creating users.</p>}
      </section>

      {editingUser && (
        <section className="settings-panel settings-user-edit">
          <div className="settings-panel-header">
            <h2>Edit User</h2>
            <p>Update login details, role, status, or set a new password.</p>
          </div>
          <div className="settings-form-grid">
            <label>
              User Name
              <input
                className={"lims-input" + (localErrors.editName ? " invalid" : "")}
                value={editingUser.name}
                onChange={(event) => handleEditNameChange(event.target.value)}
                placeholder="Enter name"
              />
              {localErrors.editName && <em style={{ color: "#b91c1c", fontSize: 11 }}>{localErrors.editName}</em>}
            </label>
            <label>
              Login Email
              <input
                className={"lims-input" + (localErrors.editEmail ? " invalid" : "")}
                type="email"
                value={editingUser.email}
                onChange={(event) => handleEditEmailChange(event.target.value)}
                placeholder="Enter email"
              />
              {localErrors.editEmail && <em style={{ color: "#b91c1c", fontSize: 11 }}>{localErrors.editEmail}</em>}
            </label>
            <label>
              Role
              <select
                value={editingUser.roleId}
                onChange={(event) => setEditingUser((current) => ({ ...current, roleId: event.target.value }))}
              >
                {roles.map((role) => (
                  <option key={role.id || role.name} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select
                value={editingUser.status}
                onChange={(event) => setEditingUser((current) => ({ ...current, status: event.target.value }))}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="locked">Locked</option>
              </select>
            </label>
            <label>
              New Password
              <PasswordField
                name="lab-settings-edit-user-password"
                value={editingUser.password}
                onChange={(event) => setEditingUser((current) => ({ ...current, password: event.target.value }))}
                placeholder="Leave blank to keep current"
                autoComplete="section-lab-settings-edit-user new-password"
                toggleLabel="edit user password"
              />
            </label>
            <label>
              Confirm New Password
              <PasswordField
                name="lab-settings-edit-user-confirm-password"
                value={editingUser.confirmPassword}
                onChange={(event) => setEditingUser((current) => ({ ...current, confirmPassword: event.target.value }))}
                placeholder="Confirm new password"
                autoComplete="section-lab-settings-edit-user new-password"
                toggleLabel="confirm edit user password"
              />
            </label>
          </div>
          <div className="developer-config-actions">
            <button type="button" className="developer-primary-link" onClick={handleSaveUserEdit} disabled={userSaving || rolesDirty || Boolean(localErrors.editName || localErrors.editEmail)}>
              {userSaving ? "Saving..." : "Save User"}
            </button>
            <button type="button" className="developer-primary-link" onClick={handleCancelEdit} disabled={userSaving}>
              Cancel
            </button>
          </div>
        </section>
      )}

      <section className="settings-panel settings-user-list-panel">
        <div className="settings-panel-header">
          <h2>User List</h2>
          <p>Review users, open edit mode, or remove accounts that no longer need access.</p>
        </div>
        {users.length > 0 ? (
          <div className="settings-role-list settings-user-list">
            {users.map((user) => (
              <div className="settings-user-row" key={user.id}>
                <button type="button" onClick={() => startEditUser(user)}>
                  <strong>{user.userId}</strong>
                  <span>
                    {user.email} - {user.role?.name || "No role"} - {user.status}
                  </span>
                </button>
                <button type="button" onClick={() => startEditUser(user)} disabled={userSaving || rolesDirty}>
                  Edit
                </button>
                <button type="button" className="danger" onClick={() => deleteUser(user)} disabled={userSaving || rolesDirty}>
                  Delete
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="developer-empty">No lab users created yet.</p>
        )}
      </section>
    </>
  );
}
