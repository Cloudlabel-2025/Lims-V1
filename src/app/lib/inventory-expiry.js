import { getTenantModels } from "@/app/lib/tenant-db";

export async function processExpiredBatches(tenantId) {
  const { InventoryItem, InventoryMovement } = await getTenantModels(tenantId);
  const now = new Date();

  const expiredItems = await InventoryItem.updateMany(
    { "batches.expiryDate": { $lt: now }, "batches.status": "available" },
    { $set: { "batches.$[elem].status": "expired" } },
    {
      arrayFilters: [
        { "elem.expiryDate": { $lt: now }, "elem.status": "available", "elem.quantityBase": { $gt: 0 } },
      ],
    }
  );

  if (expiredItems.modifiedCount > 0) {
    const affectedItems = await InventoryItem.find({
      batches: { $elemMatch: { expiryDate: { $lt: now }, status: "expired", quantityBase: { $gt: 0 } } },
    });

    for (const item of affectedItems) {
      for (const batch of item.batches) {
        if (batch.status === "expired" && batch.quantityBase > 0 && batch.expiryDate && new Date(batch.expiryDate) < now) {
          const deductQty = batch.quantityBase;
          await InventoryItem.findOneAndUpdate(
            { _id: item._id, "batches._id": batch._id },
            { $inc: { stockOnHandBase: -deductQty, "batches.$.quantityBase": -deductQty } }
          );
          await InventoryMovement.create({
            item: item._id,
            batchId: batch._id,
            movementType: "expiry",
            quantityBase: -deductQty,
            balanceAfterBase: Math.max(0, (item.stockOnHandBase || 0) - deductQty),
            reason: "Auto-expired by system",
            performedBy: "system",
            movementDate: now,
          });
        }
      }
    }
  }
}
