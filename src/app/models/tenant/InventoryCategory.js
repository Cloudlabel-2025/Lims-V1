import mongoose from "mongoose";

export const InventoryCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 20,
    },
    parentCategory: { type: mongoose.Schema.Types.ObjectId, ref: "InventoryCategory", default: null },
    description: { type: String, trim: true, maxlength: 300 },
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
  },
  { timestamps: true }
);

InventoryCategorySchema.index({ code: 1 }, { unique: true });

export function getInventoryCategoryModel(connection = mongoose) {
  return connection.models.InventoryCategory || connection.model("InventoryCategory", InventoryCategorySchema);
}

const InventoryCategory = getInventoryCategoryModel();
export default InventoryCategory;
