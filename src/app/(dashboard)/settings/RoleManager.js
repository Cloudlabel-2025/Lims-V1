"use client";

import { Icons } from "@/app/components/Icons";

export default function RoleManager({
  roles,
  activeRoleIndex,
  setActiveRoleIndex,
  newRoleName,
  setNewRoleName,
  addRole,
  deleteRole,
  roleSaving,
  rolesDirty,
  cancelRoleChanges,
  saveRoleConfiguration,
}) {
  return (
    <section className="settings-panel">
      <div className="settings-panel-header">
        <h2>Lab Roles</h2>
        <p>Create roles inside this lab and assign only allowed permissions.</p>
      </div>

      <div className="settings-role-list">
        {roles.map((role, index) => (
          <div className="settings-role-row" key={role.id || role.name}>
            <button
              type="button"
              className={activeRoleIndex === index ? "active" : ""}
              onClick={() => setActiveRoleIndex(index)}
            >
              <strong>{role.name}</strong>
              <span>{role.permissions.includes("*") ? "All permissions" : `${role.permissions.length} permissions`}</span>
            </button>
            {!role.isDefaultAdmin && !role.isSystemRole && (
              <button
                type="button"
                className="settings-role-delete"
                onClick={() => deleteRole(role, index)}
                disabled={roleSaving}
              >
                {Icons.trash || "Delete"} Delete
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="settings-inline-form">
        <input
          value={newRoleName}
          onChange={(event) => setNewRoleName(event.target.value)}
          placeholder="Create role, e.g. Billing Cashier"
        />
        <button type="button" onClick={addRole}>
          {Icons.plus} Add Roles
        </button>
      </div>
      <div className="developer-config-actions">
        <button
          type="button"
          className="developer-secondary-link"
          onClick={cancelRoleChanges}
          disabled={!rolesDirty || roleSaving}
        >
          Cancel
        </button>
        <button
          type="button"
          className="developer-primary-link"
          onClick={saveRoleConfiguration}
          disabled={!rolesDirty || roleSaving}
        >
          {roleSaving ? "Saving..." : "Save Role Configuration"}
        </button>
      </div>
    </section>
  );
}
