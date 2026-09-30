import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");

test("BUG-022 (DL2036) - Doctor duplicate email blocked at schema and API levels", () => {
  const schemaPath = path.join(rootDir, "src/app/models/tenant/Doctor.js");
  const schemaContent = fs.readFileSync(schemaPath, "utf-8");
  assert.ok(
    schemaContent.includes("unique: true") && schemaContent.includes("email:"),
    "Doctor model schema must enforce unique constraint on email"
  );

  const routePath = path.join(rootDir, "src/app/api/doctor/route.js");
  const routeContent = fs.readFileSync(routePath, "utf-8");
  assert.ok(
    routeContent.includes("existingDoctorEmail") && routeContent.includes("409"),
    "POST /api/doctor must check for duplicate email and return 409"
  );
  assert.ok(
    routeContent.includes("escapeRegex") || routeContent.includes("emailRegex"),
    "POST /api/doctor must do case-insensitive duplicate check"
  );

  const editRoutePath = path.join(rootDir, "src/app/api/doctor/[id]/route.js");
  const editRouteContent = fs.readFileSync(editRoutePath, "utf-8");
  assert.ok(
    editRouteContent.includes("duplicateEmail") && editRouteContent.includes("$ne: id"),
    "PUT /api/doctor/[id] must check for duplicate email across other doctors and return 409"
  );
});

test("BUG-023 (DL2039) - Resend invitation generates fresh OTP and allows active account credential reset", () => {
  const resendRoutePath = path.join(rootDir, "src/app/api/doctor/[id]/resend-invitation/route.js");
  const resendRouteContent = fs.readFileSync(resendRoutePath, "utf-8");
  
  // Must NOT block with "This portal already has an active account"
  assert.ok(
    !resendRouteContent.includes("This portal account is already active"),
    "Resend invitation must not reject active accounts with 409"
  );

  // Must overwrite passwordResetTokenHash with newly generated OTP hash
  assert.ok(
    resendRouteContent.includes("user.passwordResetTokenHash = invitation.otpHash"),
    "Resend invitation must overwrite passwordResetTokenHash with new OTP hash to invalidate previous OTPs"
  );
});

test("BUG-026 (DL2044) - Payout approval requires accounts.manage and writes audit log", () => {
  const payoutRoutePath = path.join(rootDir, "src/app/api/doctor/payout/route.js");
  const payoutRouteContent = fs.readFileSync(payoutRoutePath, "utf-8");

  assert.ok(
    payoutRouteContent.includes('requireTenantSession(req, "accounts.manage")'),
    "POST /api/doctor/payout must require accounts.manage permission for payout approval"
  );

  assert.ok(
    payoutRouteContent.includes("writeAuditLog") &&
    payoutRouteContent.includes("doctor_payout.approved"),
    "POST /api/doctor/payout must record doctor_payout.approved in audit log"
  );
});

test("BUG-027 (DL2046) - Doctor delete protection safely archives doctors with referrals and audits action", () => {
  const doctorRoutePath = path.join(rootDir, "src/app/api/doctor/[id]/route.js");
  const doctorRouteContent = fs.readFileSync(doctorRoutePath, "utf-8");

  // Referral check
  assert.ok(
    doctorRouteContent.includes("BillingRecord.exists") && doctorRouteContent.includes("hasReferrals"),
    "DELETE /api/doctor/[id] must check for existing patient or billing referrals"
  );

  // Safe archival
  assert.ok(
    doctorRouteContent.includes('doctor.status = "Archived"') && doctorRouteContent.includes("isDeleted = true"),
    "DELETE /api/doctor/[id] must safely archive doctors with referrals instead of hard deleting"
  );

  // Audit trail
  assert.ok(
    doctorRouteContent.includes("doctors.archived") && doctorRouteContent.includes("doctors.deleted"),
    "DELETE /api/doctor/[id] must write audit logs for both archiving and deleting"
  );
});
