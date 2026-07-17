import mongoose from "mongoose";

function noUrl(value) {
  return !/https?:\/\//.test(value);
}

function noExponential(value) {
  if (value === undefined || value === null || value === "") return true;
  if (typeof value === "number" && !Number.isFinite(value)) return false;
  return !/[eE]/.test(String(value));
}

export const InventoryMovementSchema = new mongoose.Schema(
  {
    item: { type: mongoose.Schema.Types.ObjectId, ref: "InventoryItem", required: true, index: true },
    batchId: { type: mongoose.Schema.Types.ObjectId },
    movementType: {
      type: String,
      enum: ["opening", "receipt", "issue", "adjustment", "transfer", "wastage", "expiry", "purchase"],
      required: true,
      index: true,
    },
    quantityBase: {
      type: Number,
      required: true,
      validate: { validator: noExponential, message: "Exponential notation is not allowed in quantity" },
    },
    balanceAfterBase: {
      type: Number,
      default: 0,
      validate: { validator: noExponential, message: "Exponential notation is not allowed in balance" },
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 200,
      match: [/^[A-Za-z0-9 .&'\/,()@_-]*$/, "Reason contains invalid characters"],
      validate: { validator: noUrl, message: "URLs are not allowed in reason" },
    },
    referenceNo: {
      type: String,
      trim: true,
      maxlength: 80,
      match: [/^[A-Za-z0-9 .&'\/,()@_-]*$/, "Reference No contains invalid characters"],
      validate: { validator: noUrl, message: "URLs are not allowed in reference number" },
    },
    fromLocation: {
      type: String,
      trim: true,
      maxlength: 120,
      match: [/^[A-Za-z0-9 .&'\/,()@_-]*$/, "Location contains invalid characters"],
      validate: { validator: noUrl, message: "URLs are not allowed in location" },
    },
    toLocation: {
      type: String,
      trim: true,
      maxlength: 120,
      match: [/^[A-Za-z0-9 .&'\/,()@_-]*$/, "Location contains invalid characters"],
      validate: { validator: noUrl, message: "URLs are not allowed in location" },
    },
    performedBy: { type: String, trim: true, maxlength: 120 },
    movementDate: { type: Date, default: Date.now, index: true },
    expenseEntryId: { type: mongoose.Schema.Types.ObjectId, ref: "ExpenseEntry", default: null },
  },
  { timestamps: true }
);

export function getInventoryMovementModel(connection = mongoose) {
  return connection.models.InventoryMovement || connection.model("InventoryMovement", InventoryMovementSchema);
}

const InventoryMovement = getInventoryMovementModel();
export default InventoryMovement;
