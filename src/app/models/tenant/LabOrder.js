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

const OrderItemSchema = new mongoose.Schema(
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

export const LabOrderSchema = new mongoose.Schema(
  {
    orderId: {
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
      type: [OrderItemSchema],
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
    createdBy: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

LabOrderSchema.pre("save", async function generateOrderId() {
  if (this.orderId) return;

  const seq = await getNextSequence(this.constructor.db, "labOrderId");
  this.orderId = `ORD-${String(seq).padStart(6, "0")}`;
});

export function getLabOrderModel(connection = mongoose) {
  return connection.models.LabOrder || connection.model("LabOrder", LabOrderSchema);
}

const LabOrder = getLabOrderModel();
export default LabOrder;
