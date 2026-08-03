import mongoose from "mongoose";

const entitlementSnapshotSchema = new mongoose.Schema(
  {
    modules: { type: [String], default: [] },
    features: { type: [String], default: [] },
    quotas: {
      patientRegistrations: { type: Number, min: 0, default: null },
      billingRecords: { type: Number, min: 0, default: null },
      staffUsers: { type: Number, min: 0, default: null },
    },
  },
  { _id: false }
);

export const LabSubscriptionSchema = new mongoose.Schema(
  {
    lab: { type: mongoose.Schema.Types.ObjectId, ref: "Lab", required: true, unique: true, index: true },
    tenantId: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
    package: { type: mongoose.Schema.Types.ObjectId, ref: "SubscriptionPackage", required: true, index: true },
    packageKey: { type: String, required: true, trim: true, lowercase: true, index: true },
    packageName: { type: String, required: true, trim: true },
    packageVersion: { type: Number, required: true, min: 1 },
    packageReleaseVersion: { type: String, trim: true, maxlength: 30 },
    entitlements: { type: entitlementSnapshotSchema, required: true },
    commercialTerms: {
      currency: { type: String, uppercase: true, trim: true, default: "INR" },
      monthlyAmountMinor: { type: Number, min: 0, default: null },
      annualAmountMinor: { type: Number, min: 0, default: null },
    },
    status: {
      type: String,
      enum: ["trialing", "active", "past_due", "grace_period", "paused", "expired", "cancelled"],
      default: "trialing",
      index: true,
    },
    enforcementMode: { type: String, enum: ["off", "shadow", "hard"], default: "shadow", index: true },
    currentPeriodStart: { type: Date, required: true },
    currentPeriodEnd: { type: Date, required: true },
    trialEndsAt: { type: Date },
    legacyPlan: { type: String, trim: true, lowercase: true },
    migratedAt: { type: Date },
    assignedAt: { type: Date, default: Date.now },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "DeveloperUser" },
  },
  { timestamps: true }
);

LabSubscriptionSchema.index({ packageKey: 1, status: 1 });

export function getLabSubscriptionModel(connection = mongoose) {
  return connection.models.LabSubscription || connection.model("LabSubscription", LabSubscriptionSchema);
}

const LabSubscription = getLabSubscriptionModel();
export default LabSubscription;
