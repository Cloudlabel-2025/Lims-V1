import mongoose from "mongoose";
import { jsonError } from "@/app/lib/api-response";
import { requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";
import { getTenantModels } from "@/app/lib/tenant-db";

function clean(value) {
  return String(value || "").trim();
}

function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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
      return Response.json({ error: "Invalid item id" }, { status: 400 });
    }

    const body = await req.json();
    const { InventoryItem } = await getTenantModels(auth.tenantId);
    const item = await InventoryItem.findById(id);
    if (!item) return Response.json({ error: "Inventory item not found" }, { status: 404 });

    const fields = [
      "name",
      "genericName",
      "itemType",
      "preferredSupplier",
      "manufacturer",
      "storageCondition",
      "defaultLocation",
      "notes",
      "status",
    ];

    fields.forEach((field) => {
      if (body[field] !== undefined) item[field] = clean(body[field]);
    });

    if (body.itemCode !== undefined) item.itemCode = clean(body.itemCode).toUpperCase();
    if (mongoose.Types.ObjectId.isValid(body.category)) item.category = body.category;
    item.subCategory = mongoose.Types.ObjectId.isValid(body.subCategory) ? body.subCategory : null;
    if (mongoose.Types.ObjectId.isValid(body.baseUom)) item.baseUom = body.baseUom;
    if (mongoose.Types.ObjectId.isValid(body.purchaseUom)) item.purchaseUom = body.purchaseUom;
    if (body.purchaseToBaseFactor !== undefined) item.purchaseToBaseFactor = numberValue(body.purchaseToBaseFactor, 1);
    if (body.minimumStockBase !== undefined) item.minimumStockBase = numberValue(body.minimumStockBase, 0);
    if (body.reorderLevelBase !== undefined) item.reorderLevelBase = numberValue(body.reorderLevelBase, 0);
    if (body.maximumStockBase !== undefined) item.maximumStockBase = numberValue(body.maximumStockBase, 0);
    if (body.trackExpiry !== undefined) item.trackExpiry = Boolean(body.trackExpiry);

    await item.save();

    const populated = await InventoryItem.findById(item._id)
      .populate("category", "name code")
      .populate("subCategory", "name code")
      .populate("baseUom", "name symbol type conversionToBase")
      .populate("purchaseUom", "name symbol type conversionToBase");

    return Response.json({ item: populated });
  } catch (error) {
    if (error.code === 11000) {
      return Response.json({ error: "Inventory item code already exists" }, { status: 409 });
    }

    return jsonError("Unable to update inventory item", error, 500);
  }
}
