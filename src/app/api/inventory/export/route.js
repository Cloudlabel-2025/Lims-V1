import { jsonError } from "@/app/lib/api-response";
import { requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";
import { getTenantModels } from "@/app/lib/tenant-db";

function clean(value) {
  return String(value || "").trim();
}

function escapeCsv(value) {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function csvRow(fields) {
  return fields.map(escapeCsv).join(",");
}

async function requireInventory(req) {
  const auth = requireTenantSession(req, "inventory.view");
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
    const type = clean(searchParams.get("type"));
    const search = clean(searchParams.get("search"));
    const category = clean(searchParams.get("category"));
    const status = clean(searchParams.get("status"));

    const models = await getTenantModels(auth.tenantId);
    const { InventoryItem, InventoryCategory, InventoryUom, InventoryMovement } = models;

    const today = new Date().toISOString().slice(0, 10);
    let headers = [];
    let rows = [];
    let filename = `inventory-export-${today}.csv`;

    if (type === "items") {
      headers = ["itemCode", "name", "genericName", "itemType", "category", "subCategory", "baseUom", "purchaseUom", "purchaseToBaseFactor", "stockOnHandBase", "reservedBase", "minimumStockBase", "reorderLevelBase", "maximumStockBase", "preferredSupplier", "manufacturer", "storageCondition", "defaultLocation", "trackExpiry", "status", "notes"];

      const query = {};
      if (search) {
        const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        query.$or = [{ name: regex }, { itemCode: regex }, { genericName: regex }];
      }
      if (status && status !== "all") query.status = status;
      if (category) query.category = category;

      const items = await InventoryItem.find(query)
        .populate("category", "name code")
        .populate("subCategory", "name code")
        .populate("baseUom", "symbol")
        .populate("purchaseUom", "symbol")
        .sort({ itemCode: 1 })
        .lean();

      rows = items.map((item) => [
        item.itemCode,
        item.name,
        item.genericName || "",
        item.itemType || "",
        item.category?.name || "",
        item.subCategory?.name || "",
        item.baseUom?.symbol || "",
        item.purchaseUom?.symbol || "",
        item.purchaseToBaseFactor ?? "",
        item.stockOnHandBase ?? 0,
        item.reservedBase ?? 0,
        item.minimumStockBase ?? 0,
        item.reorderLevelBase ?? 0,
        item.maximumStockBase ?? 0,
        item.preferredSupplier || "",
        item.manufacturer || "",
        item.storageCondition || "",
        item.defaultLocation || "",
        item.trackExpiry !== false ? "Yes" : "No",
        item.status || "active",
        item.notes || "",
      ]);
      filename = `inventory-items-${today}.csv`;

    } else if (type === "categories") {
      headers = ["id", "name", "code", "parentCategory", "description", "status"];

      const query = {};
      if (search) {
        const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        query.$or = [{ name: regex }, { code: regex }];
      }
      if (status && status !== "all") query.status = status;

      const categories = await InventoryCategory.find(query)
        .populate("parentCategory", "name")
        .sort({ name: 1 })
        .lean();

      rows = categories.map((cat) => [
        cat._id.toString(),
        cat.name,
        cat.code,
        cat.parentCategory?.name || "",
        cat.description || "",
        cat.status || "active",
      ]);
      filename = `inventory-categories-${today}.csv`;

    } else if (type === "uoms") {
      headers = ["id", "name", "symbol", "type", "conversionToBase", "baseSymbol", "status"];

      const query = {};
      if (search) {
        const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        query.$or = [{ name: regex }, { symbol: regex }];
      }
      if (status && status !== "all") query.status = status;

      const uoms = await InventoryUom.find(query).sort({ name: 1 }).lean();

      rows = uoms.map((uom) => [
        uom._id.toString(),
        uom.name,
        uom.symbol,
        uom.type,
        uom.conversionToBase,
        uom.baseSymbol,
        uom.status || "active",
      ]);
      filename = `inventory-uoms-${today}.csv`;

    } else if (type === "movements") {
      headers = ["movementDate", "itemName", "itemCode", "batchId", "movementType", "quantityBase", "balanceAfterBase", "fromLocation", "toLocation", "referenceNo", "reason", "performedBy"];

      const query = {};
      if (search) {
        const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        query.$or = [{ reason: regex }, { referenceNo: regex }];
      }
      if (status && status !== "all") query.movementType = status;

      const dateFrom = clean(searchParams.get("dateFrom"));
      const dateTo = clean(searchParams.get("dateTo"));
      if (dateFrom || dateTo) {
        query.movementDate = {};
        if (dateFrom) query.movementDate.$gte = new Date(dateFrom);
        if (dateTo) {
          const to = new Date(dateTo);
          to.setHours(23, 59, 59, 999);
          query.movementDate.$lte = to;
        }
      }

      const movements = await InventoryMovement.find(query)
        .populate("item", "name itemCode")
        .sort({ movementDate: -1 })
        .lean();

      rows = movements.map((m) => [
        m.movementDate ? new Date(m.movementDate).toISOString().slice(0, 10) : "",
        m.item?.name || "",
        m.item?.itemCode || "",
        m.batchId?.toString() || "",
        m.movementType,
        m.quantityBase,
        m.balanceAfterBase ?? "",
        m.fromLocation || "",
        m.toLocation || "",
        m.referenceNo || "",
        m.reason || "",
        m.performedBy || "",
      ]);
      filename = `inventory-ledger-${today}.csv`;

    } else {
      return Response.json({ error: "Invalid export type. Use: items, categories, uoms, movements" }, { status: 400 });
    }

    const csvContent = [csvRow(headers), ...rows.map((row) => csvRow(row))].join("\n");

    return new Response(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return jsonError("Unable to export data", error, 500);
  }
}
