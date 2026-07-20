import mongoose from "mongoose";
import { jsonError } from "@/app/lib/api-response";
import { writeAuditLog } from "@/app/lib/audit";
import { requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";
import { getTenantModels } from "@/app/lib/tenant-db";
import { processExpiredBatches } from "@/app/lib/inventory-expiry";

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

function isValidItemCode(value) {
  return /^[A-Z0-9-]*$/.test(value);
}

function hasUrl(value) {
  return /https?:\/\//.test(value);
}

const fieldMap = {
  "Item code": "itemCode", "Item name": "name", "Generic name": "genericName",
  "Supplier": "preferredSupplier", "Manufacturer": "manufacturer",
  "Storage condition": "storageCondition", "Location": "defaultLocation",
  "Conversion factor": "purchaseToBaseFactor", "Min stock": "minimumStockBase",
  "Reorder level": "reorderLevelBase", "Max stock": "maximumStockBase",
  "Status": "status", "Invalid conversion factor": "conversionFactorUnit",
  "Invalid item type": "itemType", "Invalid storage condition": "storageCondition",
};

function fieldError(message) {
  let field;
  for (const [prefix, f] of Object.entries(fieldMap)) {
    if (message.startsWith(prefix)) { field = f; break; }
  }
  const body = { error: message };
  if (field) body.fieldErrors = { [field]: message };
  return body;
}

function isExponential(value) {
  if (value === undefined || value === null) return false;
  return /[eE]/.test(String(value));
}

function isValidDecimal(value, intMax = 4, fracMax = 3) {
  if (value === "" || value === undefined || value === null) return true;
  return new RegExp(`^\\d{0,${intMax}}(\\.\\d{0,${fracMax}})?$`).test(String(value));
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

    await processExpiredBatches(auth.tenantId);

    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return Response.json({ error: "Invalid item id" }, { status: 400 });
    }

    const body = await req.json();
    const { InventoryItem, InventoryItemType, InventoryStorageCondition } = await getTenantModels(auth.tenantId);
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
      "conversionFactorUnit",
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
    if (body.quarantineOnReceipt !== undefined) item.quarantineOnReceipt = Boolean(body.quarantineOnReceipt);

    if (body.name !== undefined && body.name !== null && clean(body.name)) {
      const v = clean(body.name);
      if (v.length > 60) return Response.json(fieldError("Item name must not exceed 60 characters"), { status: 400 });
      if ((v.match(/-/g) || []).length > 1) return Response.json(fieldError("Item name can contain at most one hyphen"), { status: 400 });
      if (!/^[A-Za-z0-9 -]*$/.test(v)) return Response.json(fieldError("Item name must contain only letters, numbers, spaces, and one hyphen"), { status: 400 });
    }
    if (body.genericName !== undefined && clean(body.genericName) && !/^[A-Za-z0-9]+$/.test(clean(body.genericName))) {
      return Response.json(fieldError("Generic name must contain only letters and numbers"), { status: 400 });
    }
    if (body.genericName !== undefined && clean(body.genericName) && clean(body.genericName).length > 60) {
      return Response.json(fieldError("Generic name must not exceed 60 characters"), { status: 400 });
    }
    if (body.itemCode !== undefined) {
      const code = clean(body.itemCode);
      if (!isValidItemCode(code)) return Response.json(fieldError("Item code must contain only capital letters, numbers, and hyphens"), { status: 400 });
      if (code.length > 15) return Response.json(fieldError("Item code must not exceed 15 characters"), { status: 400 });
    }
    if (body.storageCondition !== undefined && clean(body.storageCondition)) {
      const validConditions = await InventoryStorageCondition.find({}).lean();
      if (validConditions.length > 0 && !validConditions.some((c) => c.name === clean(body.storageCondition))) {
        return Response.json(fieldError("Invalid storage condition"), { status: 400 });
      }
    }
    if (body.purchaseToBaseFactor !== undefined) {
      if (isExponential(body.purchaseToBaseFactor)) return Response.json(fieldError("Exponential notation is not allowed in conversion factor"), { status: 400 });
      if (!isValidDecimal(body.purchaseToBaseFactor)) return Response.json(fieldError("Conversion factor must have max 4 digits before decimal, 3 after"), { status: 400 });
    }
    if (body.minimumStockBase !== undefined) {
      if (isExponential(body.minimumStockBase)) return Response.json(fieldError("Exponential notation is not allowed in min stock"), { status: 400 });
      if (!isValidDecimal(body.minimumStockBase)) return Response.json(fieldError("Min stock must have max 4 digits before decimal, 3 after"), { status: 400 });
    }
    if (body.reorderLevelBase !== undefined) {
      if (isExponential(body.reorderLevelBase)) return Response.json(fieldError("Exponential notation is not allowed in reorder level"), { status: 400 });
      if (!isValidDecimal(body.reorderLevelBase)) return Response.json(fieldError("Reorder level must have max 4 digits before decimal, 3 after"), { status: 400 });
    }
    if (body.maximumStockBase !== undefined) {
      if (isExponential(body.maximumStockBase)) return Response.json(fieldError("Exponential notation is not allowed in max stock"), { status: 400 });
      if (!isValidDecimal(body.maximumStockBase)) return Response.json(fieldError("Max stock must have max 4 digits before decimal, 3 after"), { status: 400 });
    }
    if (body.status !== undefined && !["active", "inactive"].includes(body.status)) {
      return Response.json(fieldError("Status must be 'active' or 'inactive'"), { status: 400 });
    }
    const validConvUnits = ["mg", "g", "kg", "ml", "l", "IU", "µg", "unit", "pack", "oz", "lb"];
    if (body.conversionFactorUnit !== undefined && !validConvUnits.includes(body.conversionFactorUnit)) {
      return Response.json(fieldError("Invalid conversion factor unit"), { status: 400 });
    }
    if (body.itemType !== undefined) {
      const validTypes = await InventoryItemType.find({}).lean();
      if (validTypes.length > 0 && !validTypes.some((t) => t.name === body.itemType)) {
        return Response.json(fieldError("Invalid item type"), { status: 400 });
      }
    }
    if (body.minimumStockBase !== undefined && body.reorderLevelBase !== undefined) {
      const minVal = Number(body.minimumStockBase);
      const reorderVal = Number(body.reorderLevelBase);
      if (!isNaN(minVal) && !isNaN(reorderVal) && minVal > reorderVal) {
        return Response.json(fieldError("Min stock cannot exceed reorder level"), { status: 400 });
      }
    }
    if (body.reorderLevelBase !== undefined && body.maximumStockBase !== undefined) {
      const reorderVal = Number(body.reorderLevelBase);
      const maxVal = Number(body.maximumStockBase);
      if (!isNaN(reorderVal) && !isNaN(maxVal) && reorderVal > maxVal) {
        return Response.json(fieldError("Reorder level cannot exceed max stock"), { status: 400 });
      }
    }
    if (body.minimumStockBase !== undefined && body.maximumStockBase !== undefined) {
      const minVal = Number(body.minimumStockBase);
      const maxVal = Number(body.maximumStockBase);
      if (!isNaN(minVal) && !isNaN(maxVal) && minVal > maxVal) {
        return Response.json(fieldError("Min stock cannot exceed max stock"), { status: 400 });
      }
    }

    await item.save();

    writeAuditLog(req, auth, {
      action: "update",
      resourceType: "InventoryItem",
      resourceId: item._id,
      metadata: { name: item.name, itemCode: item.itemCode, changes: Object.keys(body) },
    }).catch(() => {});

    const populated = await InventoryItem.findById(item._id)
      .populate("category", "name code")
      .populate("subCategory", "name code")
      .populate("baseUom", "name symbol type baseSymbol conversionToBase")
      .populate("purchaseUom", "name symbol type baseSymbol conversionToBase");

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
