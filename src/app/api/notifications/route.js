import { jsonError } from "@/app/lib/api-response";
import { getTenantModels } from "@/app/lib/tenant-db";
import { hasPermission, requireTenantSession } from "@/app/lib/auth";
import { ensureQuotaPeriod, serializeQuotaPeriod } from "@/app/lib/quota-meter";
import { getLabSubscriptionEntitlements } from "@/app/lib/subscription-service";

export async function GET(req) {
  try {
    const auth = requireTenantSession(req, "dashboard.view");
    if (auth.error) return auth.error;

    const { connection, Doctor, InventoryItem, QuotaPeriod, Sample, User } = await getTenantModels(auth.tenantId);
    const canViewDoctors = hasPermission(auth.session, "doctors.view");
    const canViewInventory = hasPermission(auth.session, "inventory.view");
    const canViewSamples = hasPermission(auth.session, "samples.view");
    const canManageSettings = hasPermission(auth.session, "settings.manage");

    const notifications = [];

    if (canManageSettings) {
      const subscription = await getLabSubscriptionEntitlements(auth.tenantId);
      let quotaPeriod = await ensureQuotaPeriod(connection, auth.tenantId, subscription);
      const activeStaffUsers = await User.countDocuments({ status: "active" });
      await QuotaPeriod.updateOne(
        { _id: quotaPeriod._id },
        { $set: { "quotas.staffUsers.consumed": activeStaffUsers } }
      );
      quotaPeriod = await QuotaPeriod.findById(quotaPeriod._id);
      const usage = serializeQuotaPeriod(quotaPeriod);
      const quotaLabels = {
        patientRegistrations: "patient registrations",
        billingRecords: "billing records",
        staffUsers: "staff users",
      };

      if (["past_due", "grace_period", "paused", "expired"].includes(subscription.status)) {
        notifications.push({
          id: `subscription-status-${subscription.status}`,
          title: "Subscription needs attention",
          detail: `${subscription.packageName} is ${String(subscription.status).replace("_", " ")}. Review the subscription to avoid service interruption.`,
          href: "/subscription",
          priority: ["paused", "expired"].includes(subscription.status) ? "critical" : "high",
        });
      }

      const daysUntilPeriodEnd = Math.ceil(
        (new Date(subscription.currentPeriodEnd).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
      );
      if (daysUntilPeriodEnd >= 0 && daysUntilPeriodEnd <= 7) {
        notifications.push({
          id: `subscription-period-end-${new Date(subscription.currentPeriodEnd).toISOString().slice(0, 10)}`,
          title: "Subscription period ending soon",
          detail: `${subscription.packageName} renews or resets in ${daysUntilPeriodEnd === 0 ? "less than one day" : `${daysUntilPeriodEnd} day(s)`}.`,
          href: "/subscription",
          priority: "normal",
        });
      }

      if (subscription.assignedAt && Date.now() - new Date(subscription.assignedAt).getTime() <= 7 * 24 * 60 * 60 * 1000) {
        notifications.push({
          id: `subscription-assigned-${new Date(subscription.assignedAt).getTime()}`,
          title: `${subscription.packageName} package assigned`,
          detail: "Review your included modules and monthly usage allowances.",
          href: "/subscription",
          priority: "normal",
        });
      }

      Object.entries(usage?.quotas || {}).forEach(([key, quota]) => {
        if (quota.unlimited || quota.utilizationPercent === null || quota.utilizationPercent < 80) return;
        const atLimit = quota.remaining <= 0;
        notifications.push({
          id: `subscription-quota-${key}-${usage.periodKey}-${atLimit ? "limit" : Math.floor(quota.utilizationPercent / 5) * 5}`,
          title: atLimit ? `${quotaLabels[key]} allowance reached` : `${quotaLabels[key]} usage is high`,
          detail: `${quota.consumed} of ${quota.effectiveLimit} used this period${atLimit ? ". Contact support to upgrade or add capacity." : `; ${quota.remaining} remaining.`}`,
          href: "/subscription",
          priority: atLimit ? "critical" : quota.utilizationPercent >= 90 ? "high" : "normal",
        });
      });
    }

    if (canViewDoctors) {
      const unavailableDoctors = await Doctor.countDocuments({
        status: { $in: ["Inactive", "On Leave"] },
      });
      if (unavailableDoctors > 0) {
        notifications.push({
          id: "doctor-availability",
          title: "Doctor availability needs review",
          detail: `${unavailableDoctors} doctor(s) are inactive or marked on leave.`,
          href: "/doctors",
          priority: "high",
        });
      }
    }

    if (canViewInventory) {
      const lowStockItems = await InventoryItem.countDocuments({
        status: "active",
        $expr: { $lte: ["$stockOnHandBase", "$reorderLevelBase"] },
      });
      if (lowStockItems > 0) {
        notifications.push({
          id: "inventory-low-stock",
          title: "Inventory items below reorder level",
          detail: `${lowStockItems} item(s) need restocking.`,
          href: "/inventory",
          priority: lowStockItems > 5 ? "critical" : "high",
        });
      }
    }

    if (canViewSamples) {
      const staleSamples = await Sample.countDocuments({
        status: "in-testing",
        createdAt: { $lte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      });
      if (staleSamples > 0) {
        notifications.push({
          id: "stale-samples",
          title: "Stale testing samples",
          detail: `${staleSamples} sample(s) in testing for over 24 hours.`,
          href: "/samples",
          priority: "normal",
          permissionAny: ["samples.view"],
        });
      }
    }

    return Response.json({ notifications });
  } catch (error) {
    return jsonError("Unable to fetch notifications", error, 500);
  }
}
