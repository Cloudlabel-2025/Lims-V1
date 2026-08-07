import crypto from "node:crypto";
import { buildTenantUrl } from "./subdomain.js";

export const PATIENT_ACCESS_TTL_MS = 365 * 24 * 60 * 60 * 1000; // 1 year fallback

export async function createPatientAccessCredential(tenantId, requestUrl) {
  const portalPath = `/patient?tenantId=${encodeURIComponent(tenantId)}`;
  const portalUrl = buildTenantUrl(tenantId, requestUrl, portalPath);
  return {
    portalUrl,
    activationUrl: portalUrl, // keep alias for compatibility
    expiresAt: new Date(Date.now() + PATIENT_ACCESS_TTL_MS),
  };
}

export function normalizeDob(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function buildWhatsAppShareUrl(tenantId, requestUrl, patientName, phone, portalUrl) {
  const rawPhone = String(phone || "").replace(/\D/g, "");
  const targetPhone = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;
  const message = `Hello ${patientName || "Patient"},\n\nAccess your lab visit records, receipts and test reports on the Patient Portal:\n${portalUrl}\n\nLogin using your Mobile Number as Username and Date of Birth as Password.\n\nThank you!`;
  return `https://api.whatsapp.com/send?phone=${encodeURIComponent(targetPhone)}&text=${encodeURIComponent(message)}`;
}

export function hashPatientActivationToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

export function isValidPortalPin(value) {
  return /^\d{4}$/.test(String(value || ""));
}

export function generateMobileOtp() {
  const otp = "123456";
  const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  return { otp, otpHash, expiresAt };
}

export function hashOtpToken(otp) {
  return crypto.createHash("sha256").update(String(otp || "")).digest("hex");
}
