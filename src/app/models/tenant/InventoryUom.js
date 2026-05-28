import mongoose from "mongoose";

export const InventoryUomSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60, unique: true },
    symbol: { type: String, required: true, trim: true, maxlength: 16, unique: true },
    type: {
      type: String,
      enum: ["count", "volume", "weight", "length", "time", "pack", "other"],
      default: "count",
      index: true,
    },
    conversionToBase: { type: Number, default: 1, min: 0 },
    baseSymbol: { type: String, trim: true, maxlength: 16 },
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
  },
  { timestamps: true }
);

export function getInventoryUomModel(connection = mongoose) {
  return connection.models.InventoryUom || connection.model("InventoryUom", InventoryUomSchema);
}

const InventoryUom = getInventoryUomModel();
export default InventoryUom;
