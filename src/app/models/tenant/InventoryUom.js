import mongoose from "mongoose";

function noUrl(value) {
  return !/https?:\/\//.test(value);
}

function noExponential(value) {
  if (value === undefined || value === null || value === "") return true;
  return !/[eE]/.test(String(value));
}

export const InventoryUomSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60,
      unique: true,
      match: [/^[A-Za-z\s]+$/, "Name must contain only letters and spaces"],
      validate: { validator: noUrl, message: "URLs are not allowed in UOM name" },
    },
    symbol: {
      type: String,
      required: true,
      trim: true,
      maxlength: 16,
      match: [/^[A-Za-z0-9 .&'\/,()@_-]*$/, "Symbol contains invalid characters"],
      validate: { validator: noUrl, message: "URLs are not allowed in UOM symbol" },
    },
    type: {
      type: String,
      enum: ["count", "volume", "weight", "length", "time", "pack", "other"],
      default: "count",
      index: true,
    },
    conversionToBase: {
      type: Number,
      required: true,
      default: 1,
      min: 0,
      validate: { validator: noExponential, message: "Exponential notation is not allowed in conversion factor" },
    },
    baseSymbol: {
      type: String,
      required: true,
      trim: true,
      maxlength: 16,
      match: [/^[A-Za-z0-9 .&'\/,()@_-]*$/, "Base symbol contains invalid characters"],
      validate: { validator: noUrl, message: "URLs are not allowed in base symbol" },
    },
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
  },
  { timestamps: true }
);

export function getInventoryUomModel(connection = mongoose) {
  const model = connection.models.InventoryUom || connection.model("InventoryUom", InventoryUomSchema);

  if (!connection.__uomSymbolIndexDropped) {
    connection.__uomSymbolIndexDropped = true;
    model.collection.dropIndex("symbol_1").catch(() => {});
  }

  return model;
}

const InventoryUom = getInventoryUomModel();
export default InventoryUom;
