import { jsonError } from "@/app/lib/api-response";
import { getTenantModels } from "@/app/lib/tenant-db";
import { hasPermission, requireTenantSession } from "@/app/lib/auth";

export async function GET(req) {
  try {
    const auth = requireTenantSession(req, "dashboard.view");
    if (auth.error) return auth.error;

    const { Doctor, InventoryItem, Sample } = await getTenantModels(auth.tenantId);
    const canViewDoctors = hasPermission(auth.session, "doctors.view");
    const canViewInventory = hasPermission(auth.session, "inventory.view");
    const canViewSamples = hasPermission(auth.session, "samples.view");

    const notifications = [];

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
