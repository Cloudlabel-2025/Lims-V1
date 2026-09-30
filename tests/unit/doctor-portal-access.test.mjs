import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

test("BUG-008: Doctor Portal Access and Referred Patient Report Visibility", async (t) => {
  const doctorRouteSrc = read("src/app/api/doctor/route.js");
  const doctorByIdRouteSrc = read("src/app/api/doctor/[id]/route.js");
  const doctorSidebarSrc = read("src/app/(dashboard)/doctors/DoctorSidebar.js");
  const settingsRolesSrc = read("src/app/api/settings/roles/route.js");
  const authLoginSrc = read("src/app/api/auth/login/route.js");
  const clientRbacSrc = read("src/app/lib/client-rbac.js");
  const doctorPortalRouteSrc = read("src/app/api/doctor/portal/route.js");
  const doctorPatientRouteSrc = read("src/app/api/doctor/portal/patients/[id]/route.js");
  const reportsRouteSrc = read("src/app/api/reports/route.js");
  const reportByIdRouteSrc = read("src/app/api/reports/[id]/route.js");

  await t.test("Part A: Doctor commission percentage is preserved and displayed", () => {
    // 1. GET /api/doctor must not strip -commission when user lacks accounts.view
    assert.doesNotMatch(
      doctorRouteSrc,
      /-commission\s+-pendingPayout/,
      "GET /api/doctor must not omit -commission when lacking accounts.view"
    );
    assert.match(
      doctorRouteSrc,
      /selectFields\s*=\s*canViewFinancials\s*\?\s*null\s*:\s*"-pendingPayout"/,
      "GET /api/doctor should only omit -pendingPayout if financial permissions are missing"
    );

    // 2. GET /api/doctor/[id] must not strip -commission
    assert.doesNotMatch(
      doctorByIdRouteSrc,
      /-commission\s+-pendingPayout/,
      "GET /api/doctor/[id] must not omit -commission when lacking accounts.view"
    );

    // 3. DoctorSidebar displays the doctor commission percentage
    assert.match(
      doctorSidebarSrc,
      /doctor\.commission\s*(?:\?\?|\|\|)\s*0\}%/,
      "DoctorSidebar must render doctor commission percentage with fallback"
    );
  });

  await t.test("Part B: Doctor roles are excluded from general Roles & Permissions area", () => {
    // 1. Helper function exists to identify doctor roles
    assert.match(
      settingsRolesSrc,
      /function\s+isDoctorRole\(name\)/,
      "settings/roles must define an isDoctorRole helper"
    );

    // 2. GET /api/settings/roles excludes doctor roles
    assert.match(
      settingsRolesSrc,
      /\.filter\(\(role\)\s*=>\s*!isDoctorRole\(role\.name\)\)/,
      "GET /api/settings/roles must filter out doctor roles from the returned list"
    );

    // 3. PATCH /api/settings/roles ignores incoming doctor roles to protect them
    assert.match(
      settingsRolesSrc,
      /isDoctorRole\(name\)\)\s*continue/,
      "PATCH /api/settings/roles must skip modifying doctor roles via staff matrix"
    );

    // 4. DELETE /api/settings/roles protects doctor roles from deletion
    assert.match(
      settingsRolesSrc,
      /isDoctorRole\(role\.name\)/,
      "DELETE /api/settings/roles must prevent deletion of doctor roles"
    );
  });

  await t.test("Part C: Doctor authentication, Doctor ID resolution, and portal permissions", () => {
    // 1. Login route resolves tenant from body.tenantId or body.subdomain
    assert.match(
      authLoginSrc,
      /resolveTenantId\(req,\s*body\.tenantId\s*\|\|\s*body\.subdomain\)/,
      "POST /api/auth/login must support subdomain as tenant fallback"
    );

    // 2. Login route resolves Doctor ID to portal user account
    assert.match(
      authLoginSrc,
      /doctorByCode\s*=\s*await\s+Doctor\.findOne\(\{\s*doctorId:\s*normalizedLoginId\.toUpperCase\(\)\s*\}\)/,
      "POST /api/auth/login must check Doctor model when loginId is a Doctor ID"
    );

    // 3. Session token automatically receives doctor-portal.access and reports.view
    assert.match(
      authLoginSrc,
      /Array\.from\(new\s+Set\(\["doctor-portal\.access",\s*"reports\.view"/,
      "createSessionToken must automatically include doctor-portal.access and reports.view for doctors"
    );

    // 4. Doctor accounts are allowed access to /dashboard and /doctor/* in client RBAC
    assert.match(
      clientRbacSrc,
      /if\s*\(user\?\.doctorId\s*&&\s*\(pathname\s*===\s*"\/dashboard"\s*\|\|\s*pathname\?\.startsWith\("\/doctor\/"\)\)\)/,
      "canAccessPath must permit doctor accounts to access /dashboard and /doctor/*"
    );
  });

  await t.test("Part D: Doctor portal strictly scopes patients and released reports", () => {
    // 1. Doctor portal route queries reports with status: 'released'
    assert.match(
      doctorPortalRouteSrc,
      /status:\s*"released"/,
      "Doctor portal route must strictly filter reports by status: 'released'"
    );

    // 2. Doctor portal reports query is scoped to doctor's own referred patient IDs or bill IDs
    assert.match(
      doctorPortalRouteSrc,
      /billingRecord:\s*\{\s*\$in:\s*billIds\s*\}/,
      "Doctor portal reports must be restricted to the doctor's own referral bill IDs"
    );

    // 3. Referral patient route checks referral ownership and scopes reports to released
    assert.match(
      doctorPatientRouteSrc,
      /isReferredByName\s*&&\s*bills\.length\s*===\s*0/,
      "Referral patient route must verify referral via doctor name or billing record"
    );
    assert.match(
      doctorPatientRouteSrc,
      /status:\s*"released"/,
      "Referral patient route must restrict report results to status: 'released'"
    );

    // 4. General /api/reports route scopes doctor sessions to released reports for referred patients
    assert.match(
      reportsRouteSrc,
      /query\.status\s*=\s*"released"/,
      "GET /api/reports must enforce status: 'released' for doctor sessions"
    );

    // 5. Direct report lookup /api/reports/[id] blocks unreleased reports for doctors
    assert.match(
      reportByIdRouteSrc,
      /if\s*\(report\.status\s*!==\s*"released"\)/,
      "GET /api/reports/[id] must reject unreleased reports when viewed by a doctor"
    );
  });
});
