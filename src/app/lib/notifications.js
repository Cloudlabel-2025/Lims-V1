import { getTenantModels } from "@/app/lib/tenant-db";
import { hasPermission } from "@/app/lib/auth";
import { ensureQuotaPeriod, serializeQuotaPeriod } from "@/app/lib/quota-meter";
import { getLabSubscriptionEntitlements } from "@/app/lib/subscription-service";

export async function buildNotifications(tenantId, session) {
  const { connection, Doctor, InventoryItem, QuotaPeriod, Sample, TestRequest, User } = await getTenantModels(tenantId);
  const canViewDoctors = hasPermission(session, "doctors.view");
  const canViewInventory = hasPermission(session, "inventory.view");
  const canViewSamples = hasPermission(session, "samples.view");
  const canManageSettings = hasPermission(session, "settings.manage");

  const notifications = [];
  const activeTypes = [];

  if (canManageSettings) {
    const subscription = await getLabSubscriptionEntitlements(tenantId);
    let quotaPeriod = await ensureQuotaPeriod(connection, tenantId, subscription);
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
      const id = `subscription-status-${subscription.status}`;
      activeTypes.push(id);
      notifications.push({
        id,
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
      const id = `subscription-period-end-${new Date(subscription.currentPeriodEnd).toISOString().slice(0, 10)}`;
      activeTypes.push(id);
      notifications.push({
        id,
        title: "Subscription period ending soon",
        detail: `${subscription.packageName} renews or resets in ${daysUntilPeriodEnd === 0 ? "less than one day" : `${daysUntilPeriodEnd} day(s)`}.`,
        href: "/subscription",
        priority: "normal",
      });
    }

    if (subscription.assignedAt && Date.now() - new Date(subscription.assignedAt).getTime() <= 7 * 24 * 60 * 60 * 1000) {
      const id = `subscription-assigned-${new Date(subscription.assignedAt).getTime()}`;
      activeTypes.push(id);
      notifications.push({
        id,
        title: `${subscription.packageName} package assigned`,
        detail: "Review your included modules and monthly usage allowances.",
        href: "/subscription",
        priority: "normal",
      });
    }

    Object.entries(usage?.quotas || {}).forEach(([key, quota]) => {
      if (quota.unlimited || quota.utilizationPercent === null || quota.utilizationPercent < 80) return;
      const atLimit = quota.remaining <= 0;
      const id = `subscription-quota-${key}-${usage.periodKey}-${atLimit ? "limit" : Math.floor(quota.utilizationPercent / 5) * 5}`;
      const label = quotaLabels[key] || key;
      activeTypes.push(id);
      notifications.push({
        id,
        title: atLimit ? `${label} allowance reached` : `${label} usage is high`,
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
      activeTypes.push("doctor-availability");
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
      activeTypes.push("inventory-low-stock");
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
      status: { $in: ["collected", "processing"] },
      createdAt: { $lte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });
    if (staleSamples > 0) {
      activeTypes.push("stale-samples");
      notifications.push({
        id: "stale-samples",
        title: "Stale testing samples",
        detail: `${staleSamples} sample(s) in testing for over 24 hours.`,
        href: "/samples",
        priority: "normal",
      });
    }
  }

  const canViewBilling = hasPermission(session, "billing.view") || hasPermission(session, "billing.create");
  if (canViewBilling && TestRequest) {
    const pendingDoctorRequests = await TestRequest.countDocuments({ status: "pending" });
    if (pendingDoctorRequests > 0) {
      activeTypes.push("doctor-test-requests");
      notifications.push({
        id: "doctor-test-requests",
        title: "New Doctor Test Requests",
        detail: `${pendingDoctorRequests} test request(s) received from Doctor Portal pending lab billing.`,
        href: "/billing",
        priority: "high",
      });
    }
  }

  return { notifications, activeTypes };
}

export async function resolveUnread(tenantId, userId, notifications, activeTypes) {
  const { NotificationRead } = await getTenantModels(tenantId);

  const markers = await NotificationRead.find({ tenantId, userId }).select("type").lean();
  const readSet = new Set(markers.map((marker) => marker.type));

  await NotificationRead.deleteMany({ tenantId, userId, type: { $nin: activeTypes } });

  const withUnread = notifications.map((notification) => ({
    ...notification,
    unread: !readSet.has(notification.id),
  }));

  return {
    notifications: withUnread,
    unreadCount: withUnread.filter((notification) => notification.unread).length,
  };
}
