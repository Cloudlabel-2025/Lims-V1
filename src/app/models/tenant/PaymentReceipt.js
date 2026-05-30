import mongoose from "mongoose";

export const PaymentReceiptSchema = new mongoose.Schema(
  {
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "BillingRecord", required: true, index: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true, index: true },
    amount: { type: Number, required: true, min: 0.01 },
    method: {
      type: String,
      enum: ["cash", "card", "upi", "cheque", "corporate-credit"],
      required: true,
      index: true,
    },
    receivedAt: { type: Date, default: Date.now, index: true },
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    tenantId: { type: String, required: true, trim: true, lowercase: true, index: true },
    journalEntryId: { type: mongoose.Schema.Types.ObjectId, ref: "JournalEntry" },
    isRefunded: { type: Boolean, default: false, index: true },
    refundJournalEntryId: { type: mongoose.Schema.Types.ObjectId, ref: "JournalEntry" },
    refundedAt: { type: Date },
    refundedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

PaymentReceiptSchema.index({ tenantId: 1, invoiceId: 1, receivedAt: -1 });

export function getPaymentReceiptModel(connection = mongoose) {
  return connection.models.PaymentReceipt || connection.model("PaymentReceipt", PaymentReceiptSchema);
}

const PaymentReceipt = getPaymentReceiptModel();
export default PaymentReceipt;
