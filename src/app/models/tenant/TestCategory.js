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

export const TestCategorySchema = new mongoose.Schema(
  {
    categoryId: {
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
      maxlength: 80,
      unique: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 300,
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

TestCategorySchema.pre("save", async function generateCategoryId() {
  if (this.categoryId) return;

  const seq = await getNextSequence(this.constructor.db, "testCategoryId");
  this.categoryId = `TCAT-${String(seq).padStart(6, "0")}`;
});

export function getTestCategoryModel(connection = mongoose) {
  if (connection.models.TestCategory) {
    delete connection.models.TestCategory;
  }
  return connection.model("TestCategory", TestCategorySchema);
}

const TestCategory = getTestCategoryModel();
export default TestCategory;
