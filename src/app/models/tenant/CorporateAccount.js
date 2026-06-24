import mongoose from "mongoose";

export const CorporateAccountSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
      match: [/^[A-Za-z0-9 .&'\/,()@_-]*$/, "Name contains invalid characters"],
      validate: {
        validator: function (v) {
          return !/https?:\/\//.test(v);
        },
        message: "URLs are not allowed in corporate name",
      },
    },
    contactPerson: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      match: [/^[A-Za-z0-9 .&'\/,()@_-]*$/, "Contact person contains invalid characters"],
      validate: {
        validator: function (v) {
          if (!v) return true;
          return !/https?:\/\//.test(v);
        },
        message: "URLs are not allowed in contact person",
      },
    },
    creditLimit: { type: Number, default: 0, min: 0 },
    outstandingBalance: { type: Number, default: 0 },
    tenantId: { type: String, required: true, trim: true, lowercase: true, index: true },
    statementCycle: { type: String, enum: ["monthly", "weekly"], default: "monthly" },
  },
  { timestamps: true }
);

CorporateAccountSchema.index({ tenantId: 1, name: 1 }, { unique: true });

export function getCorporateAccountModel(connection = mongoose) {
  return connection.models.CorporateAccount || connection.model("CorporateAccount", CorporateAccountSchema);
}

const CorporateAccount = getCorporateAccountModel();
export default CorporateAccount;
