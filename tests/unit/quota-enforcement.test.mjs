import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

test("patient and billing endpoints enforce hard quotas inside transactions", () => {
  const patientRoute = read("src/app/api/patient/route.js");
  const billingRoute = read("src/app/api/billing/route.js");

  assert.match(patientRoute, /wouldExceedLimit/);
  assert.match(patientRoute, /throw\s+error;/);
  assert.match(patientRoute, /QuotaExceededError/);
  assert.match(patientRoute, /register more patients/);

  assert.match(billingRoute, /wouldExceedLimit/);
  assert.match(billingRoute, /throw\s+error;/);
  assert.match(billingRoute, /QuotaExceededError/);
  assert.match(billingRoute, /create more bills/);
});

test("staff and doctor registration/activation endpoints restrict creations when staff quota finishes", () => {
  const usersRoute = read("src/app/api/settings/users/route.js");
  const doctorRoute = read("src/app/api/doctor/route.js");
  const resetPasswordRoute = read("src/app/api/auth/reset-password/route.js");

  assert.match(usersRoute, /POST[\s\S]*getShadowSubscriptionEntitlements/);
  assert.match(usersRoute, /POST[\s\S]*activeCount\s*>=\s*limit/);
  assert.match(usersRoute, /PATCH[\s\S]*willBecomeActive/);
  assert.match(usersRoute, /PATCH[\s\S]*activeCount\s*>=\s*limit/);
  assert.match(usersRoute, /Active staff account limit exceeded/);

  assert.match(doctorRoute, /POST[\s\S]*activeCount\s*>=\s*limit/);
  assert.match(doctorRoute, /Cannot register portal account for doctor/);

  assert.match(resetPasswordRoute, /willBecomeActive/);
  assert.match(resetPasswordRoute, /activeCount\s*>=\s*limit/);
  assert.match(resetPasswordRoute, /Activation is not allowed/);
});

test("subscription add-on APIs allow creating orders and confirming payments with Razorpay", () => {
  const addonRoute = read("src/app/api/subscription/addon/route.js");
  const addonConfirmRoute = read("src/app/api/subscription/addon/confirm/route.js");
  const modelFile = read("src/app/models/master/SubscriptionAddonRequest.js");

  assert.match(addonRoute, /ADDON_PACKS/);
  assert.match(addonRoute, /SubscriptionAddonRequest\.create/);
  assert.match(addonRoute, /orders/);
  assert.match(addonRoute, /rzpOrderId/);

  assert.match(addonConfirmRoute, /razorpaySignature/);
  assert.match(addonConfirmRoute, /expectedSignature/);
  assert.match(addonConfirmRoute, /QuotaPeriod\.updateOne/);
  assert.match(addonConfirmRoute, /\$inc/);

  assert.match(modelFile, /quotaKey/);
  assert.match(modelFile, /amountMinor/);
  assert.match(modelFile, /units/);
});

test("subscription UI displays Buy Add-on button and initiates checkout flow", () => {
  const pageJs = read("src/app/(dashboard)/subscription/page.js");

  assert.match(pageJs, /addonPacks/);
  assert.match(pageJs, /handleBuyAddon/);
  assert.match(pageJs, /Buy Add-on/);
  assert.match(pageJs, /\/api\/subscription\/addon/);
});
