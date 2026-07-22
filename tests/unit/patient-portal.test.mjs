import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { hashSecret, verifyPassword } from "../../src/app/lib/password.js";
import { hashPatientActivationToken, isValidPortalPin, normalizeDob } from "../../src/app/lib/patient-portal.js";

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
