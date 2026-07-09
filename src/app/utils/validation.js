export function clean(value) {
  return String(value ?? "").trim();
}

export function hasUrl(value) {
  return /https?:\/\//.test(value);
}

export function containsUrl(value) {
  return /https?:\/\/|www\./i.test(value);
}

export function isExponential(value) {
  return typeof value === "string" && /[eE]/.test(value);
}

const NAME_REGEX = /^[A-Za-z0-9 .&'\/,()@_-]+$/;

export function isValidName(value) {
  return NAME_REGEX.test(clean(value));
}

const ITEM_CODE_REGEX = /^[A-Za-z0-9-]+$/;

export function isValidItemCode(value) {
  return ITEM_CODE_REGEX.test(clean(value));
}

export function isValidPersonName(value) {
  const cleaned = clean(value);
  if (containsUrl(cleaned)) return false;
  return /^[A-Za-z .]+$/.test(cleaned);
}

export function isValidPhone(value) {
  return /^\d{10}$/.test(clean(value));
}

export function isValidEmail(value) {
  return /^[A-Za-z0-9][A-Za-z0-9._-]*@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(clean(value));
}

export function isValidNumeric(value) {
  if (isExponential(value)) return false;
  const cleaned = clean(value);
  if (cleaned === "") return false;
  return /^\d+(\.\d{1,2})?$/.test(cleaned);
}

export function isInRange(value, min, max) {
  const num = Number(value);
  return Number.isFinite(num) && num >= min && num <= max;
}

export function hasRepeatedChars(value, limit = 3) {
  return /(.)\1{2,}/.test(value);
}

export function isValidDateRange(from, to) {
  if (!from || !to) return true;
  return new Date(from) <= new Date(to);
}

export function isValidFutureDate(value) {
  if (!value) return true;
  return new Date(value) >= new Date(new Date().toDateString());
}

export function isValidPastDate(value) {
  if (!value) return true;
  return new Date(value) <= new Date();
}

export function trimObject(obj) {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") result[key] = value.trim();
    else result[key] = value;
  }
  return result;
}
