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
    { new: true, upsert: true }
  );

  return counter.seq;
}

export const TestPackageSchema = new mongoose.Schema(
  {
    packageId: {
      type: String,
      unique: true,
      immutable: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 150,
      index: true,
    },
    code: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 30,
      unique: true,
      sparse: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    tests: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "TestDefinition",
        required: true,
      },
    ],
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      index: true,
    },
  },
  { timestamps: true }
);

TestPackageSchema.index({ name: 1 }, { unique: true });

TestPackageSchema.pre("save", async function generatePackageId() {
  if (this.packageId) return;

  const connection = this.constructor.db || this.db;
  if (!connection) return;

  const seq = await getNextSequence(connection, "testPackageId");
  this.packageId = `PKG-${String(seq).padStart(6, "0")}`;
});

export function getTestPackageModel(connection = mongoose) {
  if (connection.models.TestPackage) {
    delete connection.models.TestPackage;
  }
  return connection.model("TestPackage", TestPackageSchema);
}

const TestPackage = getTestPackageModel();
export default TestPackage;
