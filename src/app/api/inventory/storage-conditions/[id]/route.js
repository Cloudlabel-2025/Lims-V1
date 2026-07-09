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
      return Response.json({ error: "Invalid storage condition id" }, { status: 400 });
    }

    const body = await req.json();
    const name = clean(body.name);
    if (!name) return Response.json({ error: "Storage condition name is required" }, { status: 400 });

    const { InventoryStorageCondition } = await getTenantModels(auth.tenantId);
    const storageCondition = await InventoryStorageCondition.findById(id);
    if (!storageCondition) return Response.json({ error: "Storage condition not found" }, { status: 404 });

    const duplicate = await InventoryStorageCondition.findOne({ name: new RegExp(`^${escapeRegex(name)}$`, "i"), _id: { $ne: id } });
    if (duplicate) return Response.json({ error: "Storage condition already exists" }, { status: 409 });

    storageCondition.name = name;
    await storageCondition.save();
    return Response.json({ storageCondition });
  } catch (error) {
    return jsonError("Unable to update storage condition", error, 500);
  }
}

export async function DELETE(req, context) {
  try {
    const auth = await requireInventory(req);
    if (auth.error) return auth.error;

    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return Response.json({ error: "Invalid storage condition id" }, { status: 400 });
    }

    const { InventoryStorageCondition, InventoryItem } = await getTenantModels(auth.tenantId);
    const storageCondition = await InventoryStorageCondition.findById(id);
    if (!storageCondition) return Response.json({ error: "Storage condition not found" }, { status: 404 });

    const inUse = await InventoryItem.countDocuments({ storageCondition: storageCondition.name });
    if (inUse > 0) {
      return Response.json({ error: `Cannot delete "${storageCondition.name}" - it is used by ${inUse} item(s)` }, { status: 400 });
    }

    await InventoryStorageCondition.findByIdAndDelete(id);
    return Response.json({ message: "Storage condition deleted" });
  } catch (error) {
    return jsonError("Unable to delete storage condition", error, 500);
  }
}
