"use client";

export default function PermissionMatrix({
  activeRole,
  roles,
  permissionsByModule,
  activePermissionSet,
  toggleRolePermission,
  rolesDirty,
  roleSaving,
  cancelRoleChanges,
  saveRoleConfiguration,
}) {
  return (
    <section className="settings-panel">
      <div className="settings-panel-header">
        <h2>Permission Mapping For {activeRole?.name || "New Role"}</h2>
        <p>Checkbox selection is limited to modules enabled by the developer for this lab.</p>
      </div>

      {roles.length === 0 ? (
        <p className="developer-empty">Create a role first, then choose permissions for it.</p>
      ) : (
        <>
          <div className="permission-matrix">
            {Object.entries(permissionsByModule).map(([moduleId, permissions]) => (
              <article className="permission-group" key={moduleId}>
                <div className="permission-group-header">
                  <strong>{moduleId}</strong>
                  <span>{permissions.length} permissions</span>
                </div>
                {permissions.map((permission) => (
                  <label className="permission-checkbox" key={permission.key}>
                    <input
                      type="checkbox"
                      checked={activePermissionSet.has(permission.key)}
                      onChange={() => toggleRolePermission(permission.key)}
                    />
                    <span>
                      <strong>{permission.name}</strong>
                      <small>{permission.key}</small>
                    </span>
                  </label>
                ))}
              </article>
            ))}
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
        </>
      )}
    </section>
  );
}
