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

function isValidName(value) {
  return /^[A-Za-z0-9 .&'\/,()@_-]*$/.test(value);
}

function isLettersOnly(value) {
  return /^[A-Za-z\s]*$/.test(value);
}

function hasUrl(value) {
  return /https?:\/\//.test(value);
}

function isExponential(value) {
  if (value === undefined || value === null) return false;
  return /[eE]/.test(String(value));
}

function dateValue(value) {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function expiryState(item) {
  const now = new Date();
  const warning = new Date(now);
  warning.setDate(warning.getDate() + 30);

  const activeBatches = (item.batches || []).filter((batch) => batch.quantityBase > 0);
  const expired = activeBatches.filter((batch) => batch.expiryDate && new Date(batch.expiryDate) < now);
  const nearExpiry = activeBatches.filter((batch) => {
    if (!batch.expiryDate) return false;
    const expiry = new Date(batch.expiryDate);
    return expiry >= now && expiry <= warning;
  });

  return {
    expiredBatches: expired.length,
    nearExpiryBatches: nearExpiry.length,
    nextExpiryDate: activeBatches
      .filter((batch) => batch.expiryDate)
      .map((batch) => new Date(batch.expiryDate))
      .sort((a, b) => a - b)[0],
  };
}

async function requireInventory(req, permission = "inventory.view") {
  const auth = requireTenantSession(req, permission);
  if (auth.error) return { error: auth.error };

  const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "inventory.view");
  if (moduleAuth.error) return { error: moduleAuth.error };

  return auth;
}

async function loadInventory(auth, req) {
  const { searchParams } = new URL(req.url);
  const search = clean(searchParams.get("search"));
  const status = clean(searchParams.get("status"));
  const category = clean(searchParams.get("category"));

  const { InventoryCategory, InventoryItem, InventoryMovement, InventoryUom } = await getTenantModels(auth.tenantId);
  const itemQuery = {};

  if (status && status !== "all") itemQuery.status = status;
  if (category && mongoose.Types.ObjectId.isValid(category)) itemQuery.category = category;
  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    itemQuery.$or = [{ name: regex }, { itemCode: regex }, { genericName: regex }, { manufacturer: regex }];
  }

  const [categories, uoms, items, movements] = await Promise.all([
    InventoryCategory.find({}).populate("parentCategory", "name code").sort({ parentCategory: 1, name: 1 }).lean(),
    InventoryUom.find({}).sort({ type: 1, name: 1 }).lean(),
    InventoryItem.find(itemQuery)
      .populate("category", "name code")
      .populate("subCategory", "name code")
      .populate("baseUom", "name symbol type conversionToBase")
      .populate("purchaseUom", "name symbol type conversionToBase")
      .sort({ updatedAt: -1 })
      .limit(250)
      .lean(),
    InventoryMovement.find({})
      .populate("item", "name itemCode")
      .sort({ movementDate: -1, createdAt: -1 })
      .limit(80)
      .lean(),
  ]);

  const decoratedItems = items.map((item) => ({ ...item, ...expiryState(item) }));
  const stats = decoratedItems.reduce(
    (acc, item) => {
      acc.totalItems += 1;
      acc.totalStock += item.stockOnHandBase || 0;
      if (item.stockOnHandBase <= item.minimumStockBase) acc.lowStock += 1;
      if (item.reorderLevelBase && item.stockOnHandBase <= item.reorderLevelBase) acc.reorderDue += 1;
      acc.expiredBatches += item.expiredBatches;
      acc.nearExpiryBatches += item.nearExpiryBatches;
      acc.inventoryValue += (item.batches || []).reduce(
        (sum, batch) => sum + (batch.quantityBase || 0) * (batch.costPerBaseUnit || 0),
        0
      );
      return acc;
    },
    { totalItems: 0, totalStock: 0, lowStock: 0, reorderDue: 0, expiredBatches: 0, nearExpiryBatches: 0, inventoryValue: 0 }
  );

  return { categories, uoms, items: decoratedItems, movements, stats };
}

export async function GET(req) {
  try {
    const auth = await requireInventory(req);
    if (auth.error) return auth.error;

    const inventory = await loadInventory(auth, req);
    return Response.json(inventory);
  } catch (error) {
    return jsonError("Unable to load inventory", error, 500);
  }
}

export async function POST(req) {
  try {
    const auth = await requireInventory(req, "inventory.manage");
    if (auth.error) return auth.error;

    const body = await req.json();
    const action = clean(body.action);
    const { InventoryCategory, InventoryItem, InventoryMovement, InventoryUom } = await getTenantModels(auth.tenantId);

    if (action === "category") {
      const name = clean(body.name);
      if (!name) return Response.json({ error: "Category name is required" }, { status: 400 });
      if (!isValidName(name)) return Response.json({ error: "Category name contains invalid characters" }, { status: 400 });
      if (hasUrl(name)) return Response.json({ error: "URLs are not allowed in category name" }, { status: 400 });

      const code = clean(body.code);
      if (!code) return Response.json({ error: "Category code is required" }, { status: 400 });
      if (!isValidName(code)) return Response.json({ error: "Category code contains invalid characters" }, { status: 400 });
      if (hasUrl(code)) return Response.json({ error: "URLs are not allowed in category code" }, { status: 400 });

      const category = await InventoryCategory.create({
        name,
        code,
        parentCategory: mongoose.Types.ObjectId.isValid(body.parentCategory) ? body.parentCategory : null,
        description: clean(body.description),
        status: body.status === "inactive" ? "inactive" : "active",
      });

      return Response.json({ category }, { status: 201 });
    }

    if (action === "uom") {
      const name = clean(body.name);
      const symbol = clean(body.symbol);
      if (!name || !symbol) return Response.json({ error: "UOM name and symbol are required" }, { status: 400 });
      if (!isLettersOnly(name)) return Response.json({ error: "UOM name must contain only letters" }, { status: 400 });
      if (hasUrl(name)) return Response.json({ error: "URLs are not allowed in UOM name" }, { status: 400 });
      if (!isValidName(symbol)) return Response.json({ error: "UOM symbol contains invalid characters" }, { status: 400 });
      if (hasUrl(symbol)) return Response.json({ error: "URLs are not allowed in UOM symbol" }, { status: 400 });

      const conv = body.conversionToBase;
      if (conv === undefined || conv === null || conv === "") {
        return Response.json({ error: "Conversion to base is required" }, { status: 400 });
      }
      if (isExponential(conv)) {
        return Response.json({ error: "Exponential notation is not allowed in conversion factor" }, { status: 400 });
      }

      const baseSymbol = clean(body.baseSymbol);
      if (!baseSymbol) return Response.json({ error: "Base symbol is required" }, { status: 400 });
      if (!isValidName(baseSymbol)) return Response.json({ error: "Base symbol contains invalid characters" }, { status: 400 });
      if (hasUrl(baseSymbol)) return Response.json({ error: "URLs are not allowed in base symbol" }, { status: 400 });

      const uom = await InventoryUom.create({
        name,
        symbol,
        type: clean(body.type) || "count",
        conversionToBase: numberValue(body.conversionToBase, 1),
        baseSymbol,
        status: body.status === "inactive" ? "inactive" : "active",
      });

      return Response.json({ uom }, { status: 201 });
    }

    if (action === "item") {
      const itemCode = clean(body.itemCode).toUpperCase();
      const name = clean(body.name);
      if (!itemCode || !name || !mongoose.Types.ObjectId.isValid(body.category) || !mongoose.Types.ObjectId.isValid(body.baseUom)) {
        return Response.json({ error: "Item code, name, category and base UOM are required" }, { status: 400 });
      }
      if (!isValidName(itemCode)) return Response.json({ error: "Item code contains invalid characters" }, { status: 400 });
      if (hasUrl(itemCode)) return Response.json({ error: "URLs are not allowed in item code" }, { status: 400 });
      if (!isValidName(name)) return Response.json({ error: "Item name contains invalid characters" }, { status: 400 });
      if (hasUrl(name)) return Response.json({ error: "URLs are not allowed in item name" }, { status: 400 });

      const genericName = clean(body.genericName);
      if (!genericName) return Response.json({ error: "Generic name is required" }, { status: 400 });
      if (!isValidName(genericName)) return Response.json({ error: "Generic name contains invalid characters" }, { status: 400 });
      if (hasUrl(genericName)) return Response.json({ error: "URLs are not allowed in generic name" }, { status: 400 });

      if (!body.subCategory || !mongoose.Types.ObjectId.isValid(body.subCategory)) {
        return Response.json({ error: "Sub category is required" }, { status: 400 });
      }
      if (!body.purchaseUom || !mongoose.Types.ObjectId.isValid(body.purchaseUom)) {
        return Response.json({ error: "Purchase UOM is required" }, { status: 400 });
      }

      if (body.purchaseToBaseFactor === undefined || body.purchaseToBaseFactor === null || body.purchaseToBaseFactor === "") {
        return Response.json({ error: "Conversion factor is required" }, { status: 400 });
      }
      if (isExponential(body.purchaseToBaseFactor)) {
        return Response.json({ error: "Exponential notation is not allowed in conversion factor" }, { status: 400 });
      }
      if (body.minimumStockBase === undefined || body.minimumStockBase === null || body.minimumStockBase === "") {
        return Response.json({ error: "Min stock is required" }, { status: 400 });
      }
      if (isExponential(body.minimumStockBase)) {
        return Response.json({ error: "Exponential notation is not allowed in min stock" }, { status: 400 });
      }
      if (body.reorderLevelBase === undefined || body.reorderLevelBase === null || body.reorderLevelBase === "") {
        return Response.json({ error: "Reorder level is required" }, { status: 400 });
      }
      if (isExponential(body.reorderLevelBase)) {
        return Response.json({ error: "Exponential notation is not allowed in reorder level" }, { status: 400 });
      }
      if (body.openingQuantityBase === undefined || body.openingQuantityBase === null || body.openingQuantityBase === "") {
        return Response.json({ error: "Opening quantity is required" }, { status: 400 });
      }
      if (isExponential(body.openingQuantityBase)) {
        return Response.json({ error: "Exponential notation is not allowed in opening quantity" }, { status: 400 });
      }

      const manufacturer = clean(body.manufacturer);
      if (!manufacturer) return Response.json({ error: "Manufacturer is required" }, { status: 400 });
      if (!isValidName(manufacturer)) return Response.json({ error: "Manufacturer contains invalid characters" }, { status: 400 });
      if (hasUrl(manufacturer)) return Response.json({ error: "URLs are not allowed in manufacturer" }, { status: 400 });

      const preferredSupplier = clean(body.preferredSupplier);
      if (!preferredSupplier) return Response.json({ error: "Supplier is required" }, { status: 400 });
      if (!isValidName(preferredSupplier)) return Response.json({ error: "Supplier contains invalid characters" }, { status: 400 });
      if (hasUrl(preferredSupplier)) return Response.json({ error: "URLs are not allowed in supplier" }, { status: 400 });

      const batchNo = clean(body.batchNo);
      if (!batchNo) return Response.json({ error: "Batch No is required" }, { status: 400 });
      if (!isValidName(batchNo)) return Response.json({ error: "Batch No contains invalid characters" }, { status: 400 });
      if (hasUrl(batchNo)) return Response.json({ error: "URLs are not allowed in batch number" }, { status: 400 });

      const defaultLocation = clean(body.defaultLocation);
      if (!defaultLocation) return Response.json({ error: "Location is required" }, { status: 400 });
      if (!isValidName(defaultLocation)) return Response.json({ error: "Location contains invalid characters" }, { status: 400 });
      if (hasUrl(defaultLocation)) return Response.json({ error: "URLs are not allowed in location" }, { status: 400 });

      const storageCondition = clean(body.storageCondition);
      if (!storageCondition) return Response.json({ error: "Storage condition is required" }, { status: 400 });
      if (!isValidName(storageCondition)) return Response.json({ error: "Storage condition contains invalid characters" }, { status: 400 });
      if (hasUrl(storageCondition)) return Response.json({ error: "URLs are not allowed in storage condition" }, { status: 400 });

      const openingQty = numberValue(body.openingQuantityBase, 0);
      const openingBatch = openingQty > 0
        ? [{
            batchNo: batchNo || "OPENING",
            supplier: preferredSupplier,
            receivedDate: dateValue(body.receivedDate) || new Date(),
            expiryDate: dateValue(body.expiryDate),
            quantityBase: openingQty,
            costPerBaseUnit: numberValue(body.costPerBaseUnit, 0),
            location: defaultLocation,
          }]
        : [];

      const item = await InventoryItem.create({
        itemCode,
        name,
        genericName,
        category: body.category,
        subCategory: body.subCategory,
        itemType: clean(body.itemType) || "reagent",
        baseUom: body.baseUom,
        purchaseUom: body.purchaseUom,
        purchaseToBaseFactor: numberValue(body.purchaseToBaseFactor, 1),
        stockOnHandBase: openingQty,
        minimumStockBase: numberValue(body.minimumStockBase, 0),
        reorderLevelBase: numberValue(body.reorderLevelBase, 0),
        maximumStockBase: numberValue(body.maximumStockBase, 0),
        preferredSupplier,
        manufacturer,
        storageCondition,
        defaultLocation,
        trackExpiry: body.trackExpiry !== false,
        notes: clean(body.notes),
        batches: openingBatch,
      });

      if (openingQty > 0) {
        await InventoryMovement.create({
          item: item._id,
          batchId: item.batches[0]?._id,
          movementType: "opening",
          quantityBase: openingQty,
          balanceAfterBase: openingQty,
          reason: "Opening stock",
          toLocation: item.defaultLocation,
          performedBy: auth.user?.name || auth.user?.email,
        });
      }

      return Response.json({ item }, { status: 201 });
    }

    if (action === "movement") {
      const item = await InventoryItem.findById(body.itemId);
      if (!item) return Response.json({ error: "Inventory item not found" }, { status: 404 });

      const movementType = clean(body.movementType);
      const allowedTypes = new Set(["receipt", "issue", "adjustment", "transfer", "wastage", "expiry"]);
      if (!allowedTypes.has(movementType)) {
        return Response.json({ error: "Valid movement type is required" }, { status: 400 });
      }

      if (movementType === "receipt") {
        const supplier = clean(body.supplier);
        if (!supplier) return Response.json({ error: "Supplier is required for receipt" }, { status: 400 });
        if (!isValidName(supplier)) return Response.json({ error: "Supplier contains invalid characters" }, { status: 400 });
        if (hasUrl(supplier)) return Response.json({ error: "URLs are not allowed in supplier" }, { status: 400 });
      } else {
        const toLocation = clean(body.toLocation);
        if (!toLocation) return Response.json({ error: "To location is required" }, { status: 400 });
        if (!isValidName(toLocation)) return Response.json({ error: "Location contains invalid characters" }, { status: 400 });
        if (hasUrl(toLocation)) return Response.json({ error: "URLs are not allowed in location" }, { status: 400 });
      }

      const referenceNo = clean(body.referenceNo);
      if (!referenceNo) return Response.json({ error: "Reference No is required" }, { status: 400 });
      if (!isValidName(referenceNo)) return Response.json({ error: "Reference No contains invalid characters" }, { status: 400 });
      if (hasUrl(referenceNo)) return Response.json({ error: "URLs are not allowed in reference number" }, { status: 400 });

      const reason = clean(body.reason);
      if (!reason) return Response.json({ error: "Reason is required" }, { status: 400 });
      if (!isValidName(reason)) return Response.json({ error: "Reason contains invalid characters" }, { status: 400 });
      if (hasUrl(reason)) return Response.json({ error: "URLs are not allowed in reason" }, { status: 400 });

      if (isExponential(body.quantityBase)) {
        return Response.json({ error: "Exponential notation is not allowed in quantity" }, { status: 400 });
      }

      let quantityBase = numberValue(body.quantityBase, 0);
      if (quantityBase <= 0) return Response.json({ error: "Quantity must be greater than zero" }, { status: 400 });

      if (movementType === "receipt") {
        const batch = item.batches.create({
          batchNo: clean(body.batchNo) || `BATCH-${Date.now()}`,
          supplier: clean(body.supplier),
          receivedDate: dateValue(body.receivedDate) || new Date(),
          expiryDate: dateValue(body.expiryDate),
          quantityBase,
          costPerBaseUnit: numberValue(body.costPerBaseUnit, 0),
          location: clean(body.toLocation) || item.defaultLocation,
        });
        item.batches.push(batch);
        item.stockOnHandBase += quantityBase;
        await item.save();

        const movement = await InventoryMovement.create({
          item: item._id,
          batchId: batch._id,
          movementType,
          quantityBase,
          balanceAfterBase: item.stockOnHandBase,
          reason: clean(body.reason) || "Stock receipt",
          referenceNo: clean(body.referenceNo),
          toLocation: batch.location,
          performedBy: auth.user?.name || auth.user?.email,
          movementDate: dateValue(body.movementDate) || new Date(),
        });

        return Response.json({ item, movement }, { status: 201 });
      }

      const selectedBatch = item.batches.id(body.batchId) || item.batches.find((batch) => batch.quantityBase > 0);
      if (!selectedBatch) return Response.json({ error: "A stock batch is required" }, { status: 400 });

      if (movementType === "adjustment") {
        const newBalance = numberValue(body.newBalanceBase, selectedBatch.quantityBase);
        quantityBase = newBalance - selectedBatch.quantityBase;
        selectedBatch.quantityBase = Math.max(0, newBalance);
      } else {
        if (selectedBatch.quantityBase < quantityBase) {
          return Response.json({ error: "Quantity exceeds selected batch balance" }, { status: 400 });
        }
        selectedBatch.quantityBase -= quantityBase;
        if (selectedBatch.quantityBase === 0) selectedBatch.status = movementType === "wastage" ? "wasted" : "consumed";
        quantityBase = -quantityBase;
      }

      item.stockOnHandBase = Math.max(0, item.stockOnHandBase + quantityBase);
      await item.save();

      const movement = await InventoryMovement.create({
        item: item._id,
        batchId: selectedBatch._id,
        movementType,
        quantityBase,
        balanceAfterBase: item.stockOnHandBase,
        reason: clean(body.reason) || movementType,
        referenceNo: clean(body.referenceNo),
        fromLocation: selectedBatch.location,
        toLocation: clean(body.toLocation),
        performedBy: auth.user?.name || auth.user?.email,
        movementDate: dateValue(body.movementDate) || new Date(),
      });

      return Response.json({ item, movement }, { status: 201 });
    }

    return Response.json({ error: "Unsupported inventory action" }, { status: 400 });
  } catch (error) {
    if (error.code === 11000) {
      return Response.json({ error: "Inventory record already exists" }, { status: 409 });
    }

    return jsonError("Unable to save inventory record", error, 500);
  }
}
