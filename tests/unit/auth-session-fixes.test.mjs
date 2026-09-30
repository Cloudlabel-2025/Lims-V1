import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

test("Authentication & Session: BUG-010, BUG-011", async (t) => {
  const resetPasswordRouteSrc = read("src/app/api/auth/reset-password/route.js");
  const loginPageSrc = read("src/app/components/LoginPage.js");

  await t.test("BUG-010: Reset token reuse and same-password check", () => {
    // 1. Password cannot be same as current password
    assert.match(
      resetPasswordRouteSrc,
      /comparePassword\(password,\s*user\.passwordHash\)/,
      "reset-password route must compare new password with existing password hash"
    );
    assert.match(
      resetPasswordRouteSrc,
      /error:\s*"New password cannot be the same as your current password"/,
      "reset-password route must reject identical new password"
    );

    // 2. Token hash is completely cleared
    assert.match(
      resetPasswordRouteSrc,
      /user\.passwordResetTokenHash\s*=\s*null/,
      "passwordResetTokenHash must be cleared to null upon reset"
    );
  });

  await t.test("BUG-011: Session expiry notification on login page", () => {
    assert.match(
      loginPageSrc,
      /params\.get\("expired"\)/,
      "LoginPage must inspect expired query parameter"
    );
    assert.match(
      loginPageSrc,
      /Your session has expired\. Please sign in again\./,
      "LoginPage must display session expired message"
    );
  });
});
