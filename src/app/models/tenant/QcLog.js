import mongoose from "mongoose";

const QcLogSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["qc-run", "calibration", "maintenance", "incident"],
      required: true,
      index: true,
    },
    testName: { type: String, required: true, trim: true, maxlength: 120 },
    instrument: { type: String, trim: true, maxlength: 120 },
    lotNumber: { type: String, trim: true, maxlength: 80 },
    result: {
      type: String,
      enum: ["pass", "fail", "warning", "pending"],
      required: true,
      index: true,
    },
    value: { type: String, trim: true, maxlength: 80 },
    expectedRange: { type: String, trim: true, maxlength: 80 },
    remarks: { type: String, trim: true, maxlength: 500 },
    enteredBy: { type: String, trim: true },
    sample: { type: mongoose.Schema.Types.ObjectId, ref: "Sample", index: true },
    billingRecord: { type: mongoose.Schema.Types.ObjectId, ref: "BillingRecord", index: true },
    testDefinition: { type: mongoose.Schema.Types.ObjectId, ref: "TestDefinition", index: true },
    tenantId: { type: String, required: true, trim: true, lowercase: true, index: true },
  },
  { timestamps: true }
);

QcLogSchema.index({ tenantId: 1, createdAt: -1 });
QcLogSchema.index({ tenantId: 1, result: 1 });
QcLogSchema.index({ tenantId: 1, sample: 1, result: 1 });

export function getQcLogModel(connection = mongoose) {
  return connection.models.QcLog || connection.model("QcLog", QcLogSchema);
}

const QcLog = getQcLogModel();
export default QcLog;
