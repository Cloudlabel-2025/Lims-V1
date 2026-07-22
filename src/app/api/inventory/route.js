import mongoose from "mongoose";
import { jsonError } from "@/app/lib/api-response";
import { writeAuditLog } from "@/app/lib/audit";
import { requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";
import { getTenantModels } from "@/app/lib/tenant-db";
import { getAccountByCode, postJournalEntry } from "@/app/lib/accounting";
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

function isValidDecimal(value, intMax = 4, fracMax = 3) {
  if (value === "" || value === undefined || value === null) return true;
  return new RegExp(`^\\d{0,${intMax}}(\\.\\d{0,${fracMax}})?$`).test(String(value));
}

function dateValue(value) {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function validateExpiryDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "Invalid expiry date";
  const year = date.getFullYear();
  if (year < 2000) return "Expiry year looks incorrect";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(year, date.getMonth(), date.getDate());
  if (expiry <= today) return "Expiry date must be in the future";
  const maxFuture = new Date(today.getFullYear() + 15, today.getMonth(), today.getDate());
  if (expiry > maxFuture) return "Expiry date is too far in the future";
  return "";
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
  const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, Number.parseInt(searchParams.get("limit") || "20", 10)));

    const { InventoryCategory, InventoryItem, InventoryMovement, InventoryUom, InventoryItemType, InventoryStorageCondition } = await getTenantModels(auth.tenantId);
  const itemQuery = {};

  if (status && status !== "all") itemQuery.status = status;
  if (category && mongoose.Types.ObjectId.isValid(category)) itemQuery.category = category;
  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    itemQuery.$or = [{ name: regex }, { itemCode: regex }, { genericName: regex }, { manufacturer: regex }];
  }

  const [categories, itemTypes, storageConditions, items, total, movements] = await Promise.all([
    InventoryCategory.find({}).populate("parentCategory", "name code").sort({ parentCategory: 1, name: 1 }).lean(),
    InventoryItemType.find({}).sort({ name: 1 }).lean(),
    InventoryStorageCondition.find({}).sort({ name: 1 }).lean(),
    InventoryItem.find(itemQuery)
      .populate("category", "name code")
      .populate("subCategory", "name code")
      .populate("baseUom", "name symbol type baseSymbol conversionToBase")
      .populate("purchaseUom", "name symbol type baseSymbol conversionToBase")
      .populate("preferredSupplierRef", "name code")
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    InventoryItem.countDocuments(itemQuery),
    InventoryMovement.find({})
      .populate("item", "name itemCode")
      .sort({ movementDate: -1, createdAt: -1 })
      .limit(80)
      .lean(),
  ]);

  let uoms = await InventoryUom.find({}).sort({ type: 1, name: 1 }).lean();
  const defaultUoms = [
    { name: "Microgram", symbol: "mcg", type: "weight", conversionToBase: 0.000001, baseSymbol: "g" },
    { name: "Milligram", symbol: "mg", type: "weight", conversionToBase: 0.001, baseSymbol: "g" },
    { name: "Gram", symbol: "g", type: "weight", conversionToBase: 1, baseSymbol: "g" },
    { name: "Kilogram", symbol: "kg", type: "weight", conversionToBase: 1000, baseSymbol: "g" },
    { name: "Milliliter", symbol: "mL", type: "volume", conversionToBase: 0.001, baseSymbol: "L" },
    { name: "Liter", symbol: "L", type: "volume", conversionToBase: 1, baseSymbol: "L" },
    { name: "Units", symbol: "units", type: "count", conversionToBase: 1, baseSymbol: "units" },
    { name: "Each", symbol: "each", type: "count", conversionToBase: 1, baseSymbol: "each" },
    { name: "Dozen", symbol: "dozen", type: "count", conversionToBase: 12, baseSymbol: "each" },
    { name: "Box of 10", symbol: "box10", type: "pack", conversionToBase: 10, baseSymbol: "each" },
    { name: "Box of 50", symbol: "box50", type: "pack", conversionToBase: 50, baseSymbol: "each" },
    { name: "Strip of 10", symbol: "strip10", type: "pack", conversionToBase: 10, baseSymbol: "each" },
    { name: "Vial", symbol: "vial", type: "pack", conversionToBase: 1, baseSymbol: "each" },
    { name: "Pair", symbol: "pair", type: "count", conversionToBase: 2, baseSymbol: "each" },
  ];
  if (uoms.length === 0) {
    await InventoryUom.insertMany(defaultUoms);
    uoms = await InventoryUom.find({}).sort({ type: 1, name: 1 }).lean();
  }

  const decoratedItems = items.map((item) => ({ ...item, ...expiryState(item) }));
  const stats = {
    totalItems: total,
    totalStock: decoratedItems.reduce((acc, item) => acc + (item.stockOnHandBase || 0), 0),
    lowStock: decoratedItems.filter((item) => item.stockOnHandBase <= item.minimumStockBase).length,
    reorderDue: decoratedItems.filter((item) => item.reorderLevelBase && item.stockOnHandBase <= item.reorderLevelBase).length,
    expiredBatches: decoratedItems.reduce((acc, item) => acc + item.expiredBatches, 0),
    nearExpiryBatches: decoratedItems.reduce((acc, item) => acc + item.nearExpiryBatches, 0),
    quarantineBatches: decoratedItems.reduce((acc, item) => acc + (item.batches || []).filter((b) => b.status === "quarantine" && (b.quantityBase || 0) > 0).length, 0),
    inventoryValue: decoratedItems.reduce(
      (acc, item) => acc + (item.batches || []).reduce((sum, batch) => sum + (batch.quantityBase || 0) * (batch.costPerBaseUnit || 0), 0),
      0
    ),
  };

  const defaultTypes = ["reagent", "consumable", "chemical", "control", "calibrator", "equipment", "stationery", "other"];
  if (itemTypes.length === 0) {
    await InventoryItemType.insertMany(defaultTypes.map((name) => ({ name })));
    itemTypes.push(...defaultTypes.map((name) => ({ name })));
  }

  const defaultConditions = [
    "Room Temperature (15\u201325\u00b0C)", "Refrigerated (2\u20138\u00b0C)", "Frozen (\u201320\u00b0C)",
    "Deep Freeze (\u201380\u00b0C)", "Cold Room", "Controlled Room Temperature (20\u201325\u00b0C)",
    "Inert Atmosphere", "Desiccated", "Light-Sensitive", "Ventilated Area",
    "Flammable Cabinet", "Corrosive Cabinet", "Toxic Storage", "Cryogenic", "Ambient",
  ];
  if (storageConditions.length === 0) {
    await InventoryStorageCondition.insertMany(defaultConditions.map((name) => ({ name })));
    storageConditions.push(...defaultConditions.map((name) => ({ name })));
  }

  return {
    categories,
    uoms,
    itemTypes,
    storageConditions,
    items: decoratedItems,
    movements,
    stats,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

export async function GET(req) {
  try {
    const auth = await requireInventory(req);
    if (auth.error) return auth.error;

    await processExpiredBatches(auth.tenantId);

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

    await processExpiredBatches(auth.tenantId);

    const { InventoryCategory, InventoryItem, InventoryMovement, InventoryUom, InventoryItemType, InventoryStorageCondition } = await getTenantModels(auth.tenantId);

    if (action === "category") {
      let name = clean(body.name);
      if (!name) return Response.json({ error: "Category name is required" }, { status: 400 });
      name = name.charAt(0).toUpperCase() + name.slice(1);
      if (name.length > 25) return Response.json({ error: "Category name must not exceed 25 characters" }, { status: 400 });
      if ((name.match(/-/g) || []).length > 1) return Response.json({ error: "Category name can contain at most one hyphen" }, { status: 400 });
      if (!/^[A-Z][A-Za-z0-9 -]*$/.test(name)) return Response.json({ error: "Category name must start with a capital letter and contain only letters, numbers, spaces, and one hyphen" }, { status: 400 });

      let code = clean(body.code);
      if (!code) return Response.json({ error: "Category code is required" }, { status: 400 });
      code = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (code.length > 20) return Response.json({ error: "Category code must not exceed 20 characters" }, { status: 400 });
      if (!/^[A-Z0-9]+$/.test(code)) return Response.json({ error: "Category code must contain only uppercase letters and numbers" }, { status: 400 });

      try {
        const category = await InventoryCategory.create({
          name,
          code,
          parentCategory: mongoose.Types.ObjectId.isValid(body.parentCategory) ? body.parentCategory : null,
          description: clean(body.description),
          status: body.status === "inactive" ? "inactive" : "active",
        });
        writeAuditLog(req, auth, { action: "create", resourceType: "InventoryCategory", resourceId: category._id, metadata: { name, code } }).catch(() => {});
        return Response.json({ category }, { status: 201 });
      } catch (err) {
        if (err.code === 11000) return Response.json({ error: "Category code already exists" }, { status: 409 });
        if (err.name === "ValidationError") {
          const msg = Object.values(err.errors).map((e) => e.message).join(", ");
          return Response.json({ error: msg }, { status: 400 });
        }
        throw err;
      }
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
      if (Number(conv) <= 0) {
        return Response.json({ error: "Conversion factor must be greater than 0" }, { status: 400 });
      }

      const baseSymbol = clean(body.baseSymbol) || symbol;

      const { InventoryUom } = await getTenantModels(auth.tenantId);
      const existingUom = await InventoryUom.findOne({ name: new RegExp(`^${escapeRegex(name)}$`, "i") });
      if (existingUom) return Response.json({ error: `UOM "${name}" already exists` }, { status: 409 });

      const uom = await InventoryUom.create({
        name,
        symbol,
        type: clean(body.type) || "count",
        conversionToBase: numberValue(body.conversionToBase, 1),
        baseSymbol,
        status: body.status === "inactive" ? "inactive" : "active",
      });

      writeAuditLog(req, auth, { action: "create", resourceType: "InventoryUom", resourceId: uom._id, metadata: { name, symbol } }).catch(() => {});

      return Response.json({ uom }, { status: 201 });
    }

    if (action === "item") {
      const errors = [];
      const fieldErrors = {};

      let itemCode = clean(body.itemCode).toUpperCase();
      const name = clean(body.name);
      let isAutoGenerated = false;
      if (!itemCode) {
        isAutoGenerated = true;
      } else {
        if (!isValidItemCode(itemCode)) errors.push("Item code must contain only capital letters, numbers, and hyphens");
        if (itemCode.length > 15) errors.push("Item code must not exceed 15 characters");
      }

      if (!name) errors.push("Item name is required");
      else {
        if (name.length > 60) errors.push("Item name must not exceed 60 characters");
        else if (!/^[A-Za-z0-9 -]*$/.test(name)) errors.push("Item name must contain only letters, numbers, spaces, and hyphens");
      }

      if (!mongoose.Types.ObjectId.isValid(body.category)) errors.push("Category is required");
      if (!mongoose.Types.ObjectId.isValid(body.baseUom)) errors.push("Base UOM is required");

      if (isAutoGenerated && errors.length === 0) {
        const { InventoryCategory } = await getTenantModels(auth.tenantId);
        const categoryDoc = await InventoryCategory.findById(body.category).lean();
        if (!categoryDoc) {
          errors.push("Category not found for auto-generation");
        } else {
          const categoryCode = categoryDoc.code;
          const regex = new RegExp(`^${escapeRegex(categoryCode)}-`);
          const lastItem = await InventoryItem.findOne({ itemCode: regex }).sort({ itemCode: -1 }).lean();
          let nextSeq = 1;
          if (lastItem) {
            const parts = lastItem.itemCode.split("-");
            nextSeq = parseInt(parts[parts.length - 1], 10) + 1;
          }
          let candidateCode = `${categoryCode}-${String(nextSeq).padStart(4, "0")}`;
          while (await InventoryItem.findOne({ itemCode: candidateCode }).lean()) {
            nextSeq++;
            candidateCode = `${categoryCode}-${String(nextSeq).padStart(4, "0")}`;
          }
          itemCode = candidateCode;
        }
      }

      const genericName = clean(body.genericName);
      if (!genericName) errors.push("Generic name is required");
      else {
        if (!/^[A-Za-z0-9]+$/.test(genericName)) errors.push("Generic name must contain only letters and numbers");
        if (genericName.length > 60) errors.push("Generic name must not exceed 60 characters");
      }

      if (!mongoose.Types.ObjectId.isValid(body.subCategory)) {
        errors.push("Sub category is required");
      }

      if (!mongoose.Types.ObjectId.isValid(body.purchaseUom)) errors.push("Purchase UOM is required");

      if (body.purchaseToBaseFactor === undefined || body.purchaseToBaseFactor === null || body.purchaseToBaseFactor === "") {
        errors.push("Conversion factor is required");
      } else {
        if (isExponential(body.purchaseToBaseFactor)) errors.push("Exponential notation is not allowed in conversion factor");
        else if (Number(body.purchaseToBaseFactor) <= 0) errors.push("Conversion factor must be greater than 0");
        else if (!isValidDecimal(body.purchaseToBaseFactor)) errors.push("Conversion factor must have max 4 digits before decimal, 3 after");
      }

      const minStockVal = body.minimumStockBase === undefined || body.minimumStockBase === null || body.minimumStockBase === "" ? null : Number(body.minimumStockBase);
      if (minStockVal === null) errors.push("Min stock is required");
      else {
        if (isExponential(body.minimumStockBase)) errors.push("Exponential notation is not allowed in min stock");
        else if (minStockVal < 0) errors.push("Min stock cannot be negative");
        else if (!isValidDecimal(body.minimumStockBase)) errors.push("Min stock must have max 4 digits before decimal, 3 after");
      }

      const reorderVal = body.reorderLevelBase === undefined || body.reorderLevelBase === null || body.reorderLevelBase === "" ? null : Number(body.reorderLevelBase);
      if (reorderVal === null) errors.push("Reorder level is required");
      else {
        if (isExponential(body.reorderLevelBase)) errors.push("Exponential notation is not allowed in reorder level");
        else if (reorderVal < 0) errors.push("Reorder level cannot be negative");
        else if (!isValidDecimal(body.reorderLevelBase)) errors.push("Reorder level must have max 4 digits before decimal, 3 after");
      }

      const maxStockVal = body.maximumStockBase === undefined || body.maximumStockBase === null || body.maximumStockBase === "" ? null : Number(body.maximumStockBase);
      if (maxStockVal === null) errors.push("Max stock is required");
      else {
        if (isExponential(body.maximumStockBase)) errors.push("Exponential notation is not allowed in max stock");
        else if (maxStockVal < 0) errors.push("Max stock cannot be negative");
        else if (!isValidDecimal(body.maximumStockBase)) errors.push("Max stock must have max 4 digits before decimal, 3 after");
      }

      if (body.openingQuantityBase === undefined || body.openingQuantityBase === null || body.openingQuantityBase === "") {
        errors.push("Opening quantity is required");
      } else {
        if (isExponential(body.openingQuantityBase)) errors.push("Exponential notation is not allowed in opening quantity");
        else if (Number(body.openingQuantityBase) < 0) errors.push("Opening quantity cannot be negative");
        else if (!isValidDecimal(body.openingQuantityBase)) errors.push("Opening quantity must have max 4 digits before decimal, 3 after");
      }

      const manufacturer = clean(body.manufacturer);
      const preferredSupplier = clean(body.preferredSupplier);

      const batchNo = clean(body.batchNo).toUpperCase();
      if (!batchNo) errors.push("Batch No is required");
      else {
        if (!/^[A-Za-z0-9]+$/.test(batchNo)) errors.push("Batch No must contain only letters and numbers");
        if (batchNo.length > 15) errors.push("Batch No must not exceed 15 characters");
      }

      const defaultLocation = clean(body.defaultLocation);

      const storageCondition = clean(body.storageCondition);
      if (!storageCondition) errors.push("Storage condition is required");
      else {
        const validConditions = await InventoryStorageCondition.find({}).lean();
        if (validConditions.length > 0 && !validConditions.some((c) => c.name === storageCondition)) {
          errors.push("Invalid storage condition");
        }
      }

      const notes = clean(body.notes);
      if (notes && notes.length > 500) errors.push("Notes must not exceed 500 characters");

      const validConvUnits = ["mg", "g", "kg", "ml", "l", "IU", "µg", "unit", "pack", "oz", "lb"];
      const conversionFactorUnit = clean(body.conversionFactorUnit);
      if (!conversionFactorUnit) errors.push("Conversion factor unit is required");
      else if (!validConvUnits.includes(conversionFactorUnit)) errors.push("Invalid conversion factor unit");

      const itemType = clean(body.itemType);
      if (!itemType) errors.push("Item type is required");
      else {
        const validTypes = await InventoryItemType.find({}).lean();
        if (validTypes.length > 0 && !validTypes.some((t) => t.name === itemType)) {
          errors.push("Invalid item type");
        }
      }

      if (body.status && !["active", "inactive"].includes(body.status)) {
        errors.push("Status must be 'active' or 'inactive'");
      }

      if (minStockVal !== null && reorderVal !== null && minStockVal > reorderVal) {
        errors.push("Min stock cannot exceed reorder level");
      }
      if (maxStockVal !== null && reorderVal !== null && reorderVal > maxStockVal) {
        errors.push("Reorder level cannot exceed max stock");
      }
      if (maxStockVal !== null && minStockVal !== null && minStockVal > maxStockVal) {
        errors.push("Min stock cannot exceed max stock");
      }

      if (body.expiryDate) {
        const expErr = validateExpiryDate(body.expiryDate);
        if (expErr) errors.push(expErr);
        else if (body.receivedDate) {
          const expiry = new Date(body.expiryDate);
          expiry.setHours(0, 0, 0, 0);
          const received = new Date(body.receivedDate);
          received.setHours(0, 0, 0, 0);
          if (expiry <= received) errors.push("Expiry date must be after received date");
        }
      }

      if (errors.length > 0) {
        const fieldMap = {
          "Item code": "itemCode", "Item name": "name", "Category": "category",
          "Base UOM": "baseUom", "Generic name": "genericName", "Sub category": "subCategory",
          "Purchase UOM": "purchaseUom", "Conversion factor": "purchaseToBaseFactor",
          "Min stock": "minimumStockBase", "Reorder level": "reorderLevelBase",
          "Max stock": "maximumStockBase", "Opening quantity": "openingQuantityBase",
          "Manufacturer": "manufacturer", "Supplier": "preferredSupplier",
          "Batch No": "batchNo", "Location": "defaultLocation",
          "Storage condition": "storageCondition", "Notes": "notes",
          "Item type": "itemType", "Status": "status", "Expiry": "expiryDate",
          "Invalid storage condition": "storageCondition", "Invalid item type": "itemType",
          "Invalid conversion factor": "conversionFactorUnit",
        };
        for (const msg of errors) {
          for (const [prefix, field] of Object.entries(fieldMap)) {
            if (msg.startsWith(prefix)) { fieldErrors[field] = msg; break; }
          }
        }
        return Response.json({ error: errors.join("; "), fieldErrors }, { status: 400 });
      }

      const quarantineOnReceipt = body.quarantineOnReceipt === true;
      const openingQty = numberValue(body.openingQuantityBase, 0);
      let preferredSupplierRef = null;
      if (mongoose.Types.ObjectId.isValid(body.preferredSupplierRef)) {
        preferredSupplierRef = body.preferredSupplierRef;
      }

      const openingBatch = openingQty > 0
        ? [{
            batchNo: batchNo || "OPENING",
            supplier: preferredSupplier || (preferredSupplierRef ? "Supplier" : "N/A"),
            supplierRef: preferredSupplierRef,
            receivedDate: dateValue(body.receivedDate) || new Date(),
            expiryDate: dateValue(body.expiryDate),
            quantityBase: openingQty,
            costPerBaseUnit: numberValue(body.costPerBaseUnit, 0),
            location: defaultLocation || "Default",
            status: quarantineOnReceipt ? "quarantine" : "available",
          }]
        : [];

      const effectiveOpeningQty = quarantineOnReceipt ? 0 : openingQty;

      let item;
      try {
        item = await InventoryItem.create({
          itemCode,
          name,
          genericName,
          category: body.category,
          subCategory: body.subCategory,
          itemType,
          baseUom: body.baseUom,
          purchaseUom: body.purchaseUom,
          purchaseToBaseFactor: numberValue(body.purchaseToBaseFactor, 1),
          conversionFactorUnit,
          stockOnHandBase: effectiveOpeningQty,
          minimumStockBase: numberValue(body.minimumStockBase, 0),
          reorderLevelBase: numberValue(body.reorderLevelBase, 0),
          maximumStockBase: numberValue(body.maximumStockBase, 0),
          preferredSupplierRef,
          preferredSupplier: preferredSupplierRef ? "" : preferredSupplier,
          manufacturer,
          storageCondition,
          defaultLocation,
          trackExpiry: body.trackExpiry !== false,
          quarantineOnReceipt,
          status: body.status === "inactive" ? "inactive" : "active",
          notes: notes || undefined,
          batches: openingBatch,
        });
      } catch (err) {
        if (err.name === "ValidationError") {
          const fe = {};
          for (const [field, detail] of Object.entries(err.errors)) {
            fe[field] = detail.message;
          }
          return Response.json({ error: Object.values(fe).join("; "), fieldErrors: fe }, { status: 400 });
        }
        throw err;
      }

      if (openingQty > 0 && !quarantineOnReceipt) {
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

      writeAuditLog(req, auth, { action: "create", resourceType: "InventoryItem", resourceId: item._id, metadata: { name: item.name, itemCode: item.itemCode } }).catch(() => {});

      return Response.json({ item }, { status: 201 });
    }

    if (action === "itemtype") {
      const name = clean(body.name);
      if (!name) return Response.json({ error: "Item type name is required" }, { status: 400 });
      const exists = await InventoryItemType.findOne({ name: new RegExp(`^${escapeRegex(name)}$`, "i") });
      if (exists) return Response.json({ error: "Item type already exists" }, { status: 409 });
      const itemType = await InventoryItemType.create({ name });
      writeAuditLog(req, auth, { action: "create", resourceType: "InventoryItemType", resourceId: itemType._id, metadata: { name } }).catch(() => {});
      return Response.json({ itemType }, { status: 201 });
    }

    if (action === "movement") {
      const item = await InventoryItem.findById(body.itemId);
      if (!item) return Response.json({ error: "Inventory item not found" }, { status: 404 });

      const movementType = clean(body.movementType);
      const allowedTypes = new Set(["receipt", "issue", "adjustment", "transfer", "wastage", "expiry", "purchase"]);
      if (!allowedTypes.has(movementType)) {
        return Response.json({ error: "Valid movement type is required" }, { status: 400 });
      }

      if (movementType === "receipt" || movementType === "purchase") {
        const supplier = clean(body.supplier);
        if (!supplier) return Response.json({ error: "Supplier is required", fieldErrors: { supplier: "Supplier is required" } }, { status: 400 });
        if (!isValidName(supplier)) return Response.json({ error: "Supplier contains invalid characters", fieldErrors: { supplier: "Supplier contains invalid characters" } }, { status: 400 });
        if (hasUrl(supplier)) return Response.json({ error: "URLs are not allowed in supplier", fieldErrors: { supplier: "URLs are not allowed" } }, { status: 400 });
      } else {
        const toLocation = clean(body.toLocation);
        if (!toLocation) return Response.json({ error: "To location is required", fieldErrors: { toLocation: "To location is required" } }, { status: 400 });
        if (!isValidName(toLocation)) return Response.json({ error: "Location contains invalid characters", fieldErrors: { toLocation: "Location contains invalid characters" } }, { status: 400 });
        if (hasUrl(toLocation)) return Response.json({ error: "URLs are not allowed in location", fieldErrors: { toLocation: "URLs are not allowed" } }, { status: 400 });
      }

      const referenceNo = clean(body.referenceNo);
      if (!referenceNo) return Response.json({ error: "Reference No is required", fieldErrors: { referenceNo: "Reference No is required" } }, { status: 400 });
      if (!isValidName(referenceNo)) return Response.json({ error: "Reference No contains invalid characters", fieldErrors: { referenceNo: "Reference No contains invalid characters" } }, { status: 400 });
      if (hasUrl(referenceNo)) return Response.json({ error: "URLs are not allowed in reference number", fieldErrors: { referenceNo: "URLs are not allowed" } }, { status: 400 });

      const reason = clean(body.reason);
      if (!reason) return Response.json({ error: "Reason is required", fieldErrors: { reason: "Reason is required" } }, { status: 400 });
      if (!isValidName(reason)) return Response.json({ error: "Reason contains invalid characters", fieldErrors: { reason: "Reason contains invalid characters" } }, { status: 400 });
      if (hasUrl(reason)) return Response.json({ error: "URLs are not allowed in reason", fieldErrors: { reason: "URLs are not allowed" } }, { status: 400 });

      if (isExponential(body.quantityBase)) {
        return Response.json({ error: "Exponential notation is not allowed in quantity", fieldErrors: { quantityBase: "Exponential notation is not allowed" } }, { status: 400 });
      }

      const isAdjustment = movementType === "adjustment";
      let quantityBase = numberValue(body.quantityBase, 0);
      if (!isAdjustment && movementType !== "purchase" && quantityBase <= 0) return Response.json({ error: "Quantity must be greater than zero", fieldErrors: { quantityBase: "Quantity must be greater than zero" } }, { status: 400 });

      if (body.expiryDate) {
        const expErr = validateExpiryDate(body.expiryDate);
        if (expErr) return Response.json({ error: expErr, fieldErrors: { expiryDate: expErr } }, { status: 400 });
        if (body.receivedDate) {
          const expiry = new Date(body.expiryDate);
          expiry.setHours(0, 0, 0, 0);
          const received = new Date(body.receivedDate);
          received.setHours(0, 0, 0, 0);
          if (expiry <= received) return Response.json({ error: "Expiry date must be after received date", fieldErrors: { expiryDate: "Expiry date must be after received date" } }, { status: 400 });
        }
      }

      if (movementType === "receipt" || movementType === "purchase") {
        const batchData = {
          batchNo: clean(body.batchNo) || `BATCH-${Date.now()}`,
          supplier: clean(body.supplier),
          receivedDate: dateValue(body.receivedDate) || new Date(),
          expiryDate: dateValue(body.expiryDate),
          quantityBase,
          costPerBaseUnit: numberValue(body.costPerBaseUnit, 0),
          location: clean(body.toLocation) || item.defaultLocation,
        };
        const receiptDate = dateValue(body.movementDate) || new Date();
        const performedBy = auth.user?.name || auth.user?.email;

        await InventoryItem.findOneAndUpdate(
          { _id: item._id },
          { $push: { batches: batchData }, $inc: { stockOnHandBase: quantityBase } }
        );

        const updatedItem = await InventoryItem.findById(item._id);
        const createdBatch = updatedItem.batches[updatedItem.batches.length - 1];

        const movement = await InventoryMovement.create({
          item: item._id,
          batchId: createdBatch._id,
          movementType,
          quantityBase,
          balanceAfterBase: updatedItem.stockOnHandBase,
          reason: clean(body.reason) || "Stock receipt",
          referenceNo: clean(body.referenceNo),
          toLocation: createdBatch.location,
          performedBy,
          movementDate: receiptDate,
          costPerBaseUnit: batchData.costPerBaseUnit || 0,
          supplier: batchData.supplier || "",
        });

        const totalCost = quantityBase * (batchData.costPerBaseUnit || 0);
        let expenseEntryId = null;
        if (totalCost > 0) {
          try {
            const expAccount = await getAccountByCode(auth.tenantId, "5001");
            if (expAccount) {
              const { ExpenseEntry } = await getTenantModels(auth.tenantId);
              const expenseEntry = await ExpenseEntry.create({
                date: receiptDate,
                category: "reagent",
                description: `Auto: ${item.name} receipt — batch ${batchData.batchNo}`,
                amount: totalCost,
                accountId: expAccount._id,
                referenceNo: clean(body.referenceNo) || movement._id.toString(),
                incurredBy: performedBy,
              });
              expenseEntryId = expenseEntry._id;
              await InventoryMovement.updateOne({ _id: movement._id }, { $set: { expenseEntryId } });
              await postJournalEntry(auth.tenantId, {
                date: receiptDate,
                lines: [
                  { accountId: expAccount._id, debit: totalCost, credit: 0 },
                ],
                memo: `Inventory receipt: ${item.name} (${batchData.batchNo})`,
                referenceType: "ExpenseEntry",
                referenceId: expenseEntry._id,
                userId: auth.user?._id,
              });
            }
          } catch {}
        }

        writeAuditLog(req, auth, {
          action: "create",
          resourceType: "InventoryMovement",
          resourceId: movement._id,
          metadata: { item: item.name, movementType: "receipt", quantityBase, batchNo: batchData.batchNo, supplier: batchData.supplier },
        }).catch(() => {});

        return Response.json({ item: updatedItem, movement }, { status: 201 });
      }

      const availableBatches = (item.batches || []).filter((b) => b.quantityBase > 0);

      if (movementType === "adjustment" && availableBatches.length > 0) {
        if (!body.batchId) {
          return Response.json({ error: "Batch is required for adjustment on batched items", fieldErrors: { batchId: "Batch is required for adjustment" } }, { status: 400 });
        }
        if (!item.batches.id(body.batchId)) {
          return Response.json({ error: "Selected batch not found on this item", fieldErrors: { batchId: "Batch not found" } }, { status: 400 });
        }
      }

      let selectedBatch = body.batchId
        ? item.batches.id(body.batchId)
        : availableBatches.sort((a, b) => {
            if (!a.expiryDate) return 1;
            if (!b.expiryDate) return -1;
            return new Date(a.expiryDate) - new Date(b.expiryDate);
          })[0];

      if (!selectedBatch) {
        if (movementType === "adjustment") {
          const newBalance = numberValue(body.newBalanceBase, quantityBase);
          const adjBatchData = {
            batchNo: `ADJ-${Date.now()}`,
            quantityBase: Math.max(0, newBalance),
            receivedDate: dateValue(body.movementDate) || new Date(),
            location: clean(body.toLocation) || item.defaultLocation,
          };
          const adjDate = dateValue(body.movementDate) || new Date();
          const performedBy = auth.user?.name || auth.user?.email;

          await InventoryItem.findOneAndUpdate(
            { _id: item._id },
            { $push: { batches: adjBatchData }, $set: { stockOnHandBase: Math.max(0, newBalance) } }
          );

          const updatedItem = await InventoryItem.findById(item._id);
          const createdBatch = updatedItem.batches[updatedItem.batches.length - 1];

          const movement = await InventoryMovement.create({
            item: item._id,
            batchId: createdBatch._id,
            movementType,
            quantityBase: newBalance,
            balanceAfterBase: updatedItem.stockOnHandBase,
            reason: clean(body.reason) || "Initial stock adjustment",
            referenceNo: clean(body.referenceNo),
            toLocation: createdBatch.location,
            performedBy,
            movementDate: adjDate,
            costPerBaseUnit: numberValue(body.costPerBaseUnit, 0),
          });

          const initCost = numberValue(body.costPerBaseUnit, 0);
          if (initCost > 0 && newBalance > 0) {
            try {
              const { connection: tenantConn, ExpenseEntry } = await getTenantModels(auth.tenantId);
              const expenseAmount = Math.round(newBalance * initCost * 100) / 100;
              if (expenseAmount > 0) {
                const expenseAccount = await getAccountByCode(tenantConn, auth.tenantId, "5001");
                const creditAccount = await getAccountByCode(tenantConn, auth.tenantId, "2002");
                const [expense] = await ExpenseEntry.create([{
                  category: "reagent",
                  vendorName: item.name || "Stock Adjustment",
                  amount: expenseAmount,
                  taxAmount: 0,
                  paidFrom: "vendor-payable",
                  date: adjDate,
                  accountId: expenseAccount._id,
                  tenantId: auth.tenantId,
                }]);
                const journalEntry = await postJournalEntry(tenantConn, {
                  tenantId: auth.tenantId,
                  postedBy: auth.session?.userId || performedBy || "system",
                  sourceType: "expense",
                  sourceId: expense._id,
                  description: `Initial stock: ${item.name} (${newBalance})`,
                  lines: [
                    { accountId: expenseAccount._id, debit: expenseAmount, credit: 0 },
                    { accountId: creditAccount._id, debit: 0, credit: expenseAmount },
                  ],
                });
                expense.journalEntryId = journalEntry._id;
                await expense.save();
                movement.expenseEntryId = expense._id;
                await movement.save();
              }
            } catch (_) {}
          }

          writeAuditLog(req, auth, { action: "create", resourceType: "InventoryMovement", resourceId: movement._id, metadata: { item: item.name, movementType, quantityBase: newBalance } }).catch(() => {});
          return Response.json({ item: updatedItem, movement }, { status: 201 });
        }
        return Response.json({ error: "A stock batch is required", fieldErrors: { batchId: "A stock batch is required" } }, { status: 400 });
      }

      if (movementType === "expiry") {
        if (!selectedBatch.expiryDate || new Date(selectedBatch.expiryDate) >= new Date()) {
          return Response.json({ error: "Selected batch has not expired yet", fieldErrors: { batchId: "Selected batch has not expired yet" } }, { status: 400 });
        }
      }

      const toLocation = clean(body.toLocation);
      const batchLocation = selectedBatch.location;
      const performedBy = auth.user?.name || auth.user?.email;
      const movementDate = dateValue(body.movementDate) || new Date();

      if (movementType === "adjustment") {
        const newBalance = numberValue(body.newBalanceBase, selectedBatch.quantityBase);
        const delta = newBalance - selectedBatch.quantityBase;
        const update = { $inc: { stockOnHandBase: delta, "batches.$.quantityBase": delta } };
        if (newBalance <= 0) update.$set = { "batches.$.status": "consumed" };
        const costPerBaseUnit = body.costPerBaseUnit !== undefined && body.costPerBaseUnit !== null && body.costPerBaseUnit !== ""
          ? Number(body.costPerBaseUnit)
          : undefined;
        if (costPerBaseUnit !== undefined && !isNaN(costPerBaseUnit)) {
          if (!update.$set) update.$set = {};
          update.$set["batches.$.costPerBaseUnit"] = costPerBaseUnit;
        }

        await InventoryItem.findOneAndUpdate(
          { _id: item._id, "batches._id": selectedBatch._id },
          update
        );

        const updatedItem = await InventoryItem.findById(item._id);
        const movement = await InventoryMovement.create({
          item: item._id,
          batchId: selectedBatch._id,
          movementType,
          quantityBase: delta,
          balanceAfterBase: updatedItem.stockOnHandBase,
          reason: clean(body.reason) || "Stock adjustment",
          referenceNo,
          toLocation: toLocation || batchLocation,
          performedBy,
          movementDate,
          costPerBaseUnit: costPerBaseUnit !== undefined && !isNaN(costPerBaseUnit) ? costPerBaseUnit : (selectedBatch.costPerBaseUnit || 0),
          supplier: selectedBatch.supplier || "",
        });

        const effectiveCost = costPerBaseUnit !== undefined && !isNaN(costPerBaseUnit) ? costPerBaseUnit : (selectedBatch.costPerBaseUnit || 0);
        if (effectiveCost > 0 && delta !== 0) {
          try {
            const { connection: tenantConn, ExpenseEntry } = await getTenantModels(auth.tenantId);
            const expenseAmount = Math.round(Math.abs(delta) * effectiveCost * 100) / 100;
            if (expenseAmount > 0) {
              const expenseAccount = await getAccountByCode(tenantConn, auth.tenantId, "5001");
              const creditAccount = await getAccountByCode(tenantConn, auth.tenantId, "2002");
              const totalAmount = expenseAmount;
              const [expense] = await ExpenseEntry.create([{
                category: "reagent",
                vendorName: item.name || "Stock Adjustment",
                amount: expenseAmount,
                taxAmount: 0,
                paidFrom: "vendor-payable",
                date: movementDate || new Date(),
                accountId: expenseAccount._id,
                tenantId: auth.tenantId,
              }]);
              const journalEntry = await postJournalEntry(tenantConn, {
                tenantId: auth.tenantId,
                postedBy: auth.session?.userId || performedBy || "system",
                sourceType: "expense",
                sourceId: expense._id,
                description: `Stock adjustment: ${item.name} (${delta > 0 ? "+" : ""}${delta})`,
                lines: [
                  { accountId: expenseAccount._id, debit: totalAmount, credit: 0 },
                  { accountId: creditAccount._id, debit: 0, credit: totalAmount },
                ],
              });
              expense.journalEntryId = journalEntry._id;
              await expense.save();
              movement.expenseEntryId = expense._id;
              await movement.save();
            }
          } catch (_) {}
        }

        writeAuditLog(req, auth, { action: "create", resourceType: "InventoryMovement", resourceId: movement._id, metadata: { item: item.name, movementType: "adjustment", quantityBase: delta, batchNo: selectedBatch.batchNo } }).catch(() => {});
        return Response.json({ item: updatedItem, movement }, { status: 201 });
      }

      if (selectedBatch.quantityBase < quantityBase) {
        return Response.json({ error: "Quantity exceeds selected batch balance" }, { status: 400 });
      }

      const deductQty = quantityBase;
      const update = { $inc: { stockOnHandBase: -deductQty, "batches.$.quantityBase": -deductQty } };
      if (selectedBatch.quantityBase - deductQty <= 0) {
        update.$set = {
          "batches.$.status": movementType === "wastage" || movementType === "expiry" ? "wasted" : "consumed",
        };
      }

      await InventoryItem.findOneAndUpdate(
        { _id: item._id, "batches._id": selectedBatch._id },
        update
      );

      const updatedItem = await InventoryItem.findById(item._id);
      const movement = await InventoryMovement.create({
        item: item._id,
        batchId: selectedBatch._id,
        movementType,
        quantityBase: -deductQty,
        balanceAfterBase: updatedItem.stockOnHandBase,
        reason: clean(body.reason) || movementType,
        referenceNo,
        fromLocation: batchLocation,
        toLocation,
        performedBy,
        movementDate,
        costPerBaseUnit: selectedBatch.costPerBaseUnit || 0,
        supplier: selectedBatch.supplier || "",
      });

      writeAuditLog(req, auth, { action: "create", resourceType: "InventoryMovement", resourceId: movement._id, metadata: { item: item.name, movementType, quantityBase: -deductQty, batchNo: selectedBatch.batchNo } }).catch(() => {});

      return Response.json({ item: updatedItem, movement }, { status: 201 });
    }

    if (action === "reserve") {
      const itemId = clean(body.itemId);
      if (!mongoose.Types.ObjectId.isValid(itemId)) {
        return Response.json({ error: "Valid item ID is required" }, { status: 400 });
      }

      if (isExponential(body.quantityBase)) {
        return Response.json({ error: "Exponential notation is not allowed in quantity" }, { status: 400 });
      }
      const quantityBase = numberValue(body.quantityBase, 0);
      if (quantityBase <= 0) return Response.json({ error: "Quantity must be greater than zero" }, { status: 400 });

      const referenceNo = clean(body.referenceNo);
      if (!referenceNo) return Response.json({ error: "Reference No is required" }, { status: 400 });

      const item = await InventoryItem.findById(itemId);
      if (!item) return Response.json({ error: "Inventory item not found" }, { status: 404 });

      const available = item.stockOnHandBase - (item.reservedBase || 0);
      if (available < quantityBase) {
        return Response.json({ error: `Insufficient available stock. Available: ${available}, requested: ${quantityBase}` }, { status: 400 });
      }

      await InventoryItem.findOneAndUpdate(
        { _id: itemId },
        { $inc: { reservedBase: quantityBase } }
      );

      await InventoryMovement.create({
        item: itemId,
        movementType: "adjustment",
        quantityBase: 0,
        balanceAfterBase: item.stockOnHandBase,
        reason: `Reserved for ${referenceNo}`,
        referenceNo,
        performedBy: auth.user?.name || auth.user?.email,
        movementDate: new Date(),
      });

      const updatedItem = await InventoryItem.findById(itemId);
      return Response.json({ item: updatedItem }, { status: 200 });
    }

    if (action === "unreserve") {
      const itemId = clean(body.itemId);
      if (!mongoose.Types.ObjectId.isValid(itemId)) {
        return Response.json({ error: "Valid item ID is required" }, { status: 400 });
      }

      if (isExponential(body.quantityBase)) {
        return Response.json({ error: "Exponential notation is not allowed in quantity" }, { status: 400 });
      }
      const quantityBase = numberValue(body.quantityBase, 0);
      if (quantityBase <= 0) return Response.json({ error: "Quantity must be greater than zero" }, { status: 400 });

      const referenceNo = clean(body.referenceNo) || "unknown";

      const item = await InventoryItem.findById(itemId);
      if (!item) return Response.json({ error: "Inventory item not found" }, { status: 404 });

      if ((item.reservedBase || 0) < quantityBase) {
        return Response.json({ error: `Cannot unreserve ${quantityBase}. Currently reserved: ${item.reservedBase || 0}` }, { status: 400 });
      }

      await InventoryItem.findOneAndUpdate(
        { _id: itemId, reservedBase: { $gte: quantityBase } },
        { $inc: { reservedBase: -quantityBase } }
      );

      await InventoryMovement.create({
        item: itemId,
        movementType: "adjustment",
        quantityBase: 0,
        balanceAfterBase: item.stockOnHandBase,
        reason: `Unreserved for ${referenceNo}`,
        referenceNo,
        performedBy: auth.user?.name || auth.user?.email,
        movementDate: new Date(),
      });

      const updatedItem = await InventoryItem.findById(itemId);
      return Response.json({ item: updatedItem }, { status: 200 });
    }

    if (action === "release") {
      const itemId = clean(body.itemId);
      const batchId = clean(body.batchId);

      if (!mongoose.Types.ObjectId.isValid(itemId)) {
        return Response.json({ error: "Valid item ID is required" }, { status: 400 });
      }
      if (!mongoose.Types.ObjectId.isValid(batchId)) {
        return Response.json({ error: "Valid batch ID is required" }, { status: 400 });
      }

      const item = await InventoryItem.findById(itemId);
      if (!item) return Response.json({ error: "Inventory item not found" }, { status: 404 });

      const batch = item.batches.id(batchId);
      if (!batch) return Response.json({ error: "Batch not found" }, { status: 404 });
      if (batch.status !== "quarantine") {
        return Response.json({ error: "Batch is not in quarantine status" }, { status: 400 });
      }
      if ((batch.quantityBase || 0) <= 0) {
        return Response.json({ error: "Batch has no quantity to release" }, { status: 400 });
      }

      const releaseQty = batch.quantityBase;

      await InventoryItem.findOneAndUpdate(
        { _id: itemId, "batches._id": batchId },
        { $set: { "batches.$.status": "available" }, $inc: { stockOnHandBase: releaseQty } }
      );

      const movement = await InventoryMovement.create({
        item: itemId,
        batchId: batchId,
        movementType: "adjustment",
        quantityBase: releaseQty,
        balanceAfterBase: item.stockOnHandBase + releaseQty,
        reason: "Released from quarantine",
        performedBy: auth.user?.name || auth.user?.email,
        movementDate: new Date(),
      });

      writeAuditLog(req, auth, {
        action: "update",
        resourceType: "InventoryItem",
        resourceId: itemId,
        metadata: { action: "quarantine_release", batchNo: batch.batchNo, quantityBase: releaseQty },
      }).catch(() => {});

      const updatedItem = await InventoryItem.findById(itemId);
      return Response.json({ item: updatedItem, movement }, { status: 200 });
    }

    return Response.json({ error: "Unsupported inventory action" }, { status: 400 });
  } catch (error) {
    if (error.code === 11000) {
      return Response.json({ error: "Inventory record already exists" }, { status: 409 });
    }

    return jsonError("Unable to save inventory record", error, 500);
  }
}
