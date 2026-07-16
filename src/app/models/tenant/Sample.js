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

async function getNextSequence(connection, name, session) {
  const Counter = getCounterModel(connection);
  const options = { returnDocument: "after", upsert: true };
  if (session) options.session = session;
  const counter = await Counter.findOneAndUpdate({ name }, { $inc: { seq: 1 } }, options);

  return counter.seq;
}

const CustodyEntrySchema = new mongoose.Schema(
  {
    action: { type: String, required: true, trim: true },
    handledBy: { type: String, required: true, trim: true },
    notes: { type: String, trim: true, maxlength: 300 },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

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
      default: "not-entered",
    },
  },
  { _id: false }
);

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
      index: true,
    },
    billingItemId: {
      type: mongoose.Schema.Types.ObjectId,
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
    sampleType: {
      type: String,
      trim: true,
      maxlength: 80,
    },
    receivedAt: { type: Date },
    receivedBy: { type: String, trim: true },
    batchId: { type: String, trim: true, index: true },
    results: {
      type: [ResultParameterSchema],
      default: [],
    },
    status: {
      type: String,
      enum: ["registered", "collected", "processing", "completed", "released", "rejected", "archived"],
      default: "registered",
      index: true,
    },
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: 300,
    },
    custodyLog: {
      type: [CustodyEntrySchema],
      default: [],
    },
    reservedInventory: {
      type: [
        {
          _id: false,
          item: { type: mongoose.Schema.Types.ObjectId, ref: "InventoryItem" },
          quantityBase: { type: Number, min: 0 },
          uom: { type: mongoose.Schema.Types.ObjectId, ref: "InventoryUom" },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

SampleSchema.pre("save", async function generateSampleId() {
  if (!this.sampleId) {
    const session = this.$session();
    const seq = await getNextSequence(this.constructor.db, "sampleId", session);
    this.sampleId = `SMP-${String(seq).padStart(6, "0")}`;
  }

  if (!this.barcode) {
    this.barcode = this.sampleId;
  }
});

SampleSchema.methods.addCustodyEntry = function (action, handledBy, notes) {
  this.custodyLog.push({
    action,
    handledBy,
    notes: notes || "",
    timestamp: new Date(),
  });
};

SampleSchema.methods.transitionStatus = function (newStatus, handledBy, notes) {
  const oldStatus = this.status;

  const validTransitions = {
    registered: ["collected", "rejected"],
    collected: ["processing", "rejected"],
    processing: ["completed", "rejected"],
    completed: ["released", "rejected"],
    rejected: [],
    released: [],
    archived: [],
  };

  if (newStatus === "rejected" && !["rejected", "released", "archived"].includes(oldStatus)) {
    this.status = newStatus;
    this.addCustodyEntry(`status:${oldStatus} -> ${newStatus}`, handledBy, notes);
    return;
  }

  const allowed = validTransitions[oldStatus] || [];
  if (!allowed.includes(newStatus)) {
    throw new Error(`Cannot transition from ${oldStatus} to ${newStatus}`);
  }

  this.status = newStatus;
  this.addCustodyEntry(`status:${oldStatus} -> ${newStatus}`, handledBy, notes);
};

SampleSchema.index({ createdAt: -1 });
SampleSchema.index({ status: 1, createdAt: -1 });
export function getSampleModel(connection = mongoose) {
  return connection.models.Sample || connection.model("Sample", SampleSchema);
}

const Sample = getSampleModel();
export default Sample;
