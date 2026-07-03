import mongoose from "mongoose";

export const ExpenseEntrySchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: ["reagent", "staff", "equipment", "overhead"],
      required: true,
      index: true,
    },
    vendorName: {
      type: String,
      trim: true,
      minlength: 3,
      maxlength: 30,
      match: [/^[A-Za-z0-9 .&'\/,()@_-]*$/, "Vendor name contains invalid characters"],
      validate: {
        validator: function (v) {
          if (!v) return true;
          return !/https?:\/\//.test(v);
        },
        message: "URLs are not allowed in vendor name",
      },
    },
    amount: { type: Number, required: true, min: 0.01, max: 9999999 },
    taxAmount: { type: Number, default: 0, min: 0 },
    paidFrom: {
      type: String,
      enum: ["cash", "bank", "vendor-payable"],
      default: "vendor-payable",
      index: true,
    },
    date: { type: Date, required: true, default: Date.now, index: true },
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true },
    tenantId: { type: String, required: true, trim: true, lowercase: true, index: true },
    attachmentUrl: { type: String, trim: true },
    journalEntryId: { type: mongoose.Schema.Types.ObjectId, ref: "JournalEntry" },
  },
  { timestamps: true }
);

ExpenseEntrySchema.index({ tenantId: 1, date: -1 });

export function getExpenseEntryModel(connection = mongoose) {
  return connection.models.ExpenseEntry || connection.model("ExpenseEntry", ExpenseEntrySchema);
}

const ExpenseEntry = getExpenseEntryModel();
export default ExpenseEntry;
