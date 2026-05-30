import mongoose from "mongoose";

export const AuditLogSchema = new mongoose.Schema(
  {
    action: { type: String, required: true, trim: true, maxlength: 120, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    tenantId: { type: String, required: true, trim: true, lowercase: true, index: true },
    resourceType: { type: String, required: true, trim: true, maxlength: 80, index: true },
    resourceId: { type: mongoose.Schema.Types.ObjectId, index: true },
    timestamp: { type: Date, default: Date.now, immutable: true, index: true },
    ipAddress: { type: String, trim: true, maxlength: 80 },
  },
  { timestamps: true }
);

AuditLogSchema.index({ tenantId: 1, timestamp: -1 });
AuditLogSchema.index({ tenantId: 1, resourceType: 1, resourceId: 1 });

export function getAuditLogModel(connection = mongoose) {
  return connection.models.AuditLog || connection.model("AuditLog", AuditLogSchema);
}

const AuditLog = getAuditLogModel();
export default AuditLog;
