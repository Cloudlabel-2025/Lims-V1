import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import { InventoryItemSchema } from "../../src/app/models/tenant/InventoryItem.js";
import { seedDefaultInventory } from "../../src/app/lib/inventory-seeder.js";

test("inventory-seeder.js default export and data structures", () => {
  assert.equal(typeof seedDefaultInventory, "function", "seedDefaultInventory should be a function");
});

test("InventoryItem schema unit/pattern validations", async () => {
  const InventoryItem =
    mongoose.models.InventoryItemUnitTest ||
    mongoose.model("InventoryItemUnitTest", InventoryItemSchema);

  // Test item with valid code
  const item = new InventoryItem({
    itemCode: "EDTA-TUBE-123",
    name: "EDTA Tubes",
    category: new mongoose.Types.ObjectId(),
    baseUom: new mongoose.Types.ObjectId(),
    purchaseUom: new mongoose.Types.ObjectId(),
    purchaseToBaseFactor: 100,
    minimumStockBase: 10,
    reorderLevelBase: 20,
  });

  await assert.doesNotReject(() => item.validate(), "Should accept valid item code and fields");

  // Test item with invalid code containing underscore
  const invalidItem = new InventoryItem({
    itemCode: "EDTA_TUBE_123", // Underscores are not allowed in itemCode pattern
    name: "EDTA Tubes",
    category: new mongoose.Types.ObjectId(),
    baseUom: new mongoose.Types.ObjectId(),
    purchaseUom: new mongoose.Types.ObjectId(),
    purchaseToBaseFactor: 100,
    minimumStockBase: 10,
    reorderLevelBase: 20,
  });

  await assert.rejects(() => invalidItem.validate(), "Should reject invalid characters like underscores in itemCode");
});
