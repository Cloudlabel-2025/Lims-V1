import crypto from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(crypto.scrypt);
const keyLength = 64;

export function validatePasswordPolicy(password) {
  const value = String(password || "");
  const errors = [];

  if (value.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }

  if (!/[A-Z]/.test(value)) {
    errors.push("Password must contain at least one uppercase letter");
  }

  if (!/[a-z]/.test(value)) {
    errors.push("Password must contain at least one lowercase letter");
  }

  if (!/\d/.test(value)) {
    errors.push("Password must contain at least one number");
  }

  if (!/[^A-Za-z0-9]/.test(value)) {
    errors.push("Password must contain at least one special character");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export async function hashPassword(password) {
  const policy = validatePasswordPolicy(password);

  if (!policy.valid) {
    throw new Error(policy.errors.join("; "));
  }

  return hashSecret(password);
}

export async function hashSecret(value) {
  const secret = String(value || "");
  if (!secret) throw new Error("Secret is required");
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = await scryptAsync(secret, salt, keyLength);
  return `scrypt:${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password, passwordHash) {
  if (!password || !passwordHash) return false;

  const [algorithm, salt, storedKey] = passwordHash.split(":");
  if (algorithm !== "scrypt" || !salt || !storedKey) return false;

  const derivedKey = await scryptAsync(password, salt, keyLength);
  const storedBuffer = Buffer.from(storedKey, "hex");

  if (storedBuffer.length !== derivedKey.length) return false;

  return crypto.timingSafeEqual(storedBuffer, derivedKey);
}

export function createResetToken() {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashResetToken(token);

  return { token, tokenHash };
}

export function hashResetToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
