"use client";

import { useMemo } from "react";

function getModuleLabel(moduleId) {
  return moduleId
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

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
  expandedModules,
  onToggleModuleExpand,
  searchQuery,
  onSearchChange,
  handleSelectAll,
  handleClear,
  permissionByKey,
}) {
  const filteredModules = useMemo(() => {
    if (!searchQuery) return permissionsByModule;
    const lowerQuery = searchQuery.toLowerCase();
    return Object.entries(permissionsByModule).reduce((result, [moduleId, permissions]) => {
      const filtered = permissions.filter(
        (p) =>
          p.name.toLowerCase().includes(lowerQuery) ||
          p.key.toLowerCase().includes(lowerQuery)
      );
      if (filtered.length > 0) {
        result[moduleId] = filtered;
      }
      return result;
    }, {});
  }, [permissionsByModule, searchQuery]);

  const moduleOrder = useMemo(() => {
    const knownOrder = [
      "dashboard", "patients", "doctors", "tests", "billing",
      "samples", "reports", "accounts", "analytics", "inventory",
      "users", "settings", "general",
    ];
    return Object.keys(filteredModules).sort(
      (a, b) => knownOrder.indexOf(a) - knownOrder.indexOf(b)
    );
  }, [filteredModules]);

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
          <div className="permission-search">
            <input
              type="search"
              placeholder="Search permissions..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="permission-search-input"
            />
            {searchQuery && (
              <button
                type="button"
                className="permission-search-clear"
                onClick={() => onSearchChange("")}
              >
                Clear
              </button>
            )}
          </div>

          <div className="cms-permission-card-list">
            {moduleOrder.length === 0 && searchQuery ? (
              <p className="developer-empty">
                No permissions match &ldquo;{searchQuery}&rdquo;
              </p>
            ) : (
              moduleOrder.map((moduleId) => {
                const permissions = filteredModules[moduleId];
                const selectedCount = permissions.filter((p) =>
                  activePermissionSet.has(p.key)
                ).length;
                const expanded = expandedModules.has(moduleId);
                const allSelected = selectedCount === permissions.length;

                return (
                  <article className="cms-permission-card" key={moduleId}>
                    <button
                      type="button"
                      className="cms-permission-card-header"
                      onClick={() => onToggleModuleExpand(moduleId)}
                      aria-expanded={expanded}
                    >
                      <span className="cms-permission-toggle">
                        {expanded ? "\u2212" : "+"}
                      </span>
                      <span className="cms-permission-title">
                        <strong>{getModuleLabel(moduleId)}</strong>
                        <small>
                          {selectedCount} selected of {permissions.length}
                        </small>
                      </span>
                      <span className="cms-permission-status">
                        {allSelected
                          ? "Full access"
                          : selectedCount === 0
                            ? "No access"
                            : "Custom"}
                      </span>
                    </button>

                    {expanded && (
                      <div className="cms-permission-card-body">
                        <div className="cms-permission-card-tools">
                          <button
                            type="button"
                            className="developer-secondary-link"
                            onClick={() => handleSelectAll(moduleId, permissions)}
                            disabled={allSelected}
                          >
                            Select All
                          </button>
                          <button
                            type="button"
                            className="developer-secondary-link"
                            onClick={() => handleClear(moduleId, permissions)}
                            disabled={selectedCount === 0}
                          >
                            Clear
                          </button>
                        </div>

                        <div className="permission-matrix cms-permission-matrix">
                          <article className="permission-group">
                            <div className="permission-group-header">
                              <strong>{getModuleLabel(moduleId)} Permissions</strong>
                              <span>{permissions.length} permissions</span>
                            </div>
                            {permissions.map((permission) => {
                              const isChecked = activePermissionSet.has(permission.key);
                              const isDangerous = permission.isDangerous;
                              const missingDependency = (
                                permission.dependencies || []
                              ).find(
                                (depKey) => !activePermissionSet.has(depKey)
                              );
                              const isDisabled = Boolean(missingDependency);

                              return (
                                <label
                                  className={`permission-checkbox${isDangerous ? " permission-checkbox-danger" : ""}`}
                                  key={permission.key}
                                  style={
                                    isDangerous && isChecked
                                      ? {
                                          background: "#fef2f2",
                                          border: "1px solid #fecaca",
                                        }
                                      : undefined
                                  }
                                  title={
                                    isDisabled
                                      ? `Requires: ${permissionByKey.get(missingDependency)?.name || missingDependency}`
                                      : isDangerous
                                        ? "This permission has irreversible consequences"
                                        : undefined
                                  }
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    disabled={isDisabled}
                                    onChange={() => toggleRolePermission(permission.key)}
                                  />
                                  <span>
                                    <strong>{permission.name}</strong>
                                    {isDisabled && (
                                      <span className="dependency-hint">
                                        Requires:{" "}
                                        {permissionByKey.get(missingDependency)
                                          ?.name || missingDependency}
                                      </span>
                                    )}
                                  </span>
                                </label>
                              );
                            })}
                          </article>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })
            )}
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
