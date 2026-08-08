import { NextResponse } from "next/server";
import { nextJsonError } from "@/app/lib/api-response";
import { requireDeveloperSession } from "@/app/lib/auth";
import { ensureQuotaPeriod, serializeQuotaPeriod } from "@/app/lib/quota-meter";
import { getLabSubscriptionEntitlements } from "@/app/lib/subscription-service";
import { getTenantModels } from "@/app/lib/tenant-db";
import connectMasterDB from "@/app/lib/master-db";
import { getLabModel } from "@/app/models/master/Lab";
import { getSubscriptionAddonRequestModel } from "@/app/models/master/SubscriptionAddonRequest";
import mongoose from "mongoose";

export async function GET(req, context) {
  try {
    const auth = requireDeveloperSession(req);
    if (auth.error) return auth.error;

    const { tenantId } = await context.params;
    const requestedId = String(tenantId || "").trim();
    const masterConnection = await connectMasterDB();
    const Lab = getLabModel(masterConnection);
    const lab = await Lab.findOne(
      mongoose.Types.ObjectId.isValid(requestedId) ? { _id: requestedId } : { tenantId: requestedId.toLowerCase() }
    ).select("tenantId").lean();
    if (!lab) return NextResponse.json({ error: "Lab not found" }, { status: 404 });
    const normalizedTenantId = lab.tenantId;
    const subscription = await getLabSubscriptionEntitlements(normalizedTenantId);
    const { connection, QuotaPeriod, QuotaUsageEvent, User } = await getTenantModels(normalizedTenantId);
    let period = await ensureQuotaPeriod(connection, normalizedTenantId, subscription);
    const activeStaffUsers = await User.countDocuments({ status: "active" });
    await QuotaPeriod.updateOne(
      { _id: period._id },
      { $set: { "quotas.staffUsers.consumed": activeStaffUsers } }
    );
    period = await QuotaPeriod.findById(period._id);
    const SubscriptionAddonRequest = getSubscriptionAddonRequestModel(masterConnection);
    const [recentEvents, addOnHistory] = await Promise.all([
      QuotaUsageEvent.find({ tenantId: normalizedTenantId })
        .sort({ occurredAt: -1 })
        .limit(25)
        .lean(),
      SubscriptionAddonRequest.find({ tenantId: normalizedTenantId })
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    return NextResponse.json({
      subscription: {
        id: String(subscription._id),
        tenantId: subscription.tenantId,
        packageKey: subscription.packageKey,
        packageName: subscription.packageName,
        packageVersion: subscription.packageVersion,
        packageReleaseVersion: subscription.packageReleaseVersion,
        status: subscription.status,
        enforcementMode: subscription.enforcementMode,
        entitlements: subscription.entitlements,
        commercialTerms: subscription.commercialTerms || {
          currency: "INR",
          monthlyAmountMinor: null,
          annualAmountMinor: null,
        },
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        legacyPlan: subscription.legacyPlan,
        migratedAt: subscription.migratedAt,
      },
      usage: serializeQuotaPeriod(period),
      recentEvents: recentEvents.map((event) => ({
        id: event.eventId,
        quotaKey: event.quotaKey,
        type: event.type,
        units: event.units,
        consumedBefore: event.consumedBefore,
        consumedAfter: event.consumedAfter,
        effectiveLimit: event.effectiveLimit,
        wouldExceedLimit: event.wouldExceedLimit,
        resourceType: event.relatedResourceType,
        resourceId: event.relatedResourceId ? String(event.relatedResourceId) : null,
        actorEmail: event.actorEmail,
        occurredAt: event.occurredAt,
      })),
      addOnHistory: addOnHistory.map((req) => ({
        id: String(req._id),
        quotaKey: req.quotaKey,
        units: req.units,
        amountMinor: req.amountMinor,
        status: req.status,
        requestedByEmail: req.requestedByEmail,
        initialLimit: req.initialLimit,
        newLimit: req.newLimit,
        expiresAt: req.expiresAt,
        createdAt: req.createdAt,
      })),
    });
  } catch (error) {
    return nextJsonError("Unable to load lab subscription usage", error, 500);
  }
}
