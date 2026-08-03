import { getTenantModels } from "@/app/lib/tenant-db";
import { hasPermission } from "@/app/lib/auth";

export async function buildNotifications(tenantId, session) {
  const { Doctor, InventoryItem, Sample } = await getTenantModels(tenantId);
  const canViewDoctors = hasPermission(session, "doctors.view");
  const canViewInventory = hasPermission(session, "inventory.view");
  const canViewSamples = hasPermission(session, "samples.view");

  const notifications = [];
  const activeTypes = [];

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
