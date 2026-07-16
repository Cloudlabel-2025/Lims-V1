import mongoose from "mongoose";

function noUrl(value) {
  return !/https?:\/\//.test(value);
}

const InventoryLocationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      unique: true,
      match: [/^[A-Za-z0-9 .&'\/,()@_-]*$/, "Location name contains invalid characters"],
      validate: { validator: noUrl, message: "URLs are not allowed in location name" },
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 20,
      unique: true,
      match: [/^[A-Z0-9-]*$/, "Location code must contain only capital letters, numbers, and hyphens"],
      validate: { validator: noUrl, message: "URLs are not allowed in location code" },
    },
    description: {
      type: String,
      trim: true,
      maxlength: 300,
    },
    parentLocation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InventoryLocation",
      default: null,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      index: true,
    },
  },
  { timestamps: true }
);

InventoryLocationSchema.index({ name: "text", code: "text" });

export function getInventoryLocationModel(connection = mongoose) {
  return connection.models.InventoryLocation || connection.model("InventoryLocation", InventoryLocationSchema);
}

const InventoryLocation = getInventoryLocationModel();
export default InventoryLocation;
