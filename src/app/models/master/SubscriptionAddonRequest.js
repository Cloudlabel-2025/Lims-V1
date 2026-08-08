import mongoose from "mongoose";

export const SubscriptionAddonRequestSchema = new mongoose.Schema(
  {
    lab: { type: mongoose.Schema.Types.ObjectId, ref: "Lab", required: true, index: true },
    tenantId: { type: String, required: true, trim: true, lowercase: true, index: true },
    quotaKey: {
      type: String,
      enum: ["patientRegistrations", "billingRecords", "staffUsers"],
      required: true,
    },
    units: { type: Number, required: true, min: 1 },
    amountMinor: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "cancelled"],
      default: "pending",
      index: true,
    },
    requestedBy: { type: String, trim: true },
    requestedByEmail: { type: String, trim: true, lowercase: true },
    rzpOrderId: { type: String, trim: true },
    rzpPaymentId: { type: String, trim: true },
    initialLimit: { type: Number },
    newLimit: { type: Number },
    expiresAt: { type: Date },
  },
  { timestamps: true }
);

SubscriptionAddonRequestSchema.index(
  { tenantId: 1, rzpOrderId: 1 },
  { sparse: true }
);

export function getSubscriptionAddonRequestModel(connection = mongoose) {
  return (
    connection.models.SubscriptionAddonRequest ||
    connection.model("SubscriptionAddonRequest", SubscriptionAddonRequestSchema)
  );
}

const SubscriptionAddonRequest = getSubscriptionAddonRequestModel();
export default SubscriptionAddonRequest;
