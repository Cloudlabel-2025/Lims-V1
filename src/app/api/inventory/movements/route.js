import mongoose from "mongoose";
import { jsonError } from "@/app/lib/api-response";
import { requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";
import { getTenantModels } from "@/app/lib/tenant-db";

function clean(value) {
  return String(value || "").trim();
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function requireInventory(req, permission = "inventory.view") {
  const auth = requireTenantSession(req, permission);
  if (auth.error) return { error: auth.error };
  const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "inventory.view");
  if (moduleAuth.error) return { error: moduleAuth.error };
  return auth;
}

export async function GET(req) {
  try {
    const auth = await requireInventory(req);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, Number.parseInt(searchParams.get("limit") || "50", 10)));
    const type = clean(searchParams.get("type"));
    const search = clean(searchParams.get("search"));
    const dateFrom = clean(searchParams.get("dateFrom"));
    const dateTo = clean(searchParams.get("dateTo"));

    const { InventoryMovement } = await getTenantModels(auth.tenantId);
    const filter = {};

    if (type) filter.movementType = type;
    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      filter.$or = [
        { referenceNo: regex },
        { reason: regex },
        { fromLocation: regex },
        { toLocation: regex },
      ];
    }
    if (dateFrom || dateTo) {
      filter.movementDate = {};
      if (dateFrom) filter.movementDate.$gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        filter.movementDate.$lte = end;
      }
    }

    const [movements, total] = await Promise.all([
      InventoryMovement.find(filter)
        .populate("item", "name itemCode")
        .sort({ movementDate: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      InventoryMovement.countDocuments(filter),
    ]);

    return Response.json({
      movements,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (error) {
    return jsonError("Unable to load movements", error, 500);
  }
}
