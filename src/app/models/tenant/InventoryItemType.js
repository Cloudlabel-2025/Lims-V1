import mongoose from "mongoose";

export const InventoryItemTypeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      maxlength: 50,
    },
  },
  { timestamps: true }
);

InventoryItemTypeSchema.index({ name: 1 }, { unique: true });

export function getInventoryItemTypeModel(connection = mongoose) {
  return connection.models.InventoryItemType || connection.model("InventoryItemType", InventoryItemTypeSchema);
}

const InventoryItemType = getInventoryItemTypeModel();
export default InventoryItemType;
