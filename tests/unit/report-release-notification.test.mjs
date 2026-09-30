import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

test("BUG-007: Report release notification workflow and recipient RBAC validation", () => {
  const notificationsSrc = read("src/app/lib/notifications.js");
  const modulesSrc = read("src/app/lib/modules.js");
  const rbacConfig = JSON.parse(read("src/app/lib/rbac-config.json"));

  // 1. Notification rule for report-released is registered in module rules
  assert.match(
    modulesSrc,
    /id:\s*"report-released"/,
    "modules.js must register 'report-released' in notificationRules"
  );
  assert.match(
    modulesSrc,
    /permissionAny:\s*\["reports\.view",\s*"reports\.release"\]/,
    "'report-released' rule must require reports.view or reports.release"
  );

  // 2. buildNotifications imports TestReport and checks permissions
  assert.match(
    notificationsSrc,
    /const\s*\{[^}]*TestReport[^}]*\}\s*=\s*await getTenantModels\(tenantId\)/,
    "buildNotifications must import TestReport from getTenantModels"
  );
  assert.match(
    notificationsSrc,
    /hasPermission\(session,\s*"reports\.view"\)\s*\|\|\s*hasPermission\(session,\s*"reports\.release"\)/,
    "buildNotifications must check reports.view or reports.release permission"
  );

  // 3. buildNotifications queries released reports and formats notification
  assert.match(
    notificationsSrc,
    /status:\s*"released"/,
    "buildNotifications must query TestReport with status: 'released'"
  );
  assert.match(
    notificationsSrc,
    /const\s+notifId\s*=\s*`report-released-\$\{report\._id\}`/,
    "buildNotifications must use unique id report-released-${report._id} for deduplication"
  );
  assert.match(
    notificationsSrc,
    /activeTypes\.push\(notifId\)/,
    "buildNotifications must push notifId to activeTypes for read tracking"
  );
  assert.match(
    notificationsSrc,
    /title:\s*`Report Released:\s*\$\{report\.reportId/,
    "Notification title must include the released reportId"
  );
  assert.match(
    notificationsSrc,
    /href:\s*`\/reports\/\$\{report\._id\}`/,
    "Notification href must route to the released report view"
  );

  // 4. Lab Manager role in RBAC has both reports.view and reports.release
  const roles = rbacConfig.roleTemplates || [];
  const labManagerRole = roles.find((r) => r.name === "Lab Manager");
  assert.ok(labManagerRole, "Lab Manager role must exist in RBAC config");
  assert.ok(
    labManagerRole.permissions.includes("reports.view"),
    "Lab Manager role must possess reports.view permission"
  );
  assert.ok(
    labManagerRole.permissions.includes("reports.release"),
    "Lab Manager role must possess reports.release permission"
  );

  // 5. Unauthorised roles (e.g. Phlebotomist, Billing Cashier) do not have reports.view
  const phlebotomistRole = roles.find((r) => r.name === "Phlebotomist");
  if (phlebotomistRole) {
    assert.equal(
      phlebotomistRole.permissions.includes("reports.view"),
      false,
      "Phlebotomist should not have reports.view permission"
    );
  }
});
