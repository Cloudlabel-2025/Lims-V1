import mongoose from "mongoose";
import { jsonError } from "@/app/lib/api-response";
import { writeAuditLog } from "@/app/lib/audit";
import { requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";
import { getTenantModels } from "@/app/lib/tenant-db";

function clean(value) {
  return String(value || "").trim();
}

function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isValidName(value) {
  return /^[A-Za-z0-9 .&'\/,()@_-]*$/.test(value);
}

function hasUrl(value) {
  return /https?:\/\//.test(value);
}

function isExponential(value) {
  if (value === undefined || value === null) return false;
  return /[eE]/.test(String(value));
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

    if (body.name !== undefined && body.name !== null && clean(body.name) && hasUrl(body.name)) {
      return Response.json({ error: "URLs are not allowed in item name" }, { status: 400 });
    }
    if (body.name !== undefined && body.name !== null && clean(body.name) && !isValidName(clean(body.name))) {
      return Response.json({ error: "Item name contains invalid characters" }, { status: 400 });
    }
    if (body.genericName !== undefined && clean(body.genericName) && hasUrl(body.genericName)) {
      return Response.json({ error: "URLs are not allowed in generic name" }, { status: 400 });
    }
    if (body.genericName !== undefined && clean(body.genericName) && !isValidName(clean(body.genericName))) {
      return Response.json({ error: "Generic name contains invalid characters" }, { status: 400 });
    }
    if (body.itemCode !== undefined) {
      const code = clean(body.itemCode);
      if (hasUrl(code)) return Response.json({ error: "URLs are not allowed in item code" }, { status: 400 });
      if (!isValidName(code)) return Response.json({ error: "Item code contains invalid characters" }, { status: 400 });
    }
    if (body.preferredSupplier !== undefined && clean(body.preferredSupplier) && hasUrl(body.preferredSupplier)) {
      return Response.json({ error: "URLs are not allowed in supplier" }, { status: 400 });
    }
    if (body.preferredSupplier !== undefined && clean(body.preferredSupplier) && !isValidName(clean(body.preferredSupplier))) {
      return Response.json({ error: "Supplier contains invalid characters" }, { status: 400 });
    }
    if (body.manufacturer !== undefined && clean(body.manufacturer) && hasUrl(body.manufacturer)) {
      return Response.json({ error: "URLs are not allowed in manufacturer" }, { status: 400 });
    }
    if (body.manufacturer !== undefined && clean(body.manufacturer) && !isValidName(clean(body.manufacturer))) {
      return Response.json({ error: "Manufacturer contains invalid characters" }, { status: 400 });
    }
    if (body.storageCondition !== undefined && clean(body.storageCondition) && hasUrl(body.storageCondition)) {
      return Response.json({ error: "URLs are not allowed in storage condition" }, { status: 400 });
    }
    if (body.storageCondition !== undefined && clean(body.storageCondition) && !isValidName(clean(body.storageCondition))) {
      return Response.json({ error: "Storage condition contains invalid characters" }, { status: 400 });
    }
    if (body.defaultLocation !== undefined && clean(body.defaultLocation) && hasUrl(body.defaultLocation)) {
      return Response.json({ error: "URLs are not allowed in location" }, { status: 400 });
    }
    if (body.defaultLocation !== undefined && clean(body.defaultLocation) && !isValidName(clean(body.defaultLocation))) {
      return Response.json({ error: "Location contains invalid characters" }, { status: 400 });
    }
    if (body.purchaseToBaseFactor !== undefined && isExponential(body.purchaseToBaseFactor)) {
      return Response.json({ error: "Exponential notation is not allowed in conversion factor" }, { status: 400 });
    }
    if (body.minimumStockBase !== undefined && isExponential(body.minimumStockBase)) {
      return Response.json({ error: "Exponential notation is not allowed in min stock" }, { status: 400 });
    }
    if (body.reorderLevelBase !== undefined && isExponential(body.reorderLevelBase)) {
      return Response.json({ error: "Exponential notation is not allowed in reorder level" }, { status: 400 });
    }
    if (body.maximumStockBase !== undefined && isExponential(body.maximumStockBase)) {
      return Response.json({ error: "Exponential notation is not allowed in max stock" }, { status: 400 });
    }

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

export async function DELETE(req, context) {
  try {
    const auth = await requireInventory(req);
    if (auth.error) return auth.error;

    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return Response.json({ error: "Invalid item id" }, { status: 400 });
    }

    const { InventoryItem } = await getTenantModels(auth.tenantId);
    const item = await InventoryItem.findById(id);
    if (!item) return Response.json({ error: "Inventory item not found" }, { status: 404 });

    item.status = "inactive";
    await item.save();

    await writeAuditLog(req, auth, {
      action: "inventory.item_deleted",
      resourceType: "InventoryItem",
      resourceId: item._id,
      metadata: { name: item.name, itemCode: item.itemCode },
    });

    return Response.json({ message: "Inventory item deactivated successfully" });
  } catch (error) {
    return jsonError("Unable to delete inventory item", error, 500);
  }
}
