import crypto from "node:crypto";

export const DOCTOR_INVITATION_TTL_MS = 24 * 60 * 60 * 1000;

export function createDoctorInvitation() {
  const otp = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  return {
    otp,
    otpHash: crypto.createHash("sha256").update(otp).digest("hex"),
    expiresAt: new Date(Date.now() + DOCTOR_INVITATION_TTL_MS),
  };
}

export function splitDoctorName(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "Doctor",
    lastName: parts.slice(1).join(" ") || "User",
  };
}
