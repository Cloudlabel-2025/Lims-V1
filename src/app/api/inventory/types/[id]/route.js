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

async function requireInventory(req, permission = "inventory.manage") {
  const auth = requireTenantSession(req, permission);
  if (auth.error) return { error: auth.error };
  const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "inventory.view");
  if (moduleAuth.error) return { error: moduleAuth.error };
  return auth;
}

export async function PATCH(req, context) {
  try {
    const auth = await requireInventory(req);
    if (auth.error) return auth.error;

    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return Response.json({ error: "Invalid item type id" }, { status: 400 });
    }

    const body = await req.json();
    const name = clean(body.name);
    if (!name) return Response.json({ error: "Item type name is required" }, { status: 400 });

    const { InventoryItemType } = await getTenantModels(auth.tenantId);
    const itemType = await InventoryItemType.findById(id);
    if (!itemType) return Response.json({ error: "Item type not found" }, { status: 404 });

    const duplicate = await InventoryItemType.findOne({ name: new RegExp(`^${escapeRegex(name)}$`, "i"), _id: { $ne: id } });
    if (duplicate) return Response.json({ error: "Item type already exists" }, { status: 409 });

    itemType.name = name;
    await itemType.save();
    return Response.json({ itemType });
  } catch (error) {
    return jsonError("Unable to update item type", error, 500);
  }
}

export async function DELETE(req, context) {
  try {
    const auth = await requireInventory(req);
    if (auth.error) return auth.error;

    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return Response.json({ error: "Invalid item type id" }, { status: 400 });
    }

    const { InventoryItemType, InventoryItem } = await getTenantModels(auth.tenantId);
    const itemType = await InventoryItemType.findById(id);
    if (!itemType) return Response.json({ error: "Item type not found" }, { status: 404 });

    const inUse = await InventoryItem.countDocuments({ itemType: itemType.name });
    if (inUse > 0) {
      return Response.json({ error: `Cannot delete "${itemType.name}" - it is used by ${inUse} item(s)` }, { status: 400 });
    }

    await InventoryItemType.findByIdAndDelete(id);
    return Response.json({ message: "Item type deleted" });
  } catch (error) {
    return jsonError("Unable to delete item type", error, 500);
  }
}
