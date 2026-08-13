import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), "utf8");

test("password fields restore their controlled type after DOM mutations", () => {
  const guard = read("src/app/lib/use-password-type-guard.js");
  const login = read("src/app/components/LoginPage.js");
  const passwordField = read("src/app/components/PasswordField.js");

  assert.match(guard, /new MutationObserver\(restoreProtectedAttributes\)/);
  assert.match(guard, /attributeFilter:\s*\["type", "value"\]/);
  assert.match(guard, /input\.setAttribute\("type", expectedType\)/);
  assert.match(guard, /input\.removeAttribute\("value"\)/);
  assert.match(login, /const passwordVisible = showPassword/);
  assert.match(login, /usePasswordTypeGuard\(passwordInputRef, passwordVisible\)/);
  assert.doesNotMatch(login, /\{!isTenantLogin && \(/);
  assert.match(login, /aria-label=\{showPassword \? "Hide password" : "Show password"\}/);
  assert.match(passwordField, /usePasswordTypeGuard\(inputRef, visible\)/);
});
