import mongoose from "mongoose";

function noUrl(value) {
  return !/https?:\/\//.test(value);
}

function noExponential(value) {
  if (value === undefined || value === null || value === "") return true;
  if (typeof value === "number" && !Number.isFinite(value)) return false;
  return !/[eE]/.test(String(value));
}

const BatchSchema = new mongoose.Schema(
  {
    batchNo: {
      type: String,
      trim: true,
      maxlength: 80,
      match: [/^[A-Za-z0-9 .&'\/,()@_-]*$/, "Batch No contains invalid characters"],
      validate: { validator: noUrl, message: "URLs are not allowed in batch number" },
    },
    supplier: {
      type: String,
      trim: true,
      maxlength: 120,
      match: [/^[A-Za-z0-9 .&'\/,()@_-]*$/, "Supplier contains invalid characters"],
      validate: { validator: noUrl, message: "URLs are not allowed in supplier" },
    },
    receivedDate: { type: Date, default: Date.now },
    expiryDate: { type: Date },
    quantityBase: { type: Number, default: 0, min: 0, validate: { validator: noExponential, message: "Exponential notation is not allowed in quantity" } },
    costPerBaseUnit: { type: Number, default: 0, min: 0, validate: { validator: noExponential, message: "Exponential notation is not allowed in cost" } },
    location: {
      type: String,
      trim: true,
      maxlength: 120,
      match: [/^[A-Za-z0-9 .&'\/,()@_-]*$/, "Location contains invalid characters"],
      validate: { validator: noUrl, message: "URLs are not allowed in location" },
    },
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
    itemCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 40,
      unique: true,
      match: [/^[A-Za-z0-9 .&'\/,()@_-]*$/, "Item code contains invalid characters"],
      validate: { validator: noUrl, message: "URLs are not allowed in item code" },
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      index: true,
      match: [/^[A-Za-z0-9 .&'\/,()@_-]*$/, "Item name contains invalid characters"],
      validate: { validator: noUrl, message: "URLs are not allowed in item name" },
    },
    genericName: {
      type: String,
      trim: true,
      maxlength: 120,
      match: [/^[A-Za-z0-9 .&'\/,()@_-]*$/, "Generic name contains invalid characters"],
      validate: { validator: noUrl, message: "URLs are not allowed in generic name" },
    },
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
    purchaseToBaseFactor: { type: Number, default: 1, min: 0, validate: { validator: noExponential, message: "Exponential notation is not allowed in conversion factor" } },
    stockOnHandBase: { type: Number, default: 0, min: 0, index: true, validate: { validator: noExponential, message: "Exponential notation is not allowed in stock" } },
    minimumStockBase: { type: Number, default: 0, min: 0, validate: { validator: noExponential, message: "Exponential notation is not allowed in min stock" } },
    reorderLevelBase: { type: Number, default: 0, min: 0, validate: { validator: noExponential, message: "Exponential notation is not allowed in reorder level" } },
    maximumStockBase: { type: Number, default: 0, min: 0, validate: { validator: noExponential, message: "Exponential notation is not allowed in max stock" } },
    preferredSupplier: {
      type: String,
      trim: true,
      maxlength: 120,
      match: [/^[A-Za-z0-9 .&'\/,()@_-]*$/, "Supplier contains invalid characters"],
      validate: { validator: noUrl, message: "URLs are not allowed in supplier" },
    },
    manufacturer: {
      type: String,
      trim: true,
      maxlength: 120,
      match: [/^[A-Za-z0-9 .&'\/,()@_-]*$/, "Manufacturer contains invalid characters"],
      validate: { validator: noUrl, message: "URLs are not allowed in manufacturer" },
    },
    storageCondition: {
      type: String,
      trim: true,
      maxlength: 160,
      match: [/^[A-Za-z0-9 .&'\/,()@_-]*$/, "Storage condition contains invalid characters"],
      validate: { validator: noUrl, message: "URLs are not allowed in storage condition" },
    },
    defaultLocation: {
      type: String,
      trim: true,
      maxlength: 120,
      match: [/^[A-Za-z0-9 .&'\/,()@_-]*$/, "Location contains invalid characters"],
      validate: { validator: noUrl, message: "URLs are not allowed in location" },
    },
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
