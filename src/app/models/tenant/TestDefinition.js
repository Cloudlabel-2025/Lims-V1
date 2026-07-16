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
      required: true,
      trim: true,
      maxlength: 100,
      match: [/^[A-Za-z][A-Za-z0-9 .&'\/,-]*$/, "Parameter name contains invalid characters"],
      validate: {
        validator: (v) => !/https?:\/\/|www\./i.test(v),
        message: "Parameter name cannot contain a URL",
      },
    },
    unit: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40,
      match: [/^[0-9]+(\.[0-9]+)?$/, "Unit should be only measured in numerals"],
      validate: {
        validator: (v) => !/https?:\/\/|www\./i.test(v),
        message: "Unit cannot contain a URL",
      },
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
      match: [/^[A-Za-z][A-Za-z0-9 .&'\/,-]*$/, "Test name contains invalid characters"],
      validate: {
        validator: (v) => !/https?:\/\/|www\./i.test(v),
        message: "Test name cannot contain a URL",
      },
    },
    code: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 30,
      unique: true,
      sparse: true,
      match: [/^[A-Za-z0-9_-]+$/, "Code contains invalid characters"],
      validate: {
        validator: (v) => !v || !/https?:\/\/|www\./i.test(v),
        message: "Code cannot contain a URL",
      },
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TestCategory",
      required: true,
      index: true,
    },
    sampleType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
      match: [/^[A-Za-z][A-Za-z0-9 .&'\/,-]*$/, "Sample type contains invalid characters"],
      validate: {
        validator: (v) => !/https?:\/\/|www\./i.test(v),
        message: "Sample type cannot contain a URL",
      },
    },
    price: {
      type: Number,
      required: true,
      min: 0,
      max: 999999999,
      default: 0,
    },
    parameters: {
      type: [TestParameterSchema],
      default: [],
    },
    requiredInventoryItems: [
      {
        _id: false,
        item: { type: mongoose.Schema.Types.ObjectId, ref: "InventoryItem", required: true },
        quantityPerTest: { type: Number, required: true, min: 0 },
        uom: { type: mongoose.Schema.Types.ObjectId, ref: "InventoryUom", required: true },
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

TestDefinitionSchema.index({ name: 1, category: 1 }, { unique: true });
TestDefinitionSchema.index({ status: 1, updatedAt: -1 });

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
  return connection.models.TestDefinition || connection.model("TestDefinition", TestDefinitionSchema);
}

const TestDefinition = getTestDefinitionModel();
export default TestDefinition;
