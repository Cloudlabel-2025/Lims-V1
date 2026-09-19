import { getTenantModels } from "@/app/lib/tenant-db";

function formatQuantity(value, symbol = "") {
  const amount = Number(value) || 0;
  const display = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  return `${display}${symbol ? ` ${symbol}` : ""}`;
}

export async function reserveSampleInventory(tenantId, reservedInventory = []) {
  if (!Array.isArray(reservedInventory) || reservedInventory.length === 0) {
    return { reservations: [] };
  }

  const { InventoryItem, InventoryUom } = await getTenantModels(tenantId);
  const reservations = [];

  for (const reqItem of reservedInventory) {
    const itemId = reqItem.item;
    const uomId = reqItem.uom;
    const qty = Number(reqItem.quantity);
    if (!itemId || !uomId || !Number.isFinite(qty) || qty <= 0) continue;

    const [item, uom] = await Promise.all([
      InventoryItem.findById(itemId),
      InventoryUom.findById(uomId),
    ]);

    if (!item || !uom) {
      return {
        error: {
          message: "Selected inventory item or unit of measure is not available.",
          status: 400,
        },
      };
    }

    const conversionToBase = Number(uom.conversionToBase) || 1;
    const quantityInBase = qty * conversionToBase;
    const available = Math.max(0, (item.stockOnHandBase || 0) - (item.reservedBase || 0));
    const requestedText = formatQuantity(quantityInBase, item.baseUom?.symbol || uom.symbol);
    const availableText = formatQuantity(available, item.baseUom?.symbol || uom.symbol);

    if (available < quantityInBase) {
      const stockFinished = available <= 0;
      return {
        error: {
          message: stockFinished
            ? `${item.name} stock finished. Reorder stock before using this item in samples.`
            : `${item.name} has only ${availableText} available, but ${requestedText} was requested. Reorder stock before using this quantity in samples.`,
          status: 400,
          details: {
            itemId: String(item._id),
            itemName: item.name,
            itemCode: item.itemCode,
            availableBase: available,
            requestedBase: quantityInBase,
            reorderRequired: true,
            stockFinished,
          },
        },
      };
    }

    await InventoryItem.findOneAndUpdate(
      { _id: item._id },
      { $inc: { reservedBase: quantityInBase } }
    );
    reservations.push({ item: item._id, quantityBase: quantityInBase, uom: uom._id });
  }

  return { reservations };
}
