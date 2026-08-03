import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import mongoose from "mongoose";
import {
  buildEntitlementSnapshot,
  defaultSubscriptionPackages,
  getCalendarMonthPeriod,
  mapLegacyPlanToPackageKey,
} from "../src/app/lib/subscription-catalog.js";
import { getLabModel } from "../src/app/models/master/Lab.js";
import { getLabSubscriptionModel } from "../src/app/models/master/LabSubscription.js";
import { getSubscriptionPackageModel } from "../src/app/models/master/SubscriptionPackage.js";
import { getQuotaPeriodModel } from "../src/app/models/tenant/QuotaPeriod.js";
import { getQuotaUsageEventModel } from "../src/app/models/tenant/QuotaUsageEvent.js";

const rootDir = process.cwd();

function loadLocalEnv() {
  const envPath = path.join(rootDir, ".env.local");
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function activeVersionOf(pkg) {
  return pkg.versions.find((version) => version.version === pkg.activeVersion) || pkg.versions.at(-1);
}

async function seedPackages(connection) {
  const SubscriptionPackage = getSubscriptionPackageModel(connection);
  const packages = new Map();

  for (let index = 0; index < defaultSubscriptionPackages.length; index += 1) {
    const definition = defaultSubscriptionPackages[index];
    let pkg = await SubscriptionPackage.findOne({ key: definition.key });
    if (!pkg) {
      pkg = await SubscriptionPackage.create({
        key: definition.key,
        name: definition.name,
        releaseVersion: definition.releaseVersion,
        description: definition.description,
        type: "system",
        status: "active",
        activeVersion: 1,
        sortOrder: index + 1,
        versions: [{
          version: 1,
          modules: definition.modules,
          features: definition.features,
          quotas: definition.quotas,
          pricing: definition.pricing,
          effectiveAt: new Date(),
          publishedAt: new Date(),
        }],
      });
      console.log(`Created package: ${pkg.name} v1`);
    } else {
      console.log(`Package already exists: ${pkg.name} v${pkg.activeVersion}`);
    }
    packages.set(pkg.key, pkg);
  }

  return packages;
}

async function migrateLabs(connection, packages) {
  const Lab = getLabModel(connection);
  const LabSubscription = getLabSubscriptionModel(connection);
  const labs = await Lab.find({ status: { $ne: "deleted" } }).select(
    "_id tenantId dbName +dbConnectionString subscriptionPlan enabledModules status"
  );
  const period = getCalendarMonthPeriod();
  let created = 0;
  let existing = 0;

  for (const lab of labs) {
    const current = await LabSubscription.findOne({ tenantId: lab.tenantId });
    if (current) {
      existing += 1;
    } else {
      const packageKey = mapLegacyPlanToPackageKey(lab.subscriptionPlan);
      const pkg = packages.get(packageKey);
      const version = activeVersionOf(pkg);
      const entitlements = buildEntitlementSnapshot(
        {
          key: pkg.key,
          modules: version.modules,
          features: version.features,
          quotas: version.quotas,
        },
        { modulesOverride: lab.enabledModules }
      );

      await LabSubscription.create({
        lab: lab._id,
        tenantId: lab.tenantId,
        package: pkg._id,
        packageKey: pkg.key,
        packageName: pkg.name,
        packageVersion: version.version,
        packageReleaseVersion: pkg.releaseVersion || "1.0",
        entitlements,
        commercialTerms: version.pricing || {
          currency: "INR",
          monthlyAmountMinor: null,
          annualAmountMinor: null,
        },
        status: lab.subscriptionPlan === "trial" ? "trialing" : "active",
        enforcementMode: "shadow",
        currentPeriodStart: period.start,
        currentPeriodEnd: period.end,
        legacyPlan: lab.subscriptionPlan,
        migratedAt: new Date(),
      });
      created += 1;
    }

    if (lab.dbConnectionString && lab.dbName && lab.status === "active") {
      const tenantConnection = await mongoose
        .createConnection(lab.dbConnectionString, {
          dbName: lab.dbName,
          bufferCommands: false,
          maxPoolSize: 2,
          serverSelectionTimeoutMS: 5_000,
        })
        .asPromise();
      try {
        await Promise.all([
          getQuotaPeriodModel(tenantConnection).init(),
          getQuotaUsageEventModel(tenantConnection).init(),
        ]);
      } finally {
        await tenantConnection.close();
      }
    }
  }

  console.log(`Lab subscriptions created: ${created}`);
  console.log(`Existing lab subscriptions preserved: ${existing}`);
}

async function main() {
  loadLocalEnv();
  const uri = process.env.MASTER_MONGODB_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error("MASTER_MONGODB_URI or MONGODB_URI is required");

  const connection = await mongoose
    .createConnection(uri, {
      dbName: "CMS",
      bufferCommands: false,
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 5_000,
    })
    .asPromise();

  try {
    const packages = await seedPackages(connection);
    await migrateLabs(connection, packages);
    console.log("Subscription Phase 1 seed and migration complete.");
  } finally {
    await connection.close();
  }
}

main().catch((error) => {
  console.error("Subscription seed failed:", error.message);
  process.exitCode = 1;
});
