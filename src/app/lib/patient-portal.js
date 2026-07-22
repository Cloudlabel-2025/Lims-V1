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
