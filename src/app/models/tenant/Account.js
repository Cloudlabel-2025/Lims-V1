import mongoose from "mongoose";

export const accountTypes = ["asset", "liability", "equity", "revenue", "expense"];

export const AccountSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true, maxlength: 20, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    type: { type: String, enum: accountTypes, required: true, index: true },
    subtype: { type: String, trim: true, maxlength: 80, index: true },
    tenantId: { type: String, required: true, trim: true, lowercase: true, index: true },
    isSystem: { type: Boolean, default: false, index: true },
    balance: { type: Number, default: 0 },
  },
  { timestamps: true }
);

AccountSchema.index({ tenantId: 1, code: 1 }, { unique: true });
AccountSchema.index({ tenantId: 1, subtype: 1 });

AccountSchema.pre("deleteOne", { document: true, query: false }, function preventSystemDelete(next) {
  if (this.isSystem) {
    next(new Error("System accounts cannot be deleted"));
    return;
  }

  next();
});

export function getAccountModel(connection = mongoose) {
  return connection.models.Account || connection.model("Account", AccountSchema);
}

const Account = getAccountModel();
export default Account;
