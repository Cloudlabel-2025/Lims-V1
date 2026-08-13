export function cleanString(value) {
  return String(value || "").trim();
}

export function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
