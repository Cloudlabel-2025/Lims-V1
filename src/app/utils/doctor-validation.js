export const DOCTOR_LIMITS = {
  maxNameLength: 30,
  maxExperienceYears: 60,
};

export function cleanDoctorValue(value) {
  return String(value ?? "").trim();
}

export function isValidDoctorName(value) {
  return /^[A-Za-z ]+$/.test(cleanDoctorValue(value));
}

export function isValidMciNumber(value) {
  const cleaned = cleanDoctorValue(value);
  if (/https?:\/\//i.test(cleaned) || /www\./i.test(cleaned)) return false;
  if (cleaned.length < 5 || cleaned.length > 20) return false;
  return /^[A-Za-z0-9/]+$/.test(cleaned);
}

export function isValidDoctorDegree(value) {
  const cleaned = cleanDoctorValue(value);
  if (/https?:\/\/|www\.|\.[a-z]{2,}\b/i.test(cleaned)) return false;
  return /^[A-Za-z .,/&()-]+$/.test(cleaned);
}

export function isValidExperienceYears(value) {
  const cleaned = cleanDoctorValue(value);
  if (!/^\d{2}\.\d$/.test(cleaned)) return false;
  const years = Number(cleaned);
  return Number.isFinite(years) && years >= 0 && years <= DOCTOR_LIMITS.maxExperienceYears;
}

export function isValidDoctorEmail(value) {
  return /^[A-Za-z0-9][A-Za-z0-9._-]*@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(cleanDoctorValue(value));
}

export function isValidPhoneNumber(value) {
  return /^\d{10}$/.test(cleanDoctorValue(value));
}

export function isValidCommission(value) {
  const cleaned = cleanDoctorValue(value);
  if (cleaned === "" || !/^\d+(\.\d{1,2})?$/.test(cleaned)) return false;
  const commission = Number(cleaned);
  return Number.isFinite(commission) && commission >= 0 && commission <= 40;
}

function containsUrl(value) {
  return /https?:\/\/|www\./i.test(value);
}

export function isValidClinicName(value) {
  const cleaned = cleanDoctorValue(value);
  if (containsUrl(cleaned)) return false;
  if (cleaned.length > 25) return false;
  return /^[A-Za-z ]+$/.test(cleaned);
}

export function isValidLocation(value) {
  const cleaned = cleanDoctorValue(value);
  if (containsUrl(cleaned)) return false;
  if (cleaned.length > 20) return false;
  return /^[A-Za-z ]+$/.test(cleaned);
}

export function isValidAddress(value) {
  const cleaned = cleanDoctorValue(value);
  if (containsUrl(cleaned)) return false;
  if (cleaned.length > 100) return false;
  return /^[A-Za-z0-9 .,/-]+$/.test(cleaned);
}

export function validateDoctorPayload(payload, { partial = false } = {}) {
  const errors = {};
  const form = payload || {};

  const requireField = (field, message) => {
    if (!partial || Object.prototype.hasOwnProperty.call(form, field)) {
      if (!cleanDoctorValue(form[field])) errors[field] = message;
    }
  };

  requireField("name", "Doctor name is required");
  if (cleanDoctorValue(form.name)) {
    const name = cleanDoctorValue(form.name);
    if (name.length < 2) errors.name = "Name must be at least 2 characters";
    else if (name.length > DOCTOR_LIMITS.maxNameLength) errors.name = "Name must not exceed 30 characters";
    else if (!isValidDoctorName(name)) errors.name = "Only letters, spaces, and periods allowed";
  }

  requireField("mciNumber", "MCI registration number is required");
  if (cleanDoctorValue(form.mciNumber) && !isValidMciNumber(form.mciNumber)) {
    errors.mciNumber = "Enter a valid MCI registration number";
  }

  requireField("speciality", "Speciality is required");

  requireField("degree", "Qualification/Degree is required");
  if (cleanDoctorValue(form.degree) && !isValidDoctorDegree(form.degree)) {
    errors.degree = "Only qualification text is allowed";
  }

  requireField("experience", "Experience is required");
  if (cleanDoctorValue(form.experience) && !isValidExperienceYears(form.experience)) {
    errors.experience = "Experience must be in format YY.M (e.g. 12.1 for 12 years 1 month)";
  }

  requireField("phone", "Mobile number is required");
  if (cleanDoctorValue(form.phone) && !isValidPhoneNumber(form.phone)) {
    errors.phone = "Mobile number must be 10 digits";
  }

  requireField("email", "Email address is required");
  if (cleanDoctorValue(form.email) && !isValidDoctorEmail(form.email)) {
    errors.email = "Invalid email format";
  }

  requireField("clinicName", "Clinic/Hospital name is required");
  if (cleanDoctorValue(form.clinicName)) {
    const name = cleanDoctorValue(form.clinicName);
    if (name.length > 25) errors.clinicName = "Clinic name must not exceed 25 characters";
    else if (!isValidClinicName(name)) errors.clinicName = "Only letters and spaces allowed";
  }

  requireField("location", "Location is required");
  if (cleanDoctorValue(form.location)) {
    const loc = cleanDoctorValue(form.location);
    if (loc.length > 20) errors.location = "Location must not exceed 20 characters";
    else if (!isValidLocation(loc)) errors.location = "Only letters and spaces allowed";
  }

  requireField("clinicAddress", "Practice address is required");
  if (cleanDoctorValue(form.clinicAddress)) {
    const addr = cleanDoctorValue(form.clinicAddress);
    if (addr.length > 100) errors.clinicAddress = "Address must not exceed 100 characters";
    else if (!isValidAddress(addr)) errors.clinicAddress = "Only letters, numbers, spaces, and . , / - allowed";
  }

  if ((!partial || Object.prototype.hasOwnProperty.call(form, "commission")) && !isValidCommission(form.commission)) {
    errors.commission = "Commission must be between 0 and 40%";
  }

  return errors;
}

export function formatDoctorValidationErrors(errors) {
  return Object.values(errors).join("; ");
}
