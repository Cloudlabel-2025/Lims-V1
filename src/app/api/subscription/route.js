import { jsonError } from "@/app/lib/api-response";
import { requireTenantSession } from "@/app/lib/auth";
import { ensureQuotaPeriod, serializeQuotaPeriod } from "@/app/lib/quota-meter";
import { getLabSubscriptionEntitlements } from "@/app/lib/subscription-service";
import { getTenantModels } from "@/app/lib/tenant-db";
import connectMasterDB from "@/app/lib/master-db";
import { getLabModel } from "@/app/models/master/Lab";
import { getSubscriptionPackageModel } from "@/app/models/master/SubscriptionPackage";
import { getSubscriptionUpgradeRequestModel } from "@/app/models/master/SubscriptionUpgradeRequest";

function isVersionOne(value) {
  // Records created before releaseVersion was introduced are the original
  // Version 1 catalog packages. This matches the developer catalog fallback
  // while still excluding explicit later releases such as 1.1.
  return ["1", "1.0"].includes(String(value || "1.0").trim());
}

function serializeUpgradePlan(pkg, catalogRank) {
  const version = pkg.versions.find((item) => item.version === pkg.activeVersion) || pkg.versions.at(-1);
  return {
    id: String(pkg._id),
    key: pkg.key,
    catalogRank,
    name: pkg.name,
    releaseVersion: "1",
    description: pkg.description || "",
    modules: version?.modules || [],
    quotas: version?.quotas || {},
    pricing: version?.pricing || {},
  };
}

async function getVersionOnePlans(masterConnection) {
  const SubscriptionPackage = getSubscriptionPackageModel(masterConnection);
  const packages = await SubscriptionPackage.find({ status: "active" }).sort({ sortOrder: 1, createdAt: 1 }).lean();
  return packages
    .filter((pkg) => isVersionOne(pkg.releaseVersion))
    .slice(0, 3)
    .map((pkg, index) => serializeUpgradePlan(pkg, index));
}

export async function GET(req) {
  try {
    const auth = requireTenantSession(req, "settings.manage");
    if (auth.error) return auth.error;

    const subscription = await getLabSubscriptionEntitlements(auth.tenantId);
    const { connection, QuotaPeriod, User } = await getTenantModels(auth.tenantId);
    let period = await ensureQuotaPeriod(connection, auth.tenantId, subscription);
    const activeStaffUsers = await User.countDocuments({ status: "active" });
    await QuotaPeriod.updateOne(
      { _id: period._id },
      { $set: { "quotas.staffUsers.consumed": activeStaffUsers } }
    );
    period = await QuotaPeriod.findById(period._id);
    const masterConnection = await connectMasterDB();
    const UpgradeRequest = getSubscriptionUpgradeRequestModel(masterConnection);
    const [versionOnePlans, pendingUpgrade] = await Promise.all([
      getVersionOnePlans(masterConnection),
      UpgradeRequest.findOne({ tenantId: auth.tenantId, status: "pending" }).sort({ createdAt: -1 }).lean(),
    ]);
    const currentRank = versionOnePlans.findIndex((plan) => plan.key === subscription.packageKey);
    const upgradePlans = versionOnePlans.map((plan) => ({
      ...plan,
      isDowngrade: currentRank !== -1 && plan.catalogRank < currentRank,
      canUpgrade: currentRank === -1 || plan.catalogRank !== currentRank,
    }));

    return Response.json({
      subscription: {
        packageName: subscription.packageName,
        packageKey: subscription.packageKey,
        releaseVersion: subscription.packageReleaseVersion,
        status: subscription.status,
        modules: subscription.entitlements?.modules || [],
        features: subscription.entitlements?.features || [],
        pricing: subscription.commercialTerms || {},
        assignedAt: subscription.assignedAt,
        periodStart: subscription.currentPeriodStart,
        periodEnd: subscription.currentPeriodEnd,
      },
      usage: serializeQuotaPeriod(period),
      upgradePlans,
      pendingUpgrade: pendingUpgrade ? {
        id: String(pendingUpgrade._id),
        packageName: pendingUpgrade.toPackageName,
        releaseVersion: "1",
        requestedAt: pendingUpgrade.createdAt,
      } : null,
    });
  } catch (error) {
    return jsonError("Unable to load subscription", error, 500);
  }
}

export async function POST(req) {
  try {
    const auth = requireTenantSession(req, "settings.manage");
    if (auth.error) return auth.error;

    const body = await req.json();
    const masterConnection = await connectMasterDB();
    const Lab = getLabModel(masterConnection);
    const UpgradeRequest = getSubscriptionUpgradeRequestModel(masterConnection);
    const current = await getLabSubscriptionEntitlements(auth.tenantId);
    const plans = await getVersionOnePlans(masterConnection);
    const target = plans.find((plan) => plan.key === String(body.packageKey || "").trim().toLowerCase());
    if (!target) return Response.json({ error: "Select an available Version 1 package" }, { status: 400 });

    const currentRank = plans.findIndex((plan) => plan.key === current.packageKey);
    const targetRank = plans.findIndex((plan) => plan.key === target.key);
    if (targetRank === currentRank) {
      return Response.json({ error: "You are already subscribed to this plan" }, { status: 400 });
    }

    const existing = await UpgradeRequest.findOne({ tenantId: auth.tenantId, status: "pending" }).lean();
    if (existing) return Response.json({ error: `An upgrade request for ${existing.toPackageName} is already pending` }, { status: 409 });

    const lab = await Lab.findOne({ tenantId: auth.tenantId }).select("_id").lean();
    if (!lab) return Response.json({ error: "Lab not found" }, { status: 404 });

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return Response.json({ error: "Razorpay integration is not configured" }, { status: 500 });
    }

    const created = await UpgradeRequest.create({
      lab: lab._id,
      tenantId: auth.tenantId,
      fromPackageKey: current.packageKey,
      fromPackageName: current.packageName,
      toPackage: target.id,
      toPackageKey: target.key,
      toPackageName: target.name,
      toReleaseVersion: "1",
      requestedBy: auth.session.userId,
      requestedByEmail: auth.session.email,
    });

    const amount = target.pricing?.monthlyAmountMinor || 149900;

    const authHeader = "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader,
      },
      body: JSON.stringify({
        amount: amount,
        currency: "INR",
        receipt: String(created._id),
      }),
    });

    if (!rzpRes.ok) {
      const rzpErr = await rzpRes.json();
      await UpgradeRequest.deleteOne({ _id: created._id });
      return Response.json({ error: rzpErr.error?.description || "Failed to create Razorpay order" }, { status: 500 });
    }

    const rzpOrder = await rzpRes.json();
    created.rzpOrderId = rzpOrder.id;
    await created.save();

    return Response.json({
      request: {
        id: String(created._id),
        packageName: created.toPackageName,
        releaseVersion: "1",
        requestedAt: created.createdAt,
        rzpOrderId: rzpOrder.id,
        amount: amount,
        keyId,
      },
      message: `${created.toPackageName} Version 1 upgrade order created`,
    }, { status: 201 });
  } catch (error) {
    if (error?.code === 11000) return Response.json({ error: "An upgrade request is already pending" }, { status: 409 });
    return jsonError("Unable to request subscription upgrade", error, 500);
  }
}

export async function DELETE(req) {
  try {
    const auth = requireTenantSession(req, "settings.manage");
    if (auth.error) return auth.error;

    const masterConnection = await connectMasterDB();
    const UpgradeRequest = getSubscriptionUpgradeRequestModel(masterConnection);

    await UpgradeRequest.deleteOne({ tenantId: auth.tenantId, status: "pending" });

    return Response.json({ message: "Pending upgrade request cancelled successfully" });
  } catch (error) {
    return jsonError("Unable to cancel upgrade request", error, 500);
  }
}
