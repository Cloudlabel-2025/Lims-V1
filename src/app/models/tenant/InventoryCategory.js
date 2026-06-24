import mongoose from "mongoose";

function noUrl(value) {
  return !/https?:\/\//.test(value);
}

export const InventoryCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
      match: [/^[A-Za-z0-9 .&'\/,()@_-]*$/, "Category name contains invalid characters"],
      validate: { validator: noUrl, message: "URLs are not allowed in category name" },
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 24,
      match: [/^[A-Za-z0-9 .&'\/,()@_-]*$/, "Code contains invalid characters"],
      validate: { validator: noUrl, message: "URLs are not allowed in category code" },
    },
    parentCategory: { type: mongoose.Schema.Types.ObjectId, ref: "InventoryCategory", default: null },
    description: { type: String, trim: true, maxlength: 300 },
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
  },
  { timestamps: true }
);

InventoryCategorySchema.index({ name: 1, parentCategory: 1 }, { unique: true });
InventoryCategorySchema.index({ code: 1 }, { unique: true, sparse: true });

export function getInventoryCategoryModel(connection = mongoose) {
  return connection.models.InventoryCategory || connection.model("InventoryCategory", InventoryCategorySchema);
}

const InventoryCategory = getInventoryCategoryModel();
export default InventoryCategory;
