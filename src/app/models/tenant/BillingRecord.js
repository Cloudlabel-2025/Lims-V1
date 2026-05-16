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

const BillingItemSchema = new mongoose.Schema(
  {
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
      price: Number,
    },
    status: {
      type: String,
      enum: ["ordered", "sample-pending", "sample-collected", "processing", "reported", "cancelled"],
      default: "sample-pending",
      index: true,
    },
  },
  { timestamps: true }
);

export const BillingRecordSchema = new mongoose.Schema(
  {
    billId: {
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
    items: {
      type: [BillingItemSchema],
      validate: {
        validator: (value) => Array.isArray(value) && value.length > 0,
        message: "At least one test is required",
      },
    },
    priority: {
      type: String,
      enum: ["routine", "urgent"],
      default: "routine",
    },
    status: {
      type: String,
      enum: ["open", "in-progress", "completed", "cancelled"],
      default: "open",
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    referralDoctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
    },
    totalAmount: {
      type: Number,
      default: 0,
    },
    commissionAmount: {
      type: Number,
      default: 0,
    },
    paymentBreakdown: {
      cash: { type: Number, default: 0 },
      card: { type: Number, default: 0 },
      online: { type: Number, default: 0 },
    },
    billingStatus: {
      type: String,
      enum: ["unpaid", "paid", "cancelled"],
      default: "unpaid",
      index: true,
    },
    createdBy: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

BillingRecordSchema.pre("save", async function generateBillId() {
  if (this.billId) return;

  const seq = await getNextSequence(this.constructor.db, "billingRecordId");
  this.billId = `BILL-${String(seq).padStart(6, "0")}`;
});

export function getBillingRecordModel(connection = mongoose) {
  return connection.models.BillingRecord || connection.model("BillingRecord", BillingRecordSchema);
}

const BillingRecord = getBillingRecordModel();
export default BillingRecord;
