import mongoose from "mongoose";

function noUrl(value) {
  return !/https?:\/\//.test(value);
}

function noExponential(value) {
  if (value === undefined || value === null || value === "") return true;
  return !/[eE]/.test(String(value));
}

const QcLogSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["qc-run", "calibration", "maintenance", "incident"],
      required: true,
      index: true,
    },
    testName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      match: [/^[A-Za-z0-9 .&'\/,()@_-]*$/, "Test name contains invalid characters"],
      validate: { validator: noUrl, message: "URLs are not allowed in test name" },
    },
    instrument: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      match: [/^[A-Za-z0-9 .&'\/,()@_-]*$/, "Instrument contains invalid characters"],
      validate: { validator: noUrl, message: "URLs are not allowed in instrument" },
    },
    lotNumber: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
      match: [/^[A-Za-z0-9 .&'\/,()@_-]*$/, "Lot number contains invalid characters"],
      validate: { validator: noUrl, message: "URLs are not allowed in lot number" },
    },
    result: {
      type: String,
      enum: ["pass", "fail", "warning", "pending"],
      required: true,
      index: true,
    },
    value: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
      validate: { validator: noExponential, message: "Exponential notation is not allowed in observed value" },
    },
    expectedRange: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
      validate: { validator: noExponential, message: "Exponential notation is not allowed in expected range" },
    },
    remarks: {
      type: String,
      trim: true,
      maxlength: 500,
      validate: { validator: noUrl, message: "URLs are not allowed in remarks" },
    },
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
