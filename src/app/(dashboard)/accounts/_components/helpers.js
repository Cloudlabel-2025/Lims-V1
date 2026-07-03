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
