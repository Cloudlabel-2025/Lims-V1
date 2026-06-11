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
  editingUser,
  setEditingUser,
  startEditUser,
  cancelEditUser,
  saveUserEdit,
  deleteUser,
}) {
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
                value={editingUser.name}
                onChange={(event) => setEditingUser((current) => ({ ...current, name: event.target.value }))}
                placeholder="Enter name"
              />
            </label>
            <label>
              Login Email
              <input
                type="email"
                value={editingUser.email}
                onChange={(event) => setEditingUser((current) => ({ ...current, email: event.target.value }))}
                placeholder="Enter email"
              />
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
            <button type="button" className="developer-primary-link" onClick={saveUserEdit} disabled={userSaving || rolesDirty}>
              {userSaving ? "Saving..." : "Save User"}
            </button>
            <button type="button" className="developer-primary-link" onClick={cancelEditUser} disabled={userSaving}>
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
