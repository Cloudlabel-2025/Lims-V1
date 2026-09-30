import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

test("BUG-015: Lab Technician Collect Sample RBAC denial and assignment verification", async (t) => {
  const rbacConfig = JSON.parse(read("src/app/lib/rbac-config.json"));
  const rolesRouteSrc = read("src/app/api/settings/roles/route.js");
  const sampleIdRouteSrc = read("src/app/api/samples/[id]/route.js");
  const samplesPageSrc = read("src/app/(dashboard)/samples/page.js");
  const wizardPageSrc = read("src/app/(dashboard)/samples/wizard/page.js");
  const authMeRouteSrc = read("src/app/api/auth/me/route.js");

  await t.test("1. Default Lab Technician permissions do NOT include 'samples.collect'", () => {
    const techTemplate = rbacConfig.roleTemplates.find((role) => role.name === "Lab Technician");
    assert.ok(techTemplate, "Lab Technician role template must exist in rbac-config.json");
    assert.ok(
      !techTemplate.permissions.includes("samples.collect"),
      "Default Lab Technician permissions must NOT include 'samples.collect'"
    );
    assert.ok(
      techTemplate.permissions.includes("samples.view"),
      "Lab Technician must have 'samples.view' to see specimens"
    );
  });

  await t.test("2. Settings roles API preserves and seeds Lab Technician role", () => {
    assert.match(
      rolesRouteSrc,
      /extraRole\.name === "Lab Technician"/,
      "GET /api/settings/roles must never delete the Lab Technician role"
    );
    assert.match(
      rolesRouteSrc,
      /Role\.findOne\(\{\s*name:\s*"Lab Technician"\s*\}\)/,
      "GET /api/settings/roles must check and seed standard Lab Technician role if missing"
    );
  });

  await t.test("3. Backend samples API rejects unauthorized collection and requires 'samples.collect'", () => {
    assert.match(
      sampleIdRouteSrc,
      /"collect":\s*"samples\.collect"/,
      "actionPermissionMap must map 'collect' action to 'samples.collect'"
    );
    assert.match(
      sampleIdRouteSrc,
      /if\s*\(!hasPermission\(auth\.session,\s*"samples\.collect"\)\)\s*\{\s*return Response\.json\(\s*\{\s*error:\s*"Permission denied:\s*'samples\.collect'/,
      "PUT route must reject unauthorized sample collection with 403 when 'samples.collect' is missing"
    );
    assert.match(
      sampleIdRouteSrc,
      /if\s*\(sample\.status === "registered" && !hasPermission\(auth\.session,\s*"samples\.collect"\)\)/,
      "PUT start-processing must reject registered sample auto-collection when user lacks 'samples.collect'"
    );
    assert.match(
      sampleIdRouteSrc,
      /action:\s*"samples\.collected"/,
      "PUT route must record audit log when sample is collected"
    );
  });

  await t.test("4. Frontend SamplesPage gates registered specimen actions on 'samples.collect'", () => {
    assert.match(
      samplesPageSrc,
      /canCollectSamples\s*=\s*hasPermission\(user,\s*"samples\.collect"\)/,
      "SamplesPage must check 'samples.collect' permission"
    );
    assert.match(
      samplesPageSrc,
      /Collection permission required/,
      "SamplesPage must display 'Collection permission required' when user lacks permission on registered samples"
    );
  });

  await t.test("5. Frontend Wizard gates registered sample collection on 'samples.collect'", () => {
    assert.match(
      wizardPageSrc,
      /canCollectSamples\s*=\s*hasPermission\(user,\s*"samples\.collect"\)/,
      "WizardPage must check 'samples.collect' permission"
    );
    assert.match(
      wizardPageSrc,
      /Access Denied:.*?permission to collect samples/,
      "WizardPage must render Access Denied message when registered sample is accessed without 'samples.collect'"
    );
  });

  await t.test("6. Auth Me route synchronizes live role permissions and refreshes token cookie", () => {
    assert.match(
      authMeRouteSrc,
      /livePermissions\s*=\s*activeRole\.permissions/,
      "GET /api/auth/me must read live permissions from active role in database"
    );
    assert.match(
      authMeRouteSrc,
      /setSessionCookie\(response,\s*newToken/,
      "GET /api/auth/me must re-issue session cookie when role permissions are updated"
    );
  });
});
