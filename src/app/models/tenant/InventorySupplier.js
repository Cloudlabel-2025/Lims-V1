import mongoose from "mongoose";

function noUrl(value) {
  return !/https?:\/\//.test(value);
}

const InventorySupplierSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      match: [/^[A-Za-z0-9 .&'\/,()@_-]*$/, "Supplier name contains invalid characters"],
      validate: { validator: noUrl, message: "URLs are not allowed in supplier name" },
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 20,
      unique: true,
      match: [/^[A-Z0-9-]*$/, "Supplier code must contain only capital letters, numbers, and hyphens"],
      validate: { validator: noUrl, message: "URLs are not allowed in supplier code" },
    },
    contactPerson: {
      type: String,
      trim: true,
      maxlength: 100,
      match: [/^[A-Za-z0-9 .&'\/,()@_-]*$/, "Contact person contains invalid characters"],
      validate: { validator: noUrl, message: "URLs are not allowed in contact person" },
    },
    email: {
      type: String,
      trim: true,
      maxlength: 100,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 20,
      match: [/^[0-9+\-() ]*$/, "Phone contains invalid characters"],
    },
    address: {
      type: String,
      trim: true,
      maxlength: 300,
    },
    leadTimeDays: { type: Number, default: 7, min: 0 },
    rating: { type: Number, default: 3, min: 1, max: 5 },
    notes: { type: String, trim: true, maxlength: 500 },
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
  },
  { timestamps: true }
);

InventorySupplierSchema.index({ name: "text", code: "text" });

export function getInventorySupplierModel(connection = mongoose) {
  return connection.models.InventorySupplier || connection.model("InventorySupplier", InventorySupplierSchema);
}

const InventorySupplier = getInventorySupplierModel();
export default InventorySupplier;
