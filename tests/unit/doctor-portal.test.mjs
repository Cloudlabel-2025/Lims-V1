import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createDoctorInvitation, splitDoctorName } from "../../src/app/lib/doctor-invitation.js";

const root = new URL("../../", import.meta.url);

test("doctor invitations generate a six digit OTP, hash, and future expiry", () => {
  const invitation = createDoctorInvitation();
  assert.match(invitation.otp, /^\d{6}$/);
  assert.match(invitation.otpHash, /^[a-f0-9]{64}$/);
  assert.ok(invitation.expiresAt.getTime() > Date.now());
});

test("doctor names map to required portal user name fields", () => {
  assert.deepEqual(splitDoctorName("Anita Rao"), { firstName: "Anita", lastName: "Rao" });
  assert.deepEqual(splitDoctorName("Anita"), { firstName: "Anita", lastName: "User" });
});

test("doctor portal APIs derive ownership from the authenticated session", async () => {
  const portal = await readFile(new URL("src/app/api/doctor/portal/route.js", root), "utf8");
  const patient = await readFile(new URL("src/app/api/doctor/portal/patients/[id]/route.js", root), "utf8");
  assert.match(portal, /auth\.session\.doctorId/);
  assert.match(portal, /status:\s*"released"/);
  assert.match(patient, /referralDoctor:\s*auth\.session\.doctorId/);
  assert.match(patient, /status:\s*"released"/);
});

test("login uses the explicit user-to-doctor relationship", async () => {
  const login = await readFile(new URL("src/app/api/auth/login/route.js", root), "utf8");
  assert.match(login, /user\.doctorId/);
  assert.doesNotMatch(login, /Doctor\.findOne\(\{ email: user\.email/);
});

test("doctor investor portal validates investor flag and analytics aggregations", async () => {
  const portalSrc = await readFile(new URL("src/app/api/doctor/portal/route.js", root), "utf8");
  const dashboardSrc = await readFile(new URL("src/app/(dashboard)/doctor/dashboard/page.js", root), "utf8");

  // Backend validation: Investor checks, Account balances & monthly trends
  assert.match(portalSrc, /doctor\.doctorType\s*===\s*"Investor"/);
  assert.match(portalSrc, /totals\.revenue\s*-\s*totals\.expense/);
  assert.match(portalSrc, /totals\.asset/);
  assert.match(portalSrc, /totals\.liability/);
  assert.match(portalSrc, /monthlyTrends/);
  assert.match(portalSrc, /investorData/);

  // Frontend validation: Toggle and Investor dashboard view rendering
  assert.match(dashboardSrc, /doctorType\s*===\s*"Investor"/);
  assert.match(dashboardSrc, /viewMode\s*===\s*"investor"/);
  assert.match(dashboardSrc, /tab\s*===\s*"analytics"/);
  assert.match(dashboardSrc, /tab\s*===\s*"lab-accounts"/);
  assert.match(dashboardSrc, /tab\s*===\s*"lab-billings"/);
  assert.match(dashboardSrc, /tab\s*===\s*"all-patients"/);
});
