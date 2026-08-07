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

export const TestRequestSchema = new mongoose.Schema(
  {
    requestId: {
      type: String,
      unique: true,
      immutable: true,
      index: true,
    },
    tenantId: {
      type: String,
      required: true,
      index: true,
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
      index: true,
    },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
      index: true,
    },
    testPackages: [
      {
        packageId: String,
        name: String,
        price: Number,
      },
    ],
    tests: [
      {
        testId: String,
        name: String,
        price: Number,
      },
    ],
    vitals: {
      bp: String,
      height: String,
      weight: String,
      pulse: String,
      temperature: String,
      sugar: String,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    status: {
      type: String,
      enum: ["pending", "received", "completed", "cancelled"],
      default: "pending",
      index: true,
    },
    billingRecord: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BillingRecord",
    },
  },
  { timestamps: true }
);

TestRequestSchema.pre("save", async function generateRequestId() {
  if (this.requestId) return;
  const seq = await getNextSequence(this.constructor.db, "requestId");
  this.requestId = `REQ-${String(seq).padStart(6, "0")}`;
});

export function getTestRequestModel(connection = mongoose) {
  return connection.models.TestRequest || connection.model("TestRequest", TestRequestSchema);
}

const TestRequest = getTestRequestModel();
export default TestRequest;
