import mongoose from "mongoose";

export const QuotaUsageEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true, immutable: true, index: true },
    idempotencyKey: { type: String, required: true, unique: true, immutable: true, index: true },
    tenantId: { type: String, required: true, trim: true, lowercase: true, index: true },
    periodKey: { type: String, required: true, index: true },
    quotaKey: {
      type: String,
      enum: ["patientRegistrations", "billingRecords", "staffUsers"],
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["consumed", "would-block", "add-on", "adjustment", "reversal"],
      required: true,
      index: true,
    },
    units: { type: Number, required: true },
    consumedBefore: { type: Number, required: true, min: 0 },
    consumedAfter: { type: Number, required: true, min: 0 },
    effectiveLimit: { type: Number, min: 0, default: null },
    wouldExceedLimit: { type: Boolean, default: false, index: true },
    relatedResourceType: { type: String, trim: true, maxlength: 80 },
    relatedResourceId: { type: mongoose.Schema.Types.ObjectId },
    actorId: { type: mongoose.Schema.Types.ObjectId },
    actorEmail: { type: String, trim: true, lowercase: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    occurredAt: { type: Date, default: Date.now, immutable: true, index: true },
  },
  { timestamps: true }
);

QuotaUsageEventSchema.index({ tenantId: 1, quotaKey: 1, occurredAt: -1 });

export function getQuotaUsageEventModel(connection = mongoose) {
  return connection.models.QuotaUsageEvent || connection.model("QuotaUsageEvent", QuotaUsageEventSchema);
}

const QuotaUsageEvent = getQuotaUsageEventModel();
export default QuotaUsageEvent;
