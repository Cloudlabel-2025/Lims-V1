import mongoose from "mongoose";

export const ExpenseCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      maxlength: 50,
    },
  },
  { timestamps: true }
);

ExpenseCategorySchema.index({ name: 1 }, { unique: true });

export function getExpenseCategoryModel(connection = mongoose) {
  return connection.models.ExpenseCategory || connection.model("ExpenseCategory", ExpenseCategorySchema);
}

const ExpenseCategory = getExpenseCategoryModel();
export default ExpenseCategory;