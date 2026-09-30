/**
 * Reference range resolution and evaluation utilities
 * Supports age-specific and gender-specific reference ranges and age gap tracking
 */

export function resolveReferenceRange(parameter, patient = {}) {
  const age = Number(patient.age);
  const gender = String(patient.gender || "").toLowerCase();

  // If ageRanges array is configured and patient age is known, match age bracket
  if (Array.isArray(parameter.ageRanges) && parameter.ageRanges.length > 0 && Number.isFinite(age)) {
    const match = parameter.ageRanges.find(
      (r) =>
        (!Number.isFinite(r.ageMin) || age >= r.ageMin) &&
        (!Number.isFinite(r.ageMax) || age <= r.ageMax)
    );
    if (match) {
      if (gender === "male" && (Number.isFinite(match.maleMin) || Number.isFinite(match.maleMax))) {
        return {
          min: match.maleMin ?? match.normalMin,
          max: match.maleMax ?? match.normalMax,
          source: "age-male",
        };
      }
      if (gender === "female" && (Number.isFinite(match.femaleMin) || Number.isFinite(match.femaleMax))) {
        return {
          min: match.femaleMin ?? match.normalMin,
          max: match.femaleMax ?? match.normalMax,
          source: "age-female",
        };
      }
      return { min: match.normalMin, max: match.normalMax, source: "age-common" };
    }
  }

  // Check age applicability limits
  const hasAgeMin = Number.isFinite(parameter.ageMin);
  const hasAgeMax = Number.isFinite(parameter.ageMax);
  let outOfAgeRange = false;
  let ageGap = null;
  if (Number.isFinite(age) && ((hasAgeMin && age < parameter.ageMin) || (hasAgeMax && age > parameter.ageMax))) {
    outOfAgeRange = true;
    ageGap = `Patient age ${age} outside configured test age range (${parameter.ageMin ?? 0}-${parameter.ageMax ?? "unlimited"} years)`;
  }

  // Gender-specific reference range
  if (gender === "male" && (Number.isFinite(parameter.maleMin) || Number.isFinite(parameter.maleMax))) {
    return {
      min: parameter.maleMin ?? parameter.normalMin,
      max: parameter.maleMax ?? parameter.normalMax,
      source: "male",
      outOfAgeRange,
      ageGap,
    };
  }
  if (gender === "female" && (Number.isFinite(parameter.femaleMin) || Number.isFinite(parameter.femaleMax))) {
    return {
      min: parameter.femaleMin ?? parameter.normalMin,
      max: parameter.femaleMax ?? parameter.normalMax,
      source: "female",
      outOfAgeRange,
      ageGap,
    };
  }

  return { min: parameter.normalMin, max: parameter.normalMax, source: "common", outOfAgeRange, ageGap };
}

export function getFlag(parameter, rawValue, patient = {}) {
  if (rawValue === "" || rawValue === null || rawValue === undefined) return "not-entered";

  const value = Number(rawValue);
  if (!Number.isFinite(value)) return "normal";

  const resolved = resolveReferenceRange(parameter, patient);
  const min = Number.isFinite(resolved.min) ? resolved.min : parameter.normalMin;
  const max = Number.isFinite(resolved.max) ? resolved.max : parameter.normalMax;

  if (Number.isFinite(min) && value < min) return "low";
  if (Number.isFinite(max) && value > max) return "high";
  return "normal";
}
