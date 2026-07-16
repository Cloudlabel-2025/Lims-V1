import mongoose from "mongoose";

function noUrl(value) {
  return !/https?:\/\//.test(value);
}

function noExponential(value) {
  if (value === undefined || value === null || value === "") return true;
  if (typeof value === "number" && !Number.isFinite(value)) return false;
  return !/[eE]/.test(String(value));
}

const POItemSchema = new mongoose.Schema(
  {
    item: { type: mongoose.Schema.Types.ObjectId, ref: "InventoryItem", required: true },
    quantityOrdered: { type: Number, required: true, min: 0, validate: { validator: noExponential, message: "Exponential notation is not allowed" } },
    quantityReceived: { type: Number, default: 0, min: 0, validate: { validator: noExponential, message: "Exponential notation is not allowed" } },
    unitCost: { type: Number, default: 0, min: 0, validate: { validator: noExponential, message: "Exponential notation is not allowed" } },
    notes: { type: String, trim: true, maxlength: 200 },
  },
  { timestamps: true }
);

const InventoryPurchaseOrderSchema = new mongoose.Schema(
  {
    poNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 30,
      unique: true,
      match: [/^[A-Z0-9-]*$/, "PO number must contain only capital letters, numbers, and hyphens"],
      validate: { validator: noUrl, message: "URLs are not allowed in PO number" },
    },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: "InventorySupplier", required: true },
    items: { type: [POItemSchema], required: true, minlength: 1 },
    orderDate: { type: Date, default: Date.now, required: true },
    expectedDeliveryDate: { type: Date },
    status: {
      type: String,
      enum: ["draft", "submitted", "partially_received", "received", "cancelled"],
      default: "draft",
      index: true,
    },
    totalAmount: { type: Number, default: 0, min: 0, validate: { validator: noExponential, message: "Exponential notation is not allowed" } },
    notes: { type: String, trim: true, maxlength: 500 },
    createdBy: { type: String, trim: true, maxlength: 120 },
    receivedDate: { type: Date },
  },
  { timestamps: true }
);

InventoryPurchaseOrderSchema.index({ poNumber: "text" });

export function getInventoryPurchaseOrderModel(connection = mongoose) {
  return connection.models.InventoryPurchaseOrder || connection.model("InventoryPurchaseOrder", InventoryPurchaseOrderSchema);
}

const InventoryPurchaseOrder = getInventoryPurchaseOrderModel();
export default InventoryPurchaseOrder;
