import mongoose from "mongoose";

export const InventoryStorageConditionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      maxlength: 80,
    },
  },
  { timestamps: true }
);

InventoryStorageConditionSchema.index({ name: 1 }, { unique: true });

export function getInventoryStorageConditionModel(connection = mongoose) {
  return connection.models.InventoryStorageCondition || connection.model("InventoryStorageCondition", InventoryStorageConditionSchema);
}

const InventoryStorageCondition = getInventoryStorageConditionModel();
export default InventoryStorageCondition;
