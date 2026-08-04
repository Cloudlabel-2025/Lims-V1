import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";

import { InventoryUomSchema } from "../../src/app/models/tenant/InventoryUom.js";

test("inventory UOM validation accepts pack-size default names", async () => {
  const InventoryUom =
    mongoose.models.InventoryUomUnitTest ||
    mongoose.model("InventoryUomUnitTest", InventoryUomSchema);

  const uom = new InventoryUom({
    name: "Box of 10",
    symbol: "box10",
    type: "pack",
    conversionToBase: 10,
    baseSymbol: "each",
  });

  await assert.doesNotReject(() => uom.validate());
});
