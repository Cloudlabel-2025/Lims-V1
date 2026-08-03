import mongoose from "mongoose";

export const SubscriptionUpgradeRequestSchema = new mongoose.Schema(
  {
    lab: { type: mongoose.Schema.Types.ObjectId, ref: "Lab", required: true, index: true },
    tenantId: { type: String, required: true, trim: true, lowercase: true, index: true },
    fromPackageKey: { type: String, required: true, trim: true, lowercase: true },
    fromPackageName: { type: String, required: true, trim: true },
    toPackage: { type: mongoose.Schema.Types.ObjectId, ref: "SubscriptionPackage", required: true },
    toPackageKey: { type: String, required: true, trim: true, lowercase: true },
    toPackageName: { type: String, required: true, trim: true },
    toReleaseVersion: { type: String, required: true, default: "1" },
    status: { type: String, enum: ["pending", "approved", "rejected", "cancelled"], default: "pending", index: true },
    requestedBy: { type: String, trim: true },
    requestedByEmail: { type: String, trim: true, lowercase: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "DeveloperUser" },
    reviewedAt: { type: Date },
  },
  { timestamps: true }
);

SubscriptionUpgradeRequestSchema.index(
  { tenantId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } }
);

export function getSubscriptionUpgradeRequestModel(connection = mongoose) {
  return connection.models.SubscriptionUpgradeRequest || connection.model("SubscriptionUpgradeRequest", SubscriptionUpgradeRequestSchema);
}

const SubscriptionUpgradeRequest = getSubscriptionUpgradeRequestModel();
export default SubscriptionUpgradeRequest;
