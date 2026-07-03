import mongoose from "mongoose";

export const accountTypes = ["asset", "liability", "equity", "revenue", "expense"];

export const AccountSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20,
      index: true,
      match: [/^[A-Za-z0-9_-]+$/, "Code must be alphanumeric with optional hyphens or underscores"],
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
      match: [/^[A-Za-z0-9 .&'\/,()@_-]*$/, "Name contains invalid characters"],
      validate: {
        validator: function (v) {
          return !/https?:\/\//.test(v);
        },
        message: "URLs are not allowed in account name",
      },
    },
    type: { type: String, enum: accountTypes, required: true, index: true },
    subtype: {
      type: String,
      trim: true,
      maxlength: 80,
      index: true,
      match: [/^[A-Za-z0-9 .&'\/,()@_-]*$/, "Subtype contains invalid characters"],
      validate: {
        validator: function (v) {
          if (!v) return true;
          return !/https?:\/\//.test(v);
        },
        message: "URLs are not allowed in subtype",
      },
    },
    tenantId: { type: String, required: true, trim: true, lowercase: true, index: true },
    isSystem: { type: Boolean, default: false, index: true },
    balance: { type: Number, default: 0 },
  },
  { timestamps: true }
);

AccountSchema.index({ tenantId: 1, code: 1 }, { unique: true });
AccountSchema.index({ tenantId: 1, subtype: 1 });

AccountSchema.pre("deleteOne", { document: true }, async function preventSystemDelete() {
  if (this.isSystem) {
    throw new Error("System accounts cannot be deleted");
  }
});

export function getAccountModel(connection = mongoose) {
  return connection.models.Account || connection.model("Account", AccountSchema);
}

const Account = getAccountModel();
export default Account;
