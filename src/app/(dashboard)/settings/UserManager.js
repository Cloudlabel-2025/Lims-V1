"use client";

import PasswordField from "@/app/components/PasswordField";

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
}) {
  return (
    <section className="settings-panel">
      <div className="settings-panel-header">
        <h2>User Assignment</h2>
        <p>Create lab users and assign one role for this lab.</p>
      </div>
      <div className="settings-form-grid">
        <label>
          User Name
          <input
            value={newUser.name}
            onChange={(event) => setNewUser((current) => ({ ...current, name: event.target.value }))}
            placeholder="Enter name"
          />
        </label>
        <label>
          Login Email
          <input
            type="email"
            name="lab-settings-new-user-email"
            value={newUser.email}
            onChange={(event) => setNewUser((current) => ({ ...current, email: event.target.value }))}
            placeholder="Enter email"
            autoComplete="section-lab-settings-new-user username"
          />
        </label>
        <label>
          Password
          <PasswordField
            name="lab-settings-new-user-password"
            value={newUser.password}
            onChange={(event) => setNewUser((current) => ({ ...current, password: event.target.value }))}
            placeholder="Enter password"
            autoComplete="section-lab-settings-new-user new-password"
            invalid={Boolean(newUserErrors.password)}
            toggleLabel="user password"
          />
          {newUserErrors.password && <em>{newUserErrors.password}</em>}
        </label>
        <label>
          Confirm Password
          <PasswordField
            name="lab-settings-new-user-confirm-password"
            value={newUser.confirmPassword}
            onChange={(event) => setNewUser((current) => ({ ...current, confirmPassword: event.target.value }))}
            placeholder="Enter confirm password"
            autoComplete="section-lab-settings-new-user new-password"
            invalid={Boolean(newUserErrors.confirmPassword)}
            toggleLabel="confirm user password"
          />
          {newUserErrors.confirmPassword && <em>{newUserErrors.confirmPassword}</em>}
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
          onClick={createUser}
          disabled={userSaving || rolesDirty || !canCreateUser}
        >
          {userSaving ? "Creating..." : "Create Lab User"}
        </button>
      </div>
      {rolesDirty && <p className="developer-empty">Save role configuration before creating users.</p>}
      {users.length > 0 && (
        <div className="settings-role-list">
          {users.map((user) => (
            <button type="button" key={user.id}>
              <strong>{user.userId}</strong>
              <span>
                {user.email} - {user.role?.name || "No role"}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
