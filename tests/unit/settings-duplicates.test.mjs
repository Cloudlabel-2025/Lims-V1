import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

test("tenant role and user IDs skip stale counter collisions", () => {
  const roleModel = read("src/app/models/tenant/Role.js");
  const userModel = read("src/app/models/tenant/User.js");

  assert.match(roleModel, /getNextAvailableRoleId/);
  assert.match(roleModel, /Role\.exists\(\{ roleId \}\)/);
  assert.match(userModel, /getNextAvailableUserId/);
  assert.match(userModel, /User\.exists\(\{ userId \}\)/);
});

test("staff users do not collide on blank doctor portal ownership", () => {
  const userModel = read("src/app/models/tenant/User.js");
  const usersRoute = read("src/app/api/settings/users/route.js");

  assert.doesNotMatch(userModel, /doctorId:[\s\S]*default:\s*null/);
  assert.match(userModel, /partialFilterExpression:\s*\{ doctorId:\s*\{ \$type:\s*"objectId" \} \}/);
  assert.match(userModel, /ensureUserDoctorIdIndex/);
  assert.match(userModel, /updateMany\(\{ doctorId:\s*null \},\s*\{ \$unset:\s*\{ doctorId:\s*"" \} \}/);
  assert.match(usersRoute, /await ensureUserDoctorIdIndex\(User\)/);
});

test("settings APIs report duplicate conflicts by the actual unique field", () => {
  const rolesRoute = read("src/app/api/settings/roles/route.js");
  const usersRoute = read("src/app/api/settings/users/route.js");

  assert.match(rolesRoute, /duplicateRoleMessage/);
  assert.match(rolesRoute, /protected system role/);
  assert.match(rolesRoute, /Role ID sequence conflict/);
  assert.match(usersRoute, /duplicateUserMessage/);
  assert.match(usersRoute, /User ID sequence conflict/);
  assert.match(usersRoute, /doctor portal/);
});

test("user assignment separates staff users from doctor portal users", () => {
  const usersRoute = read("src/app/api/settings/users/route.js");
  const userManager = read("src/app/(dashboard)/settings/UserManager.js");
  const userPage = read("src/app/(dashboard)/users/page.js");
  const staffUserPage = read("src/app/(dashboard)/users/list/page.js");
  const doctorPortalPage = read("src/app/(dashboard)/users/doctor-portal/page.js");

  assert.match(usersRoute, /staffUserQuery/);
  assert.match(usersRoute, /doctorPortalQuery/);
  assert.match(usersRoute, /doctorPortalUsers/);
  assert.match(userManager, /User List/);
  assert.match(userManager, /Doctor Portal Users/);
  assert.match(userManager, /listMode = "tabs"/);
  assert.match(userPage, /href="\/users\/list"/);
  assert.match(userPage, /href="\/users\/doctor-portal"/);
  assert.match(userPage, /resendDoctorInvitation/);
  assert.match(staffUserPage, /listMode="staff"/);
  assert.match(doctorPortalPage, /listMode="doctorPortal"/);
});
