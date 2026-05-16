import mongoose from "mongoose";

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

export const SampleSchema = new mongoose.Schema(
  {
    sampleId: {
      type: String,
      unique: true,
      immutable: true,
      index: true,
    },
    barcode: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    billingRecord: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BillingRecord",
      required: true,
      index: true,
    },
    billingItemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
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
    },
    testSnapshot: {
      testId: String,
      name: String,
      code: String,
      categoryName: String,
      sampleType: String,
    },
    collectedAt: {
      type: Date,
    },
    collectorName: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "collected", "processing", "rejected", "reported"],
      default: "pending",
      index: true,
    },
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: 300,
    },
  },
  { timestamps: true }
);

SampleSchema.pre("save", async function generateSampleId() {
  if (!this.sampleId) {
    const seq = await getNextSequence(this.constructor.db, "sampleId");
    this.sampleId = `SMP-${String(seq).padStart(6, "0")}`;
  }

  if (!this.barcode) {
    this.barcode = this.sampleId;
  }
});

export function getSampleModel(connection = mongoose) {
  return connection.models.Sample || connection.model("Sample", SampleSchema);
}

const Sample = getSampleModel();
export default Sample;
