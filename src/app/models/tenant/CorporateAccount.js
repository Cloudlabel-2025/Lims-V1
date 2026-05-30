import mongoose from "mongoose";

export const CorporateAccountSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    contactPerson: { type: String, trim: true, maxlength: 120 },
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
