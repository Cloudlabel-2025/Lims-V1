import assert from "node:assert/strict";
import test from "node:test";
import {
  availableLabModules,
  defaultLabModules,
  notificationRules,
  tenantActionPermissions,
  tenantAdminItems,
  tenantModuleGroups,
  topbarSearchScopes,
} from "../../src/app/lib/modules.js";

test("tenant modules are grouped into enterprise LIMS areas", () => {
  const moduleIds = new Set(availableLabModules.map((module) => module.id));
  const groupedIds = new Set(tenantModuleGroups.flatMap((group) => group.items));

  for (const moduleId of defaultLabModules) {
    assert.ok(moduleIds.has(moduleId), `${moduleId} must exist in the module registry`);
    assert.ok(groupedIds.has(moduleId), `${moduleId} must belong to an enterprise group`);
  }

  assert.ok(tenantModuleGroups.some((group) => group.id === "operations"), "Lab operations group is required");
  assert.ok(tenantModuleGroups.some((group) => group.id === "finance"), "Finance group is required");
});

test("tenant admin items are permission protected", () => {
  for (const item of tenantAdminItems) {
    assert.ok(item.href.startsWith("/"), `${item.id} must route to an app page`);
    assert.ok(item.permissionAny?.length > 0, `${item.id} must define permissionAny`);
  }
});

test("topbar search scopes are permission aware and route to existing modules", () => {
  const moduleIds = new Set(availableLabModules.map((module) => module.id));

  for (const scope of topbarSearchScopes) {
    assert.ok(moduleIds.has(scope.id), `${scope.id} search scope must map to a module`);
    assert.ok(scope.permission.endsWith(".view"), `${scope.id} search must require view permission`);
    assert.ok(scope.endpoint.startsWith("/api/"), `${scope.id} search must use an API endpoint`);
    assert.ok(scope.fields.length > 0, `${scope.id} search must define searchable fields`);
  }
});

test("notification rules route only to protected work areas", () => {
  for (const rule of notificationRules) {
    assert.ok(rule.href.startsWith("/"), `${rule.id} must route to a work area`);
    assert.ok(rule.permissionAny?.length > 0, `${rule.id} must target at least one role permission`);
    assert.ok(["normal", "high", "critical"].includes(rule.priority), `${rule.id} must have a valid priority`);
  }
});

test("enterprise action permissions define common module actions", () => {
  assert.ok(tenantActionPermissions.samples.includes("samples.collect"));
  assert.ok(tenantActionPermissions.samples.includes("samples.reject"));
  assert.ok(tenantActionPermissions.reports.includes("reports.verify"));
  assert.ok(tenantActionPermissions.reports.includes("reports.release"));
  assert.ok(tenantActionPermissions.billing.includes("billing.collect"));
});
