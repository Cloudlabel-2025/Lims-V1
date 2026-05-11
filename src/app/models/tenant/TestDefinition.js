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

const TestParameterSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    },
    name: {
      type: String,
      required: false,
      trim: true,
      maxlength: 100,
    },
    unit: {
      type: String,
      trim: true,
      maxlength: 40,
    },
    maleMin: {
      type: Number,
    },
    maleMax: {
      type: Number,
    },
    femaleMin: {
      type: Number,
    },
    femaleMax: {
      type: Number,
    },
    normalMin: {
      type: Number,
    },
    normalMax: {
      type: Number,
    },
    required: {
      type: Boolean,
      default: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

export const TestDefinitionSchema = new mongoose.Schema(
  {
    testId: {
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
      maxlength: 120,
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
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TestCategory",
      required: true,
      index: true,
    },
    sampleType: {
      type: String,
      trim: true,
      maxlength: 80,
    },
    price: {
      type: Number,
      min: 0,
      default: 0,
    },
    parameters: {
      type: [TestParameterSchema],
      default: [],
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      index: true,
    },
  },
  { timestamps: true }
);

TestDefinitionSchema.index({ name: 1, category: 1 }, { unique: true });

TestDefinitionSchema.pre("validate", function normalizeParameters() {
  const seen = new Set();
  this.parameters = (this.parameters || []).map((parameter, index) => {
    const key =
      parameter.key ||
      String(parameter.name || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") ||
      `parameter-${index + 1}`;

    if (seen.has(key)) {
      throw new Error(`Duplicate parameter key: ${key}`);
    }
    seen.add(key);

    return {
      ...parameter,
      key,
      sortOrder: Number.isFinite(Number(parameter.sortOrder)) ? Number(parameter.sortOrder) : index,
    };
  });
});

TestDefinitionSchema.pre("save", async function generateTestId() {
  if (this.testId) return;

  const connection = this.constructor.db || this.db;
  if (!connection) return;

  const seq = await getNextSequence(connection, "testDefinitionId");
  this.testId = `TST-${String(seq).padStart(6, "0")}`;
});

export function getTestDefinitionModel(connection = mongoose) {
  if (connection.models.TestDefinition) {
    delete connection.models.TestDefinition;
  }
  return connection.model("TestDefinition", TestDefinitionSchema);
}

const TestDefinition = getTestDefinitionModel();
export default TestDefinition;
