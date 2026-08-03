import mongoose from "mongoose";

const quotaUsageSchema = new mongoose.Schema(
  {
    included: { type: Number, min: 0, default: null },
    addOn: { type: Number, min: 0, default: 0 },
    adjustment: { type: Number, default: 0 },
    consumed: { type: Number, min: 0, default: 0 },
    reserved: { type: Number, min: 0, default: 0 },
    wouldBlockAttempts: { type: Number, min: 0, default: 0 },
  },
  { _id: false }
);

export const QuotaPeriodSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, trim: true, lowercase: true, index: true },
    periodKey: { type: String, required: true, match: /^\d{4}-\d{2}$/, index: true },
    periodStart: { type: Date, required: true, index: true },
    periodEnd: { type: Date, required: true, index: true },
    packageKey: { type: String, required: true, trim: true, lowercase: true },
    packageName: { type: String, required: true, trim: true },
    packageVersion: { type: Number, required: true, min: 1 },
    enforcementMode: { type: String, enum: ["off", "shadow", "hard"], default: "shadow" },
    quotas: {
      patientRegistrations: { type: quotaUsageSchema, default: () => ({}) },
      billingRecords: { type: quotaUsageSchema, default: () => ({}) },
      staffUsers: { type: quotaUsageSchema, default: () => ({}) },
    },
  },
  { timestamps: true }
);

QuotaPeriodSchema.index({ tenantId: 1, periodKey: 1 }, { unique: true });

export function getQuotaPeriodModel(connection = mongoose) {
  return connection.models.QuotaPeriod || connection.model("QuotaPeriod", QuotaPeriodSchema);
}

const QuotaPeriod = getQuotaPeriodModel();
export default QuotaPeriod;
