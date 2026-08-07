import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { hashSecret, verifyPassword } from "../../src/app/lib/password.js";
import { hashPatientActivationToken, isValidPortalPin, normalizeDob, generateMobileOtp, hashOtpToken, buildWhatsAppShareUrl } from "../../src/app/lib/patient-portal.js";

const root = new URL("../../", import.meta.url);

test("patient access tokens hash deterministically without storing the token", () => {
  assert.equal(hashPatientActivationToken("sample-token"), hashPatientActivationToken("sample-token"));
  assert.notEqual(hashPatientActivationToken("sample-token"), hashPatientActivationToken("other-token"));
});

test("patient portal accepts only four-digit private PINs", () => {
  assert.equal(isValidPortalPin("1234"), true);
  assert.equal(isValidPortalPin("123"), false);
  assert.equal(isValidPortalPin("12a4"), false);
});

test("short patient PINs use scrypt without weakening staff password policy", async () => {
  const hash = await hashSecret("1234");
  assert.equal(await verifyPassword("1234", hash), true);
  assert.equal(await verifyPassword("9999", hash), false);
});

test("date of birth comparison uses stable calendar dates", () => {
  assert.equal(normalizeDob("2000-05-10"), "2000-05-10");
  assert.equal(normalizeDob("invalid"), "");

  // Test collision resolution for patients sharing the same phone number
  const patients = [
    { name: "Father", phone: "9876543210", dob: new Date("1970-01-15") },
    { name: "Son", phone: "9876543210", dob: new Date("2005-08-25") },
  ];

  const matchedSon = patients.find(p => normalizeDob(p.dob) === normalizeDob("2005-08-25"));
  assert.equal(matchedSon?.name, "Son");

  const matchedFather = patients.find(p => normalizeDob(p.dob) === normalizeDob("1970-01-15"));
  assert.equal(matchedFather?.name, "Father");
});

test("patient portal data endpoint exposes released reports without commission fields", async () => {
  const source = await readFile(new URL("src/app/api/patient-portal/me/route.js", root), "utf8");
  assert.match(source, /status:\s*"released"/);
  assert.match(source, /requirePatientSession/);
  assert.doesNotMatch(source, /commissionAmount|commissionJournalEntryId|pendingPayout/);
});

test("patient access slip issuance requires staff patient-registration permission", async () => {
  const source = await readFile(new URL("src/app/api/patient/[id]/portal-access/route.js", root), "utf8");
  assert.match(source, /requireTenantSession\(req, "patients\.register"\)/);
});

test("mobile OTP generator produces 6-digit codes and hashes", () => {
  const { otp, otpHash, expiresAt } = generateMobileOtp();
  assert.equal(/^\d{6}$/.test(otp), true);
  assert.equal(hashOtpToken(otp), otpHash);
  assert.equal(expiresAt instanceof Date, true);

  const waUrl = buildWhatsAppShareUrl("mega", "http://localhost", "John Doe", "9876543210", "http://localhost/link");
  assert.match(waUrl, /https:\/\/api\.whatsapp\.com\/send\?phone=919876543210/);
  assert.match(waUrl, /John%20Doe/);
});

test("OTP and token authentication endpoints check patient portal package entitlement", async () => {
  const sendOtpSrc = await readFile(new URL("src/app/api/patient-portal/send-otp/route.js", root), "utf8");
  const verifyOtpSrc = await readFile(new URL("src/app/api/patient-portal/verify-otp/route.js", root), "utf8");
  const tokenLoginSrc = await readFile(new URL("src/app/api/patient-portal/token-login/route.js", root), "utf8");

  assert.match(sendOtpSrc, /hasPatientPortalEntitlement\(subscription\)/);
  assert.match(verifyOtpSrc, /hasPatientPortalEntitlement\(subscription\)/);
  assert.match(tokenLoginSrc, /hasPatientPortalEntitlement\(subscription\)/);
});

test("patient registration and login enforce direct credentials flow and sharing constraints", async () => {
  const registerSrc = await readFile(new URL("src/app/api/patient/route.js", root), "utf8");
  const updateSrc = await readFile(new URL("src/app/api/patient/[id]/route.js", root), "utf8");
  const loginSrc = await readFile(new URL("src/app/api/patient-portal/login/route.js", root), "utf8");

  // Validate registration constraints
  assert.match(registerSrc, /existingPatients\.length\s*>=\s*2/);
  assert.match(registerSrc, /"Maximum of 2 patients can share the same mobile number/);
  assert.match(registerSrc, /normalizeDob\(p\.dob\)\s*===\s*inputDobNormalized/);
  assert.match(registerSrc, /"A patient with this mobile number and date of birth is already registered/);

  // Validate update constraints
  assert.match(updateSrc, /existingPatientsSharingPhone\.length\s*>=\s*2/);
  assert.match(updateSrc, /"Maximum of 2 patients can share the same mobile number/);

  // Validate login matching phone and dob credentials
  assert.match(loginSrc, /body\.phone\s*\|\|\s*body\.username/);
  assert.match(loginSrc, /body\.dob\s*\|\|\s*body\.password/);
  assert.match(loginSrc, /normalizeDob\(p\.dob\)\s*===\s*dob/);
});


