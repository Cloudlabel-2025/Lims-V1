import { NextResponse } from "next/server";
import { nextJsonError } from "@/app/lib/api-response";
import { requireDeveloperSession } from "@/app/lib/auth";
import connectMasterDB from "@/app/lib/master-db";
import {
  entitlementCatalog,
  normalizeQuotaLimit,
  resolvePackageModules,
} from "@/app/lib/subscription-catalog";
import { listSubscriptionPackages } from "@/app/lib/subscription-service";
import { getLabSubscriptionModel } from "@/app/models/master/LabSubscription";
import { getSubscriptionPackageModel } from "@/app/models/master/SubscriptionPackage";

function serializePackage(pkg, labCount = 0) {
  const version = pkg.versions.find((item) => item.version === pkg.activeVersion) || pkg.versions.at(-1);
  return {
    id: String(pkg._id),
    key: pkg.key,
    name: pkg.name,
    releaseVersion: pkg.releaseVersion || "1.0",
    description: pkg.description || "",
    type: pkg.type,
    status: pkg.status,
    internalRevision: pkg.revision || 1,
    labCount,
    modules: version?.modules || [],
    features: version?.features || [],
    quotas: version?.quotas || {},
    pricing: version?.pricing || { currency: "INR", monthlyAmountMinor: null, annualAmountMinor: null },
  };
}

function cleanString(value) {
  return String(value || "").trim();
}

function packageKeyFromName(value) {
  return cleanString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function validReleaseVersion(value) {
  const version = cleanString(value);
  return /^[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)*$/.test(version) && version.length <= 30
    ? version
    : "";
}

function moneyToMinor(value) {
  if (value === null || value === undefined || value === "") return null;
  const normalized = String(value).trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return undefined;
  const [whole, fraction = ""] = normalized.split(".");
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(minor) ? minor : undefined;
}

function parsePackageDefinition(body, fallback = {}) {
  const allowedFeatures = new Set(entitlementCatalog.features);
  const sourceQuotas = body.quotas && typeof body.quotas === "object" ? body.quotas : {};
  const fallbackQuotas = fallback.quotas || {};
  const quotaValue = (key) => {
    if (!(key in sourceQuotas)) return fallbackQuotas[key] ?? null;
    if (sourceQuotas[key] === null || sourceQuotas[key] === "") return null;
    return normalizeQuotaLimit(sourceQuotas[key], undefined);
  };
  const quotas = {
    patientRegistrations: quotaValue("patientRegistrations"),
    billingRecords: quotaValue("billingRecords"),
    staffUsers: quotaValue("staffUsers"),
  };

  if (Object.values(quotas).some((value) => value === undefined)) {
    return { error: "Quota values must be whole numbers greater than or equal to zero, or blank for unlimited" };
  }

  const sourcePricing = body.pricing && typeof body.pricing === "object" ? body.pricing : {};
  const fallbackPricing = fallback.pricing || {
    currency: "INR",
    monthlyAmountMinor: null,
    annualAmountMinor: null,
  };
  const currency = cleanString(sourcePricing.currency || fallbackPricing.currency || "INR").toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    return { error: "Pricing currency must be a valid three-letter currency code" };
  }
  const pricing = {
    currency,
    monthlyAmountMinor: "monthlyAmount" in sourcePricing
      ? moneyToMinor(sourcePricing.monthlyAmount)
      : fallbackPricing.monthlyAmountMinor ?? null,
    annualAmountMinor: "annualAmount" in sourcePricing
      ? moneyToMinor(sourcePricing.annualAmount)
      : fallbackPricing.annualAmountMinor ?? null,
  };
  if (pricing.monthlyAmountMinor === undefined || pricing.annualAmountMinor === undefined) {
    return { error: "Package prices must be zero or greater with no more than two decimal places" };
  }
  if (pricing.monthlyAmountMinor === null) {
    return { error: "Monthly package price is required" };
  }

  return {
    definition: {
      modules: resolvePackageModules(body.modules ?? fallback.modules),
      features: [...new Set((body.features ?? fallback.features ?? []).filter((item) => allowedFeatures.has(item)))],
      quotas,
      pricing,
    },
  };
}

function sameDefinition(left, right) {
  const canonical = (definition) => ({
    modules: [...definition.modules].sort(),
    features: [...definition.features].sort(),
    quotas: {
      patientRegistrations: definition.quotas.patientRegistrations ?? null,
      billingRecords: definition.quotas.billingRecords ?? null,
      staffUsers: definition.quotas.staffUsers ?? null,
    },
    pricing: {
      currency: definition.pricing?.currency || "INR",
      monthlyAmountMinor: definition.pricing?.monthlyAmountMinor ?? null,
      annualAmountMinor: definition.pricing?.annualAmountMinor ?? null,
    },
  });
  return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
}

export async function GET(req) {
  try {
    const auth = requireDeveloperSession(req);
    if (auth.error) return auth.error;

    const packages = await listSubscriptionPackages();
    const masterConnection = await connectMasterDB();
    const LabSubscription = getLabSubscriptionModel(masterConnection);
    const counts = await LabSubscription.aggregate([
      { $match: { status: { $in: ["trialing", "active", "grace_period"] } } },
      { $group: { _id: "$package", count: { $sum: 1 } } },
    ]);
    const countByPackage = new Map(counts.map((item) => [String(item._id), item.count]));
    return NextResponse.json({
      packages: packages.map((pkg) => serializePackage(pkg, countByPackage.get(String(pkg._id)) || 0)),
    });
  } catch (error) {
    return nextJsonError("Unable to load subscription packages", error, 500);
  }
}

export async function POST(req) {
  try {
    const auth = requireDeveloperSession(req);
    if (auth.error) return auth.error;

    const body = await req.json();
    const name = cleanString(body.name);
    if (name.length < 2 || name.length > 80) {
      return NextResponse.json({ error: "Package name must contain 2 to 80 characters" }, { status: 400 });
    }

    const releaseVersion = validReleaseVersion(body.releaseVersion);
    if (!releaseVersion) {
      return NextResponse.json(
        { error: "Version is required and may contain letters, numbers, dots, hyphens, or underscores" },
        { status: 400 }
      );
    }

    const key = packageKeyFromName(`${name}-v-${releaseVersion}`);
    if (!key) return NextResponse.json({ error: "Package name must contain letters or numbers" }, { status: 400 });
    const parsed = parsePackageDefinition(body);
    if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const masterConnection = await connectMasterDB();
    const SubscriptionPackage = getSubscriptionPackageModel(masterConnection);
    const lastPackage = await SubscriptionPackage.findOne().sort({ sortOrder: -1 }).select("sortOrder").lean();
    const pkg = await SubscriptionPackage.create({
      key,
      name,
      releaseVersion,
      description: cleanString(body.description).slice(0, 500),
      type: "custom",
      status: "active",
      activeVersion: 1,
      revision: 1,
      sortOrder: (lastPackage?.sortOrder || 0) + 1,
      versions: [{ version: 1, ...parsed.definition, effectiveAt: new Date(), publishedAt: new Date() }],
    });

    return NextResponse.json({ package: serializePackage(pkg.toObject()) }, { status: 201 });
  } catch (error) {
    if (error?.code === 11000) {
      return NextResponse.json({ error: "A package with this name or key already exists" }, { status: 409 });
    }
    return nextJsonError("Unable to create subscription package", error, 500);
  }
}

export async function PATCH(req) {
  try {
    const auth = requireDeveloperSession(req);
    if (auth.error) return auth.error;

    const body = await req.json();
    const packageId = cleanString(body.packageId);
    if (!packageId) return NextResponse.json({ error: "Package id is required" }, { status: 400 });

    const masterConnection = await connectMasterDB();
    const SubscriptionPackage = getSubscriptionPackageModel(masterConnection);
    const pkg = await SubscriptionPackage.findById(packageId);
    if (!pkg) return NextResponse.json({ error: "Subscription package not found" }, { status: 404 });
    if (Number(body.expectedRevision) !== (pkg.revision || 1)) {
      return NextResponse.json(
        { error: "This package changed after you opened it. Reload and try again." },
        { status: 409 }
      );
    }

    const name = cleanString(body.name);
    if (name.length < 2 || name.length > 80) {
      return NextResponse.json({ error: "Package name must contain 2 to 80 characters" }, { status: 400 });
    }
    const releaseVersion = validReleaseVersion(body.releaseVersion);
    if (!releaseVersion) {
      return NextResponse.json(
        { error: "Version is required and may contain letters, numbers, dots, hyphens, or underscores" },
        { status: 400 }
      );
    }

    const currentVersion = pkg.versions.find((item) => item.version === pkg.activeVersion) || pkg.versions.at(-1);
    const currentDefinition = {
      modules: currentVersion.modules,
      features: currentVersion.features,
      quotas: currentVersion.quotas.toObject?.() || currentVersion.quotas,
      pricing: currentVersion.pricing?.toObject?.() || currentVersion.pricing || {
        currency: "INR",
        monthlyAmountMinor: null,
        annualAmountMinor: null,
      },
    };
    const parsed = parsePackageDefinition(body, currentDefinition);
    if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const versionIndex = pkg.versions.findIndex((item) => item.version === currentVersion.version);
    const expectedRevision = pkg.revision || 1;
    const revisionFilter = expectedRevision === 1
      ? { $or: [{ revision: 1 }, { revision: { $exists: false } }] }
      : { revision: expectedRevision };
    const definitionChanged = !sameDefinition(currentDefinition, parsed.definition);
    const setFields = {
      name,
      releaseVersion,
      description: cleanString(body.description).slice(0, 500),
      [`versions.${versionIndex}.modules`]: parsed.definition.modules,
      [`versions.${versionIndex}.features`]: parsed.definition.features,
      [`versions.${versionIndex}.quotas`]: parsed.definition.quotas,
      [`versions.${versionIndex}.pricing`]: parsed.definition.pricing,
    };
    if (definitionChanged) setFields[`versions.${versionIndex}.publishedAt`] = new Date();

    const updateResult = await SubscriptionPackage.collection.updateOne(
      { _id: pkg._id, ...revisionFilter },
      { $set: setFields, $inc: { revision: 1 } }
    );
    if (updateResult.matchedCount !== 1) {
      return NextResponse.json(
        { error: "This package changed while you were editing it. Reload and try again." },
        { status: 409 }
      );
    }

    const updatedPackage = await SubscriptionPackage.collection.findOne({ _id: pkg._id });
    return NextResponse.json({ package: serializePackage(updatedPackage) });
  } catch (error) {
    if (error?.code === 11000) {
      return NextResponse.json(
        { error: "A package with this name and version already exists" },
        { status: 409 }
      );
    }
    if (error?.name === "CastError") {
      return NextResponse.json({ error: "Invalid package id" }, { status: 400 });
    }
    if (error?.name === "ValidationError") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return nextJsonError("Unable to update subscription package", error, 500);
  }
}
