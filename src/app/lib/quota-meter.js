import crypto from "node:crypto";
import { calculateQuotaState, getCalendarMonthPeriod } from "@/app/lib/subscription-catalog";
import { getQuotaPeriodModel } from "@/app/models/tenant/QuotaPeriod";
import { getQuotaUsageEventModel } from "@/app/models/tenant/QuotaUsageEvent";

function quotaSeed(subscription, quotaKey) {
  return {
    included: subscription.entitlements?.quotas?.[quotaKey] ?? null,
    addOn: 0,
    adjustment: 0,
    consumed: 0,
    reserved: 0,
    wouldBlockAttempts: 0,
  };
}

export async function ensureQuotaPeriod(connection, tenantId, subscription, { session, at = new Date() } = {}) {
  const QuotaPeriod = getQuotaPeriodModel(connection);
  const period = getCalendarMonthPeriod(at);
  const query = { tenantId, periodKey: period.key };
  const update = {
    $setOnInsert: {
      tenantId,
      periodKey: period.key,
      periodStart: period.start,
      periodEnd: period.end,
      packageKey: subscription.packageKey,
      packageName: subscription.packageName,
      packageVersion: subscription.packageVersion,
      enforcementMode: subscription.enforcementMode || "shadow",
      quotas: {
        patientRegistrations: quotaSeed(subscription, "patientRegistrations"),
        billingRecords: quotaSeed(subscription, "billingRecords"),
        staffUsers: quotaSeed(subscription, "staffUsers"),
      },
    },
  };

  try {
    let quotaPeriod = await QuotaPeriod.findOneAndUpdate(query, update, {
      upsert: true,
      returnDocument: "after",
      setDefaultsOnInsert: true,
      session,
    });
    if (
      quotaPeriod.packageKey !== subscription.packageKey ||
      quotaPeriod.packageVersion !== subscription.packageVersion
    ) {
      quotaPeriod = await QuotaPeriod.findOneAndUpdate(
        { _id: quotaPeriod._id },
        {
          $set: {
            packageKey: subscription.packageKey,
            packageName: subscription.packageName,
            packageVersion: subscription.packageVersion,
            enforcementMode: subscription.enforcementMode || "shadow",
            "quotas.patientRegistrations.included": subscription.entitlements?.quotas?.patientRegistrations ?? null,
            "quotas.billingRecords.included": subscription.entitlements?.quotas?.billingRecords ?? null,
            "quotas.staffUsers.included": subscription.entitlements?.quotas?.staffUsers ?? null,
          },
        },
        { returnDocument: "after", session }
      );
    }
    return quotaPeriod;
  } catch (error) {
    if (error?.code === 11000 && !session) {
      return QuotaPeriod.findOne(query);
    }
    throw error;
  }
}

export async function recordShadowUsage({
  connection,
  tenantId,
  subscription,
  quotaKey,
  idempotencyKey,
  relatedResourceType,
  relatedResourceId,
  actorId,
  actorEmail,
  metadata = {},
  units = 1,
  session,
  at = new Date(),
}) {
  const QuotaPeriod = getQuotaPeriodModel(connection);
  const QuotaUsageEvent = getQuotaUsageEventModel(connection);
  const existingEvent = await QuotaUsageEvent.findOne({ idempotencyKey }).session(session || null).lean();
  if (existingEvent) return { duplicate: true, event: existingEvent };

  const quotaPeriod = await ensureQuotaPeriod(connection, tenantId, subscription, { session, at });
  const current = quotaPeriod.quotas[quotaKey];
  if (!current) throw new Error(`Unknown quota key: ${quotaKey}`);

  const stateBefore = calculateQuotaState(current.toObject ? current.toObject() : current);
  const consumedAfter = current.consumed + units;
  const wouldExceedLimit = stateBefore.effectiveLimit !== null && consumedAfter > stateBefore.effectiveLimit;
  const path = `quotas.${quotaKey}`;

  await QuotaPeriod.updateOne(
    { _id: quotaPeriod._id },
    {
      $inc: {
        [`${path}.consumed`]: units,
        [`${path}.wouldBlockAttempts`]: wouldExceedLimit ? 1 : 0,
      },
    },
    { session }
  );

  const [event] = await QuotaUsageEvent.create(
    [
      {
        eventId: `QEV-${crypto.randomUUID()}`,
        idempotencyKey,
        tenantId,
        periodKey: quotaPeriod.periodKey,
        quotaKey,
        type: wouldExceedLimit ? "would-block" : "consumed",
        units,
        consumedBefore: current.consumed,
        consumedAfter,
        effectiveLimit: stateBefore.effectiveLimit,
        wouldExceedLimit,
        relatedResourceType,
        relatedResourceId,
        actorId,
        actorEmail,
        metadata,
      },
    ],
    { session }
  );

  return {
    duplicate: false,
    event,
    quota: calculateQuotaState({ ...stateBefore, consumed: consumedAfter }),
  };
}

export function serializeQuotaPeriod(period) {
  if (!period) return null;
  const source = period.toObject ? period.toObject() : period;
  return {
    periodKey: source.periodKey,
    periodStart: source.periodStart,
    periodEnd: source.periodEnd,
    packageKey: source.packageKey,
    packageName: source.packageName,
    packageVersion: source.packageVersion,
    enforcementMode: source.enforcementMode,
    quotas: Object.fromEntries(
      Object.entries(source.quotas || {}).map(([key, quota]) => [key, calculateQuotaState(quota)])
    ),
  };
}
