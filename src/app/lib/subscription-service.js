import connectMasterDB from "@/app/lib/master-db";
import {
  buildEntitlementSnapshot,
  defaultSubscriptionPackages,
  getDefaultPackageDefinition,
  getCalendarMonthPeriod,
  mapLegacyPlanToPackageKey,
} from "@/app/lib/subscription-catalog";
import { getLabModel } from "@/app/models/master/Lab";
import { getLabSubscriptionModel } from "@/app/models/master/LabSubscription";
import { getSubscriptionPackageModel } from "@/app/models/master/SubscriptionPackage";

function activeVersionOf(pkg) {
  return pkg.versions.find((version) => version.version === pkg.activeVersion) || pkg.versions.at(-1);
}

function packageDefinition(pkg) {
  const version = activeVersionOf(pkg);
  return {
    key: pkg.key,
    name: pkg.name,
    releaseVersion: pkg.releaseVersion || "1.0",
    version: version.version,
    modules: version.modules,
    features: version.features,
    quotas: version.quotas,
    pricing: version.pricing || { currency: "INR", monthlyAmountMinor: null, annualAmountMinor: null },
  };
}

export async function getSubscriptionPackageDefinition(packageKey) {
  const normalizedKey = String(packageKey || "").trim().toLowerCase();
  if (!normalizedKey) throw new Error("Subscription package is required");

  const masterConnection = await connectMasterDB();
  await ensureDefaultSubscriptionPackages(masterConnection);
  const SubscriptionPackage = getSubscriptionPackageModel(masterConnection);
  const pkg = await SubscriptionPackage.findOne({ key: normalizedKey, status: "active" }).lean();
  if (!pkg) throw new Error("Selected subscription package is not available");

  return {
    id: String(pkg._id),
    description: pkg.description || "",
    ...packageDefinition(pkg),
  };
}

export async function ensureDefaultSubscriptionPackages(connection) {
  const masterConnection = connection || (await connectMasterDB());
  const SubscriptionPackage = getSubscriptionPackageModel(masterConnection);

  const packages = [];
  for (let index = 0; index < defaultSubscriptionPackages.length; index += 1) {
    const definition = defaultSubscriptionPackages[index];
    const pkg = await SubscriptionPackage.findOneAndUpdate(
      { key: definition.key },
      {
        $setOnInsert: {
          key: definition.key,
          name: definition.name,
          releaseVersion: definition.releaseVersion,
          description: definition.description,
          type: "system",
          status: "active",
          activeVersion: 1,
          sortOrder: index + 1,
          versions: [
            {
              version: 1,
              modules: definition.modules,
              features: definition.features,
              quotas: definition.quotas,
              pricing: definition.pricing,
              effectiveAt: new Date(),
              publishedAt: new Date(),
            },
          ],
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    packages.push(pkg);
  }

  return packages;
}

export async function ensureLabSubscription(tenantId, { assignedBy } = {}) {
  const masterConnection = await connectMasterDB();
  const Lab = getLabModel(masterConnection);
  const LabSubscription = getLabSubscriptionModel(masterConnection);
  const SubscriptionPackage = getSubscriptionPackageModel(masterConnection);

  const normalizedTenantId = String(tenantId || "").trim().toLowerCase();
  const existing = await LabSubscription.findOne({ tenantId: normalizedTenantId }).lean();
  if (existing) return existing;

  const lab = await Lab.findOne({ tenantId: normalizedTenantId }).select(
    "_id tenantId subscriptionPlan enabledModules status createdAt"
  );
  if (!lab) throw new Error(`Lab not found for tenantId: ${normalizedTenantId}`);

  await ensureDefaultSubscriptionPackages(masterConnection);
  const packageKey = mapLegacyPlanToPackageKey(lab.subscriptionPlan);
  const pkg = await SubscriptionPackage.findOne({ key: packageKey, status: "active" });
  if (!pkg) throw new Error(`Active subscription package not found: ${packageKey}`);

  const definition = packageDefinition(pkg);
  const entitlements = buildEntitlementSnapshot(definition, { modulesOverride: lab.enabledModules });
  const period = getCalendarMonthPeriod();
  const status = lab.subscriptionPlan === "trial" ? "trialing" : "active";

  try {
    const created = await LabSubscription.create({
      lab: lab._id,
      tenantId: normalizedTenantId,
      package: pkg._id,
      packageKey: pkg.key,
      packageName: pkg.name,
      packageVersion: definition.version,
      packageReleaseVersion: definition.releaseVersion,
      entitlements,
      commercialTerms: definition.pricing,
      status,
      enforcementMode: "shadow",
      currentPeriodStart: period.start,
      currentPeriodEnd: period.end,
      legacyPlan: lab.subscriptionPlan,
      migratedAt: new Date(),
      assignedBy,
    });
    return created.toObject();
  } catch (error) {
    if (error?.code === 11000) {
      return LabSubscription.findOne({ tenantId: normalizedTenantId }).lean();
    }
    throw error;
  }
}

export async function assignLabSubscription({
  tenantId,
  packageKey,
  legacyPlan,
  modulesOverride,
  status,
  assignedBy,
}) {
  const masterConnection = await connectMasterDB();
  const Lab = getLabModel(masterConnection);
  const LabSubscription = getLabSubscriptionModel(masterConnection);
  const SubscriptionPackage = getSubscriptionPackageModel(masterConnection);
  const normalizedTenantId = String(tenantId || "").trim().toLowerCase();
  const lab = await Lab.findOne({ tenantId: normalizedTenantId }).select(
    "_id tenantId subscriptionPlan enabledModules"
  );
  if (!lab) throw new Error(`Lab not found for tenantId: ${normalizedTenantId}`);

  await ensureDefaultSubscriptionPackages(masterConnection);
  const resolvedPackageKey = packageKey || mapLegacyPlanToPackageKey(legacyPlan || lab.subscriptionPlan);
  const pkg = await SubscriptionPackage.findOne({ key: resolvedPackageKey, status: "active" });
  if (!pkg) throw new Error(`Active subscription package not found: ${resolvedPackageKey}`);

  const definition = packageDefinition(pkg);
  const entitlements = buildEntitlementSnapshot(definition, {
    modulesOverride: modulesOverride?.length ? modulesOverride : lab.enabledModules,
  });
  const period = getCalendarMonthPeriod();
  const resolvedLegacyPlan = legacyPlan || lab.subscriptionPlan;
  const resolvedStatus = status || (resolvedLegacyPlan === "trial" ? "trialing" : "active");
  const existingSubscription = await LabSubscription.findOne({ tenantId: normalizedTenantId }).select("package assignedAt assignedBy").lean();
  const packageChanged = !existingSubscription || String(existingSubscription.package) !== String(pkg._id);
  const assignmentFields = packageChanged
    ? { assignedAt: new Date(), assignedBy }
    : {};

  const subscription = await LabSubscription.findOneAndUpdate(
    { tenantId: normalizedTenantId },
    {
      $set: {
        lab: lab._id,
        package: pkg._id,
        packageKey: pkg.key,
        packageName: pkg.name,
        packageVersion: definition.version,
        packageReleaseVersion: definition.releaseVersion,
        entitlements,
        commercialTerms: definition.pricing,
        status: resolvedStatus,
        enforcementMode: "shadow",
        currentPeriodStart: period.start,
        currentPeriodEnd: period.end,
        legacyPlan: resolvedLegacyPlan,
        migratedAt: new Date(),
        ...assignmentFields,
      },
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );

  return subscription.toObject();
}

export async function getLabSubscriptionEntitlements(tenantId) {
  let subscription = await ensureLabSubscription(tenantId);
  const period = getCalendarMonthPeriod();

  if (
    new Date(subscription.currentPeriodStart).getTime() !== period.start.getTime() ||
    new Date(subscription.currentPeriodEnd).getTime() !== period.end.getTime()
  ) {
    const masterConnection = await connectMasterDB();
    const LabSubscription = getLabSubscriptionModel(masterConnection);
    subscription = await LabSubscription.findOneAndUpdate(
      { tenantId: String(tenantId).trim().toLowerCase() },
      { $set: { currentPeriodStart: period.start, currentPeriodEnd: period.end } },
      { returnDocument: "after" }
    ).lean();
  }

  return {
    ...subscription,
    currentPeriodStart: period.start,
    currentPeriodEnd: period.end,
  };
}

export async function getShadowSubscriptionEntitlements(tenantId) {
  try {
    return await getLabSubscriptionEntitlements(tenantId);
  } catch (error) {
    const fallback = getDefaultPackageDefinition("standard");
    const period = getCalendarMonthPeriod();
    console.error("[subscription:shadow] Falling back to Standard v1 entitlements:", error.message);
    return {
      tenantId,
      packageKey: fallback.key,
      packageName: fallback.name,
      packageVersion: 1,
      packageReleaseVersion: fallback.releaseVersion,
      entitlements: buildEntitlementSnapshot(fallback),
      commercialTerms: fallback.pricing,
      status: "active",
      enforcementMode: "shadow",
      currentPeriodStart: period.start,
      currentPeriodEnd: period.end,
      fallback: true,
    };
  }
}

export async function listSubscriptionPackages() {
  const masterConnection = await connectMasterDB();
  await ensureDefaultSubscriptionPackages(masterConnection);
  const SubscriptionPackage = getSubscriptionPackageModel(masterConnection);
  return SubscriptionPackage.find({ status: "active" }).sort({ sortOrder: 1, name: 1 }).lean();
}
