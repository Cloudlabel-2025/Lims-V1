import mongoose from "mongoose";

export const PatientPortalAccountSchema = new mongoose.Schema({
  patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true, unique: true, index: true },
  status: { type: String, enum: ["invited", "active", "disabled", "locked"], default: "invited", index: true },
  activationTokenHash: { type: String, select: false },
  accessPinHash: { type: String, select: false },
  activationExpiresAt: { type: Date, select: false, index: true },
  portalPinHash: { type: String, select: false },
  credentialVersion: { type: Number, default: 1 },
  failedLoginAttempts: { type: Number, default: 0 },
  lockedUntil: Date,
  activatedAt: Date,
  lastLoginAt: Date,
  lastAccessSlipIssuedAt: Date,
  termsAcceptedAt: Date,
  preferredLanguage: { type: String, enum: ["en", "ta"], default: "en" },
}, { timestamps: true });

export function getPatientPortalAccountModel(connection = mongoose) {
  return connection.models.PatientPortalAccount || connection.model("PatientPortalAccount", PatientPortalAccountSchema);
}

const PatientPortalAccount = getPatientPortalAccountModel();
export default PatientPortalAccount;
