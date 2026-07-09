export function money(value) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(Number(value || 0));
}

export function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function isExponential(value) {
  return typeof value === "string" && /[eE]/.test(value);
}

export function hasUrl(value) {
  return /https?:\/\//.test(value);
}

export function isValidName(value) {
  return /^[A-Za-z0-9 .&'\/,()@_-]*$/.test(value);
}

export function inputStyle() {
  return { height: 38, fontSize: 13 };
}

export function sanitizeVendorName(value) {
  const cleaned = (value || "").replace(/[^A-Za-z0-9-]/g, "");
  const parts = cleaned.split("-");
  if (parts.length > 2) return parts[0] + "-" + parts.slice(1).join("");
  return cleaned;
}

export function sanitizeCorporateName(value) {
  const cleaned = (value || "").replace(/[^A-Za-z0-9- ]/g, "");
  const parts = cleaned.split("-");
  if (parts.length > 2) return parts[0] + "-" + parts.slice(1).join("");
  return cleaned.slice(0, 30);
}

export function sanitizeAmountInput(value) {
  const cleaned = (value || "").replace(/[^0-9]/g, "");
  return cleaned.slice(0, 7);
}

export function isValidUrl(value) {
  if (!value) return true;
  return /^https?:\/\/[^\s$.?#].[^\s]*$/i.test(value);
}
