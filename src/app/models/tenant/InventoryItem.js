import mongoose from "mongoose";

const BatchSchema = new mongoose.Schema(
  {
    batchNo: { type: String, trim: true, maxlength: 80 },
    supplier: { type: String, trim: true, maxlength: 120 },
    receivedDate: { type: Date, default: Date.now },
    expiryDate: { type: Date },
    quantityBase: { type: Number, default: 0, min: 0 },
    costPerBaseUnit: { type: Number, default: 0, min: 0 },
    location: { type: String, trim: true, maxlength: 120 },
    status: {
      type: String,
      enum: ["available", "quarantine", "expired", "consumed", "wasted"],
      default: "available",
      index: true,
    },
  },
  { timestamps: true }
);

export const InventoryItemSchema = new mongoose.Schema(
  {
    itemCode: { type: String, required: true, trim: true, uppercase: true, maxlength: 40, unique: true },
    name: { type: String, required: true, trim: true, maxlength: 120, index: true },
    genericName: { type: String, trim: true, maxlength: 120 },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "InventoryCategory", required: true, index: true },
    subCategory: { type: mongoose.Schema.Types.ObjectId, ref: "InventoryCategory", default: null, index: true },
    itemType: {
      type: String,
      enum: ["reagent", "consumable", "chemical", "control", "calibrator", "equipment", "stationery", "other"],
      default: "reagent",
      index: true,
    },
    baseUom: { type: mongoose.Schema.Types.ObjectId, ref: "InventoryUom", required: true },
    purchaseUom: { type: mongoose.Schema.Types.ObjectId, ref: "InventoryUom" },
    purchaseToBaseFactor: { type: Number, default: 1, min: 0 },
    stockOnHandBase: { type: Number, default: 0, min: 0, index: true },
    minimumStockBase: { type: Number, default: 0, min: 0 },
    reorderLevelBase: { type: Number, default: 0, min: 0 },
    maximumStockBase: { type: Number, default: 0, min: 0 },
    preferredSupplier: { type: String, trim: true, maxlength: 120 },
    manufacturer: { type: String, trim: true, maxlength: 120 },
    storageCondition: { type: String, trim: true, maxlength: 160 },
    defaultLocation: { type: String, trim: true, maxlength: 120 },
    trackExpiry: { type: Boolean, default: true },
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
    batches: [BatchSchema],
    notes: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

InventoryItemSchema.index({ name: "text", itemCode: "text", genericName: "text", manufacturer: "text" });

export function getInventoryItemModel(connection = mongoose) {
  return connection.models.InventoryItem || connection.model("InventoryItem", InventoryItemSchema);
}

const InventoryItem = getInventoryItemModel();
export default InventoryItem;
