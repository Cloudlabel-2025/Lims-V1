import crypto from "node:crypto";
import { hashSecret } from "./password.js";
import { buildTenantUrl } from "./subdomain.js";

export const PATIENT_ACCESS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function createPatientAccessCredential(tenantId, requestUrl) {
  const token = crypto.randomBytes(32).toString("base64url");
  const accessPin = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  const activationPath = `/patient/activate?tenantId=${encodeURIComponent(tenantId)}&token=${encodeURIComponent(token)}`;
  return {
    token,
    tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
    accessPin,
    accessPinHash: await hashSecret(accessPin),
    expiresAt: new Date(Date.now() + PATIENT_ACCESS_TTL_MS),
    activationUrl: buildTenantUrl(tenantId, requestUrl, activationPath),
  };
}

export function hashPatientActivationToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

export function normalizeDob(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function isValidPortalPin(value) {
  return /^\d{4}$/.test(String(value || ""));
}

export function generateMobileOtp() {
  const otp = String(crypto.randomInt(100000, 1000000));
  const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
  return { otp, otpHash, expiresAt };
}

export function hashOtpToken(otp) {
  return crypto.createHash("sha256").update(String(otp || "")).digest("hex");
}

export function buildWhatsAppShareUrl(tenantId, requestUrl, patientName, phone, activationUrl) {
  const rawPhone = String(phone || "").replace(/\D/g, "");
  const targetPhone = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;
  const message = `Hello ${patientName || "Patient"},\n\nView your lab visit records, billing receipts, and official test reports directly on your mobile phone here:\n${activationUrl}\n\nThank you!`;
  return `https://api.whatsapp.com/send?phone=${encodeURIComponent(targetPhone)}&text=${encodeURIComponent(message)}`;
}
