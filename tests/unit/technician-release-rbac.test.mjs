import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

test("BUG-016: Lab Technician Report Release RBAC denial and assignment verification", async (t) => {
  const rbacConfig = JSON.parse(read("src/app/lib/rbac-config.json"));
  const reportRouteSrc = read("src/app/api/reports/[id]/route.js");
  const reportDetailSrc = read("src/app/(dashboard)/reports/[id]/page.js");
  const settingsPageSrc = read("src/app/(dashboard)/settings/page.js");
  const authMeRouteSrc = read("src/app/api/auth/me/route.js");

  await t.test("1. Default Lab Technician permissions do NOT include 'reports.release'", () => {
    const techTemplate = rbacConfig.roleTemplates.find((role) => role.name === "Lab Technician");
    assert.ok(techTemplate, "Lab Technician role template must exist in rbac-config.json");
    assert.ok(
      !techTemplate.permissions.includes("reports.release"),
      "Default Lab Technician permissions must NOT include 'reports.release'"
    );
    assert.ok(
      techTemplate.permissions.includes("reports.view"),
      "Lab Technician must have 'reports.view' to see reports"
    );
    assert.ok(
      techTemplate.permissions.includes("reports.edit"),
      "Lab Technician must have 'reports.edit' to enter results"
    );
  });

  await t.test("2. Backend reports API enforces 'reports.release' permission and rejects unauthorized release", () => {
    assert.match(
      reportRouteSrc,
      /release:\s*"reports\.release"/,
      "permissionMap must map 'release' action to 'reports.release'"
    );
    assert.match(
      reportRouteSrc,
      /hasExplicitRelease\s*=\s*hasPermission\(auth\.session,\s*"reports\.release"\)/,
      "Report release action must check hasPermission for 'reports.release'"
    );
    assert.match(
      reportRouteSrc,
      /error:\s*"Only Pathologist or Lab Manager can release reports"/,
      "Report release must reject unauthorized users with 403 Forbidden"
    );
    assert.match(
      reportRouteSrc,
      /release:\s*"reports\.released"/,
      "Audit action map must record 'reports.released' upon successful release"
    );
  });

  await t.test("3. Frontend Report Detail page gates release action and displays permission badge", () => {
    assert.match(
      reportDetailSrc,
      /canReleaseReports\s*=\s*hasPermission\(user,\s*"reports\.release"\)/,
      "Report view page must check 'reports.release' permission"
    );
    assert.match(
      reportDetailSrc,
      /if\s*\(action === "release" && !canReleaseReports\)\s*\{\s*setError\("Permission denied/,
      "performAction must reject release requests client-side when permission is missing"
    );
    assert.match(
      reportDetailSrc,
      /Release permission required/,
      "Report view page must display 'Release permission required' badge when user lacks release permission"
    );
  });

  await t.test("4. Settings Roles UI renders confirmation message when permissions are updated", () => {
    assert.match(
      settingsPageSrc,
      /setRoleMessage\("Role configuration saved successfully\."\)/,
      "Settings roles page must set confirmation message upon saving role configuration"
    );
  });

  await t.test("5. Auth Me route synchronizes live role permissions and refreshes token cookie", () => {
    assert.match(
      authMeRouteSrc,
      /livePermissions\s*=\s*activeRole\.permissions/,
      "GET /api/auth/me must read live permissions from active role in database"
    );
    assert.match(
      authMeRouteSrc,
      /setSessionCookie\(response,\s*newToken/,
      "GET /api/auth/me must refresh the session cookie with updated role permissions"
    );
  });
});
