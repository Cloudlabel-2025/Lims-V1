"use client";

import { useState } from "react";
import { Icons } from "@/app/components/Icons";

const SAFE_NAME = /^[A-Za-z0-9 .&'\/,()@_-]+$/;
const URL_RE = /https?:\/\//;

function validateRoleName(v) {
  if (!v || !v.trim()) return "Role name is required";
  if (URL_RE.test(v)) return "URLs are not allowed in role name";
  if (!SAFE_NAME.test(v.trim())) return "Role name contains invalid characters";
  return "";
}

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
  const [newRoleError, setNewRoleError] = useState("");

  function handleRoleNameChange(value) {
    setNewRoleName(value);
    setNewRoleError(validateRoleName(value));
  }

  function handleAddRole() {
    const err = validateRoleName(newRoleName);
    setNewRoleError(err);
    if (err) return;
    addRole();
    setNewRoleError("");
  }

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
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
          <input
            className={"lims-input" + (newRoleError ? " invalid" : "")}
            value={newRoleName}
            onChange={(event) => handleRoleNameChange(event.target.value)}
            placeholder="Enter role name"
          />
          {newRoleError && <em style={{ color: "#b91c1c", fontSize: 11 }}>{newRoleError}</em>}
        </div>
        <button type="button" onClick={handleAddRole} disabled={roleSaving}>
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
