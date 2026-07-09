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
      maxlength: 20,
      match: [/^[A-Z][A-Za-z\s]*$/, "Category name must start with a capital letter and contain only letters and spaces"],
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

InventoryCategorySchema.index({ code: 1 }, { unique: true });

export function getInventoryCategoryModel(connection = mongoose) {
  return connection.models.InventoryCategory || connection.model("InventoryCategory", InventoryCategorySchema);
}

const InventoryCategory = getInventoryCategoryModel();
export default InventoryCategory;
