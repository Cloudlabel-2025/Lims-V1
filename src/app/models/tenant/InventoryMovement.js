import mongoose from "mongoose";

export const InventoryMovementSchema = new mongoose.Schema(
  {
    item: { type: mongoose.Schema.Types.ObjectId, ref: "InventoryItem", required: true, index: true },
    batchId: { type: mongoose.Schema.Types.ObjectId },
    movementType: {
      type: String,
      enum: ["opening", "receipt", "issue", "adjustment", "transfer", "wastage", "expiry"],
      required: true,
      index: true,
    },
    quantityBase: { type: Number, required: true },
    balanceAfterBase: { type: Number, default: 0 },
    reason: { type: String, trim: true, maxlength: 200 },
    referenceNo: { type: String, trim: true, maxlength: 80 },
    fromLocation: { type: String, trim: true, maxlength: 120 },
    toLocation: { type: String, trim: true, maxlength: 120 },
    performedBy: { type: String, trim: true, maxlength: 120 },
    movementDate: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

export function getInventoryMovementModel(connection = mongoose) {
  return connection.models.InventoryMovement || connection.model("InventoryMovement", InventoryMovementSchema);
}

const InventoryMovement = getInventoryMovementModel();
export default InventoryMovement;
