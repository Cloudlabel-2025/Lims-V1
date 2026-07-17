import { jsonError } from "@/app/lib/api-response";
import { writeAuditLog } from "@/app/lib/audit";
import { requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";
import { getTenantModels } from "@/app/lib/tenant-db";

function parseCSV(text) {
  const lines = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === "\n" && !inQuotes) { lines.push(current); current = ""; continue; }
    if (ch === "\r") continue;
    current += ch;
  }
  if (current) lines.push(current);

  return lines.map((line) => {
    const cells = [];
    let cell = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { inQ = !inQ; continue; }
      if (c === "," && !inQ) { cells.push(cell.trim()); cell = ""; continue; }
      cell += c;
    }
    cells.push(cell.trim());
    return cells;
  });
}

function clean(value) {
  return String(value || "").trim();
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function requireInventory(req) {
  const auth = requireTenantSession(req, "inventory.manage");
  if (auth.error) return { error: auth.error };
  const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "inventory.view");
  if (moduleAuth.error) return { error: moduleAuth.error };
  return auth;
}

function validateItemRow(row, headers, index, categoryMap, uomMap) {
  const errors = [];
  const get = (field) => {
    const idx = headers.indexOf(field);
    return idx >= 0 ? clean(row[idx]) : "";
  };

  const itemCode = get("itemCode").toUpperCase();
  const name = get("name");
  const categoryVal = get("category");
  const baseUomVal = get("baseUom");
  const purchaseUomVal = get("purchaseUom");

  if (!itemCode) errors.push("Item code is required");
  else if (!/^[A-Z0-9-]+$/.test(itemCode)) errors.push("Item code must contain only uppercase letters, numbers, and hyphens");
  else if (itemCode.length > 15) errors.push("Item code must not exceed 15 characters");

  if (!name) errors.push("Name is required");
  else if (name.length > 25) errors.push("Name must not exceed 25 characters");
  else if ((name.match(/-/g) || []).length > 1) errors.push("Name can contain at most one hyphen");
  else if (!/^[A-Za-z0-9 -]*$/.test(name)) errors.push("Name must contain only letters, numbers, spaces, and one hyphen");

  if (!categoryVal) errors.push("Category is required");
  else if (!categoryMap.has(categoryVal.toLowerCase())) errors.push(`Category "${categoryVal}" not found`);

  if (!baseUomVal) errors.push("Base UOM is required");
  else if (!uomMap.has(baseUomVal.toLowerCase())) errors.push(`Base UOM "${baseUomVal}" not found`);

  if (purchaseUomVal && !uomMap.has(purchaseUomVal.toLowerCase())) errors.push(`Purchase UOM "${purchaseUomVal}" not found`);

  const minStock = get("minimumStockBase");
  if (minStock && isNaN(Number(minStock))) errors.push("Minimum stock must be a number");

  const reorder = get("reorderLevelBase");
  if (reorder && isNaN(Number(reorder))) errors.push("Reorder level must be a number");

  return { errors, itemCode, name, categoryVal, baseUomVal, purchaseUomVal };
}

function validateCategoryRow(row, headers, index) {
  const errors = [];
  const get = (field) => {
    const idx = headers.indexOf(field);
    return idx >= 0 ? clean(row[idx]) : "";
  };

  const name = get("name");
  const code = get("code").toUpperCase();

  if (!name) errors.push("Name is required");
  else if (name.length > 25) errors.push("Name must not exceed 25 characters");
  else if ((name.match(/-/g) || []).length > 1) errors.push("Name can contain at most one hyphen");
  else if (!/^[A-Z][A-Za-z0-9 -]*$/.test(name)) errors.push("Name must start with a capital letter and contain only letters, numbers, spaces, and one hyphen");

  if (!code) errors.push("Code is required");
  else if (!/^[A-Z0-9]+$/.test(code)) errors.push("Code must contain only uppercase letters and numbers");
  else if (code.length > 20) errors.push("Code must not exceed 20 characters");

  return { errors, name, code };
}

function validateUomRow(row, headers, index) {
  const errors = [];
  const get = (field) => {
    const idx = headers.indexOf(field);
    return idx >= 0 ? clean(row[idx]) : "";
  };

  const name = get("name");
  const symbol = get("symbol");
  const type = get("type");
  const conversionToBase = get("conversionToBase");
  const baseSymbol = get("baseSymbol");

  if (!name) errors.push("Name is required");
  else if (name.length > 60) errors.push("Name must not exceed 60 characters");

  if (!symbol) errors.push("Symbol is required");
  else if (symbol.length > 16) errors.push("Symbol must not exceed 16 characters");

  const validTypes = ["count", "volume", "weight", "length", "time", "pack", "other"];
  if (!type) errors.push("Type is required");
  else if (!validTypes.includes(type.toLowerCase())) errors.push(`Invalid type "${type}". Must be: ${validTypes.join(", ")}`);

  if (!conversionToBase) errors.push("Conversion to base is required");
  else if (isNaN(Number(conversionToBase)) || Number(conversionToBase) <= 0) errors.push("Conversion to base must be a positive number");

  if (!baseSymbol) errors.push("Base symbol is required");

  return { errors, name, symbol, type: type?.toLowerCase(), conversionToBase, baseSymbol };
}

export async function POST(req) {
  try {
    const auth = await requireInventory(req);
    if (auth.error) return auth.error;

    const formData = await req.formData();
    const file = formData.get("file");
    const type = clean(formData.get("type"));
    const dryRun = formData.get("dryRun") === "true" || formData.get("dryRun") === true;

    if (!file) return Response.json({ error: "No file uploaded" }, { status: 400 });
    if (!type || !["items", "categories", "uoms"].includes(type)) {
      return Response.json({ error: "Invalid type. Use: items, categories, uoms" }, { status: 400 });
    }

    const text = await file.text();
    const parsed = parseCSV(text);

    if (parsed.length < 2) return Response.json({ error: "CSV file is empty or has no data rows" }, { status: 400 });

    const headers = parsed[0].map((h) => h.trim());
    const dataRows = parsed.slice(1).filter((row) => row.some((cell) => cell.trim() !== ""));

    const models = await getTenantModels(auth.tenantId);
    const { InventoryItem, InventoryCategory, InventoryUom } = models;

    if (type === "items") {
      const categories = await InventoryCategory.find({}).lean();
      const categoryMap = new Map();
      categories.forEach((c) => {
        categoryMap.set(c.name.toLowerCase(), c);
        categoryMap.set(c.code.toLowerCase(), c);
      });

      const uoms = await InventoryUom.find({}).lean();
      const uomMap = new Map();
      uoms.forEach((u) => {
        uomMap.set(u.symbol.toLowerCase(), u);
        uomMap.set(u.name.toLowerCase(), u);
      });

      const existingItems = await InventoryItem.find({}).select("itemCode").lean();
      const existingCodes = new Set(existingItems.map((i) => i.itemCode));

      const errors = [];
      let validCount = 0;

      for (let i = 0; i < dataRows.length; i++) {
        const result = validateItemRow(dataRows[i], headers, i + 2, categoryMap, uomMap);
        if (result.errors.length) {
          errors.push({ row: i + 2, errors: result.errors });
        } else {
          if (existingCodes.has(result.itemCode)) {
            errors.push({ row: i + 2, errors: [`Item code "${result.itemCode}" already exists (skipped)`] });
          } else {
            validCount++;
            existingCodes.add(result.itemCode);
          }
        }
      }

      if (dryRun) {
        return Response.json({ dryRun: true, totalRows: dataRows.length, validCount, errors });
      }

      let imported = 0;
      let skipped = 0;
      for (let i = 0; i < dataRows.length; i++) {
        const result = validateItemRow(dataRows[i], headers, i + 2, categoryMap, uomMap);
        if (result.errors.length) { skipped++; continue; }

        const get = (field) => {
          const idx = headers.indexOf(field);
          return idx >= 0 ? clean(dataRows[i][idx]) : "";
        };

        const categoryDoc = categoryMap.get(result.categoryVal.toLowerCase());
        const baseUomDoc = uomMap.get(result.baseUomVal.toLowerCase());
        const purchaseUomDoc = result.purchaseUomVal ? uomMap.get(result.purchaseUomVal.toLowerCase()) : null;

        try {
          await InventoryItem.create({
            itemCode: result.itemCode,
            name: result.name,
            genericName: get("genericName") || undefined,
            itemType: get("itemType") || "reagent",
            category: categoryDoc?._id,
            baseUom: baseUomDoc?._id,
            purchaseUom: purchaseUomDoc?._id || baseUomDoc?._id,
            purchaseToBaseFactor: Number(get("purchaseToBaseFactor")) || 1,
            stockOnHandBase: 0,
            minimumStockBase: Number(get("minimumStockBase")) || 0,
            reorderLevelBase: Number(get("reorderLevelBase")) || 0,
            maximumStockBase: Number(get("maximumStockBase")) || 0,
            preferredSupplier: get("preferredSupplier") || undefined,
            manufacturer: get("manufacturer") || undefined,
            storageCondition: get("storageCondition") || undefined,
            defaultLocation: get("defaultLocation") || undefined,
            notes: get("notes") || undefined,
            trackExpiry: get("trackExpiry").toLowerCase() !== "no",
          });
          imported++;
        } catch {
          skipped++;
        }
      }

      writeAuditLog(req, auth, {
        action: "import",
        resourceType: "InventoryItem",
        resourceId: null,
        metadata: { type: "items", imported, skipped, totalRows: dataRows.length },
      }).catch(() => {});

      return Response.json({ imported, skipped, errors, totalRows: dataRows.length });

    } else if (type === "categories") {
      const errors = [];
      let validCount = 0;
      const existingCats = await InventoryCategory.find({}).lean();
      const existingNames = new Set(existingCats.map((c) => c.name.toLowerCase()));
      const existingCodes = new Set(existingCats.map((c) => c.code.toLowerCase()));

      for (let i = 0; i < dataRows.length; i++) {
        const result = validateCategoryRow(dataRows[i], headers, i + 2);
        if (result.errors.length) {
          errors.push({ row: i + 2, errors: result.errors });
        } else if (existingNames.has(result.name.toLowerCase()) || existingCodes.has(result.code.toLowerCase())) {
          errors.push({ row: i + 2, errors: [`Category "${result.name}" or code "${result.code}" already exists (skipped)`] });
        } else {
          validCount++;
          existingNames.add(result.name.toLowerCase());
          existingCodes.add(result.code.toLowerCase());
        }
      }

      if (dryRun) {
        return Response.json({ dryRun: true, totalRows: dataRows.length, validCount, errors });
      }

      let imported = 0;
      let skipped = 0;
      for (let i = 0; i < dataRows.length; i++) {
        const result = validateCategoryRow(dataRows[i], headers, i + 2);
        if (result.errors.length) { skipped++; continue; }
        try {
          const get = (field) => {
            const idx = headers.indexOf(field);
            return idx >= 0 ? clean(dataRows[i][idx]) : "";
          };
          await InventoryCategory.create({
            name: result.name,
            code: result.code,
            description: get("description") || undefined,
          });
          imported++;
        } catch {
          skipped++;
        }
      }

      writeAuditLog(req, auth, {
        action: "import",
        resourceType: "InventoryCategory",
        resourceId: null,
        metadata: { type: "categories", imported, skipped, totalRows: dataRows.length },
      }).catch(() => {});

      return Response.json({ imported, skipped, errors, totalRows: dataRows.length });

    } else if (type === "uoms") {
      const errors = [];
      let validCount = 0;
      const existingUoms = await InventoryUom.find({}).lean();
      const existingNames = new Set(existingUoms.map((u) => u.name.toLowerCase()));
      const existingSymbols = new Set(existingUoms.map((u) => u.symbol.toLowerCase()));

      for (let i = 0; i < dataRows.length; i++) {
        const result = validateUomRow(dataRows[i], headers, i + 2);
        if (result.errors.length) {
          errors.push({ row: i + 2, errors: result.errors });
        } else if (existingNames.has(result.name.toLowerCase()) || existingSymbols.has(result.symbol.toLowerCase())) {
          errors.push({ row: i + 2, errors: [`UOM "${result.name}" or symbol "${result.symbol}" already exists (skipped)`] });
        } else {
          validCount++;
          existingNames.add(result.name.toLowerCase());
          existingSymbols.add(result.symbol.toLowerCase());
        }
      }

      if (dryRun) {
        return Response.json({ dryRun: true, totalRows: dataRows.length, validCount, errors });
      }

      let imported = 0;
      let skipped = 0;
      for (let i = 0; i < dataRows.length; i++) {
        const result = validateUomRow(dataRows[i], headers, i + 2);
        if (result.errors.length) { skipped++; continue; }
        try {
          await InventoryUom.create({
            name: result.name,
            symbol: result.symbol,
            type: result.type,
            conversionToBase: Number(result.conversionToBase),
            baseSymbol: result.baseSymbol,
          });
          imported++;
        } catch {
          skipped++;
        }
      }

      writeAuditLog(req, auth, {
        action: "import",
        resourceType: "InventoryUom",
        resourceId: null,
        metadata: { type: "uoms", imported, skipped, totalRows: dataRows.length },
      }).catch(() => {});

      return Response.json({ imported, skipped, errors, totalRows: dataRows.length });
    }
  } catch (error) {
    return jsonError("Unable to import data", error, 500);
  }
}
