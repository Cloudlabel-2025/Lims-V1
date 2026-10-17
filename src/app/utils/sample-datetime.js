// Sample registration uses IST wall-clock values in datetime-local inputs.
// Always supply the offset so browsers and servers interpret them identically.
export function parseSampleDateTime(value) {
  if (typeof value !== "string" || !value.trim()) return new Date(NaN);
  const timestamp = value.trim();
  const hasOffset = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(timestamp);
  return new Date(hasOffset ? timestamp : `${timestamp}+05:30`);
}
