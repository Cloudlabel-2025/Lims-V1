import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildEntitlementSnapshot,
  calculateQuotaState,
  defaultSubscriptionPackages,
  getCalendarMonthPeriod,
  mapLegacyPlanToPackageKey,
  resolvePackageModules,
} from "../../src/app/lib/subscription-catalog.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("default subscription packages expose increasing patient and billing allowances", () => {
  assert.deepEqual(defaultSubscriptionPackages.map((pkg) => pkg.key), ["basic", "standard", "premium"]);
  const [basic, standard, premium] = defaultSubscriptionPackages;
  assert.ok(basic.quotas.patientRegistrations < standard.quotas.patientRegistrations);
  assert.ok(standard.quotas.patientRegistrations < premium.quotas.patientRegistrations);
  assert.ok(basic.quotas.billingRecords < standard.quotas.billingRecords);
  assert.ok(standard.quotas.billingRecords < premium.quotas.billingRecords);
  assert.ok(defaultSubscriptionPackages.every((pkg) => pkg.pricing.currency === "INR"));
  assert.ok(defaultSubscriptionPackages.every((pkg) => pkg.releaseVersion === "1.0"));
});

test("legacy plans map to the new commercial packages", () => {
  assert.equal(mapLegacyPlanToPackageKey("basic"), "basic");
  assert.equal(mapLegacyPlanToPackageKey("professional"), "standard");
  assert.equal(mapLegacyPlanToPackageKey("trial"), "standard");
  assert.equal(mapLegacyPlanToPackageKey("enterprise"), "premium");
  assert.equal(mapLegacyPlanToPackageKey("premium"), "premium");
});

test("entitlement snapshots preserve explicit lab module overrides and require dashboard", () => {
  const snapshot = buildEntitlementSnapshot(defaultSubscriptionPackages[0], {
    modulesOverride: ["patients", "billing"],
  });
  assert.deepEqual(snapshot.modules, ["dashboard", "patients", "billing"]);
  assert.equal(snapshot.quotas.patientRegistrations, 250);
  assert.equal(snapshot.quotas.billingRecords, 500);
});

test("package module selection automatically includes required workflow dependencies", () => {
  assert.deepEqual(resolvePackageModules(["reports"]), [
    "dashboard",
    "patients",
    "tests",
    "samples",
    "reports",
  ]);
  assert.deepEqual(resolvePackageModules(["accounts"]), [
    "dashboard",
    "patients",
    "tests",
    "billing",
    "accounts",
  ]);
});

test("developer package API supports explicitly versioned individual packages", () => {
  const packageRoute = fs.readFileSync(
    path.join(rootDir, "src/app/api/developer/subscription-packages/route.js"),
    "utf8"
  );

  assert.match(packageRoute, /export async function POST/);
  assert.match(packageRoute, /export async function PATCH/);
  assert.match(packageRoute, /validReleaseVersion/);
  assert.match(packageRoute, /expectedRevision/);
  assert.doesNotMatch(packageRoute, /pkg\.versions\.push/);
  assert.match(packageRoute, /Monthly package price is required/);
  assert.match(packageRoute, /SubscriptionPackage\.collection\.updateOne/);
  assert.match(packageRoute, /versions\.\$\{versionIndex\}\.pricing/);
  assert.match(packageRoute, /monthlyAmountMinor/);
  assert.match(packageRoute, /annualAmountMinor/);
});

test("calendar usage periods use an exclusive next-month boundary", () => {
  const period = getCalendarMonthPeriod(new Date("2026-12-15T12:00:00.000Z"));
  assert.equal(period.key, "2026-12");
  assert.equal(period.start.toISOString(), "2026-12-01T00:00:00.000Z");
  assert.equal(period.end.toISOString(), "2027-01-01T00:00:00.000Z");
});

test("quota state reports remaining capacity and shadow overages", () => {
  const below = calculateQuotaState({ included: 250, addOn: 100, consumed: 249, reserved: 1 });
  assert.equal(below.effectiveLimit, 350);
  assert.equal(below.remaining, 100);
  assert.equal(below.overLimit, false);

  const above = calculateQuotaState({ included: 250, addOn: 0, consumed: 251, reserved: 0 });
  assert.equal(above.remaining, 0);
  assert.equal(above.overLimit, true);
  assert.equal(above.utilizationPercent, 100.4);
});

test("patient and billing creation meter usage inside their existing transactions", () => {
  const patientRoute = fs.readFileSync(path.join(rootDir, "src/app/api/patient/route.js"), "utf8");
  const billingRoute = fs.readFileSync(path.join(rootDir, "src/app/api/billing/route.js"), "utf8");

  for (const [source, quotaKey] of [
    [patientRoute, "patientRegistrations"],
    [billingRoute, "billingRecords"],
  ]) {
    assert.match(source, /connection\.transaction/);
    assert.match(source, /recordShadowUsage/);
    assert.match(source, new RegExp(`quotaKey:\\s*"${quotaKey}"`));
    assert.match(source, /session,/);
  }
});

test("subscription and quota models enforce unique assignment and idempotency keys", () => {
  const labSubscription = fs.readFileSync(
    path.join(rootDir, "src/app/models/master/LabSubscription.js"),
    "utf8"
  );
  const quotaPeriod = fs.readFileSync(path.join(rootDir, "src/app/models/tenant/QuotaPeriod.js"), "utf8");
  const quotaEvent = fs.readFileSync(path.join(rootDir, "src/app/models/tenant/QuotaUsageEvent.js"), "utf8");
  const subscriptionPackage = fs.readFileSync(
    path.join(rootDir, "src/app/models/master/SubscriptionPackage.js"),
    "utf8"
  );

  assert.match(labSubscription, /tenantId:[\s\S]*unique:\s*true/);
  assert.match(quotaPeriod, /tenantId:\s*1,\s*periodKey:\s*1[\s\S]*unique:\s*true/);
  assert.match(quotaEvent, /idempotencyKey:[\s\S]*unique:\s*true/);
  assert.match(subscriptionPackage, /monthlyAmountMinor:[\s\S]*annualAmountMinor/);
});

test("lab creation and editing require an active catalog package", () => {
  const createRoute = fs.readFileSync(path.join(rootDir, "src/app/api/developer/labs/route.js"), "utf8");
  const editRoute = fs.readFileSync(
    path.join(rootDir, "src/app/api/developer/labs/[tenantId]/route.js"),
    "utf8"
  );

  for (const source of [createRoute, editRoute]) {
    assert.match(source, /getSubscriptionPackageDefinition\(body\.packageKey\)/);
    assert.match(source, /packageKey:\s*selectedPackage\.key/);
    assert.match(source, /enabledModules\s*=\s*normalizeEnabledModules\(selectedPackage\.modules\)/);
  }
});

test("new labs receive default tests and inventory only when requested", () => {
  const createRoute = fs.readFileSync(path.join(rootDir, "src/app/api/developer/labs/route.js"), "utf8");
  const createPage = fs.readFileSync(path.join(rootDir, "src/app/developer/labs/create/page.js"), "utf8");

  assert.match(createRoute, /import \{ seedDefaultTests \} from "@\/app\/lib\/test-seeder"/);
  assert.match(createRoute, /import \{ seedDefaultInventory \} from "@\/app\/lib\/inventory-seeder"/);
  assert.match(createRoute, /const shouldSeedDefaultTests = body\.seedDefaultTests === true/);
  assert.match(createRoute, /const shouldSeedDefaultInventory = body\.seedDefaultInventory === true/);
  assert.match(createRoute, /if \(shouldSeedDefaultTests\) \{[\s\S]*await seedDefaultTests\(tenantConnection\)/);
  assert.match(createRoute, /if \(shouldSeedDefaultInventory\) \{[\s\S]*await seedDefaultInventory\(tenantConnection\)/);
  assert.match(createPage, /seedDefaultTests: false/);
  assert.match(createPage, /seedDefaultInventory: false/);
  assert.match(createPage, /Select the default data this lab needs/);
  assert.match(createPage, /Confirm Selection/);
  assert.match(createPage, /No, Keep Empty/);
});

test("existing labs can add default tests and inventory independently", () => {
  const editRoute = fs.readFileSync(
    path.join(rootDir, "src/app/api/developer/labs/[tenantId]/route.js"),
    "utf8"
  );
  const seedRoute = fs.readFileSync(
    path.join(rootDir, "src/app/api/developer/labs/[tenantId]/seed-defaults/route.js"),
    "utf8"
  );
  const editPage = fs.readFileSync(
    path.join(rootDir, "src/app/developer/labs/[id]/edit/page.js"),
    "utf8"
  );
  const labModel = fs.readFileSync(path.join(rootDir, "src/app/models/master/Lab.js"), "utf8");

  assert.match(seedRoute, /export async function POST/);
  assert.match(seedRoute, /if \(seedTests\) \{[\s\S]*await seedDefaultTests\(tenantConnection\)/);
  assert.match(seedRoute, /if \(seedInventory\) \{[\s\S]*await seedDefaultInventory\(tenantConnection\)/);
  assert.match(seedRoute, /statusUpdate\["defaultData\.tests\.seeded"\] = true/);
  assert.match(seedRoute, /statusUpdate\["defaultData\.inventory\.seeded"\] = true/);
  assert.match(seedRoute, /Lab\.collection\.updateOne/);
  assert.match(labModel, /existingModel\.schema\.add\(\{ defaultData: defaultDataDefinition \}\)/);
  assert.match(editRoute, /tests: Boolean\(lab\.defaultData\?\.tests\?\.seeded\)/);
  assert.match(editRoute, /inventory: Boolean\(lab\.defaultData\?\.inventory\?\.seeded\)/);
  assert.match(editRoute, /await backfillDefaultDataStatus\(lab\)/);
  assert.match(editRoute, /hasAllDefaultTests\(tenantConnection\)/);
  assert.match(editRoute, /hasAllDefaultInventory\(tenantConnection\)/);
  assert.match(editPage, /Add Default Data/);
  assert.match(editPage, /existing records/);
  assert.match(editPage, /setSeededDefaults\(data\.lab\.seededDefaults/);
  assert.match(editPage, /\/seed-defaults/);
  assert.match(editPage, /Seeding Default Data\.\.\./);
  assert.match(editPage, /Confirm And Seed Now/);
  assert.match(editPage, /developer-seed-status-grid/);
  assert.match(editPage, /Default data added/);
});

test("tenant subscription experience exposes usage and notification thresholds", () => {
  const tenantRoute = fs.readFileSync(path.join(rootDir, "src/app/api/subscription/route.js"), "utf8");
  const notificationRules = fs.readFileSync(path.join(rootDir, "src/app/lib/notifications.js"), "utf8");
  const sidebar = fs.readFileSync(path.join(rootDir, "src/app/components/Sidebar.js"), "utf8");

  assert.match(tenantRoute, /serializeQuotaPeriod/);
  assert.match(tenantRoute, /packageName/);
  assert.match(notificationRules, /utilizationPercent < 80/);
  assert.match(notificationRules, /subscription-assigned/);
  assert.match(notificationRules, /href:\s*"\/subscription"/);
  assert.match(sidebar, /Subscription & Usage/);
});

test("tenant upgrades expose only Version 1 packages and require developer review", () => {
  const tenantRoute = fs.readFileSync(path.join(rootDir, "src/app/api/subscription/route.js"), "utf8");
  const reviewRoute = fs.readFileSync(
    path.join(rootDir, "src/app/api/developer/subscription-upgrades/route.js"),
    "utf8"
  );
  const tenantPage = fs.readFileSync(path.join(rootDir, "src/app/(dashboard)/subscription/page.js"), "utf8");

  assert.match(tenantRoute, /\["1", "1\.0"\]/);
  assert.match(tenantRoute, /value \|\| "1\.0"/);
  assert.match(tenantRoute, /filter\(\(pkg\) => isVersionOne\(pkg\.releaseVersion\)\)/);
  assert.match(tenantRoute, /slice\(0, 3\)/);
  assert.match(tenantRoute, /releaseVersion:\s*"1"/);
  assert.match(tenantPage, /Version 1/);
  assert.match(tenantPage, /tenant-upgrade-plan-prices/);
  assert.match(tenantPage, /plan\.pricing\?\.annualAmountMinor/);
  assert.match(tenantPage, /Confirm selection/);
  assert.match(reviewRoute, /action === "approve"/);
  assert.match(reviewRoute, /assignLabSubscription/);
});
