import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../", import.meta.url);

test("report GET endpoint resolves username and role from identifier", async () => {
  const detailRouteSrc = await readFile(new URL("src/app/api/reports/[id]/route.js", root), "utf8");

  // Verify that it populates the User model
  assert.match(detailRouteSrc, /const\s*\{\s*TestReport,\s*BillingRecord,\s*User\s*\}\s*=\s*await\s*getTenantModels/);
  
  // Verify that it converts report to a plain object
  assert.match(detailRouteSrc, /const\s+report\s*=\s*reportDoc\.toObject\(\);/);
  
  // Verify that the resolver helper checks user and role
  assert.match(detailRouteSrc, /const\s+resolveNameAndRole\s*=\s*async/);
  assert.match(detailRouteSrc, /User\.findOne\(query\)\.populate\("role"\)\.lean\(\)/);
  assert.match(detailRouteSrc, /userDoc\.role\?\.name/);

  // Verify that it assigns resolved signature properties
  assert.match(detailRouteSrc, /report\.reviewedBy\s*=\s*await\s*resolveNameAndRole\(report\.reviewedBy\);/);
  assert.match(detailRouteSrc, /report\.approvedBy\s*=\s*await\s*resolveNameAndRole\(report\.approvedBy\);/);
  assert.match(detailRouteSrc, /report\.releasedBy\s*=\s*await\s*resolveNameAndRole\(report\.releasedBy\);/);
});

test("report status PATCH transitions save formatted displayName containing name and role", async () => {
  const detailRouteSrc = await readFile(new URL("src/app/api/reports/[id]/route.js", root), "utf8");

  // Verify that it constructs a displayName from name and roleName in auth.session
  assert.match(detailRouteSrc, /let\s+displayName\s*=\s*"Unknown";/);
  assert.match(detailRouteSrc, /auth\.session\.name/);
  assert.match(detailRouteSrc, /auth\.session\.roleName\s*\?\s*`\$\{auth\.session\.name\}\s*\(\$\{auth\.session\.roleName\}\)`/);
  
  // Verify that it sets the reports status fields to displayName
  assert.match(detailRouteSrc, /report\.reviewedBy\s*=\s*displayName;/);
  assert.match(detailRouteSrc, /report\.approvedBy\s*=\s*displayName;/);
  assert.match(detailRouteSrc, /report\.releasedBy\s*=\s*displayName;/);
});
