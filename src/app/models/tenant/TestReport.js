import mongoose from "mongoose";

function isExponentialNotation(value) {
  return typeof value === "string" && /[eE]/.test(value);
}

function getCounterModel(connection) {
  return (
    connection.models.Counter ||
    connection.model(
      "Counter",
      new mongoose.Schema({
        name: { type: String, required: true, unique: true },
        seq: { type: Number, default: 0 },
      })
    )
  );
}

async function getNextSequence(connection, name) {
  const Counter = getCounterModel(connection);
  const counter = await Counter.findOneAndUpdate(
    { name },
    { $inc: { seq: 1 } },
    { returnDocument: "after", upsert: true }
  );

  return counter.seq;
}

const ResultParameterSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    unit: { type: String, trim: true },
    normalMin: { type: Number },
    normalMax: { type: Number },
    required: { type: Boolean, default: true },
    value: { type: Number },
    textValue: { type: String, trim: true },
    flag: {
      type: String,
      enum: ["normal", "low", "high", "not-entered"],
      default: "normal",
    },
  },
  { _id: false }
);

export const TestReportSchema = new mongoose.Schema(
  {
    reportId: {
      type: String,
      unique: true,
      immutable: true,
      index: true,
    },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
      index: true,
    },
    testDefinition: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TestDefinition",
      required: true,
      index: true,
    },
    sample: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sample",
      index: true,
    },
    billingRecord: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BillingRecord",
      index: true,
    },
    testSnapshot: {
      testId: String,
      name: String,
      code: String,
      categoryName: String,
      sampleType: String,
    },
    results: {
      type: [ResultParameterSchema],
      default: [],
    },
    remarks: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    status: {
      type: String,
      enum: ["draft", "verified", "released", "delivered"],
      default: "draft",
      index: true,
    },
    enteredBy: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

TestReportSchema.pre("validate", function validateResults() {
  if (this.results && Array.isArray(this.results)) {
    for (let i = 0; i < this.results.length; i++) {
      const tv = this.results[i].textValue;
      if (!tv || tv === "") continue;
      if (isExponentialNotation(tv)) {
        this.invalidate(`results.${i}.textValue`, `Exponential notation is not allowed: "${tv}"`);
      } else if (!Number.isFinite(Number(tv))) {
        this.invalidate(`results.${i}.textValue`, `Invalid numeric value: "${tv}"`);
      }
    }
  }
});

TestReportSchema.index({ createdAt: -1 });
TestReportSchema.index({ status: 1, createdAt: -1 });
TestReportSchema.index({ patient: 1, createdAt: -1 });

TestReportSchema.pre("save", async function generateReportId() {
  if (this.reportId) return;

  const seq = await getNextSequence(this.constructor.db, "testReportId");
  this.reportId = `RPT-${String(seq).padStart(6, "0")}`;
});

export function getTestReportModel(connection = mongoose) {
  return connection.models.TestReport || connection.model("TestReport", TestReportSchema);
}

const TestReport = getTestReportModel();
export default TestReport;
