export const DOCTOR_LIMITS = {
  maxNameLength: 50,
  maxExperienceYears: 80,
};

export function cleanDoctorValue(value) {
  return String(value ?? "").trim();
}

export function isValidDoctorName(value) {
  return /^[A-Za-z .]+$/.test(cleanDoctorValue(value));
}

export function isValidMciNumber(value) {
  const cleaned = cleanDoctorValue(value);
  return /^[A-Za-z]{2,}[A-Za-z\s/-]*\d[\d/-]*(?:[\s/-]*\d+)*$/.test(cleaned);
}

export function isValidDoctorDegree(value) {
  const cleaned = cleanDoctorValue(value);
  if (/https?:\/\/|www\.|\.[a-z]{2,}\b/i.test(cleaned)) return false;
  return /^[A-Za-z .,/&()-]+$/.test(cleaned);
}

export function isValidExperienceYears(value) {
  const cleaned = cleanDoctorValue(value);
  if (!/^\d+$/.test(cleaned)) return false;
  const years = Number(cleaned);
  return Number.isInteger(years) && years >= 0 && years <= DOCTOR_LIMITS.maxExperienceYears;
}

export function isValidDoctorEmail(value) {
  return /^[A-Za-z0-9][A-Za-z0-9._%+-]*@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(cleanDoctorValue(value));
}

export function isValidPhoneNumber(value) {
  return /^\d{10}$/.test(cleanDoctorValue(value));
}

export function isValidCommission(value) {
  const cleaned = cleanDoctorValue(value);
  if (cleaned === "") return true;
  const commission = Number(cleaned);
  return Number.isFinite(commission) && commission >= 0 && commission <= 40;
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
    else if (name.length > DOCTOR_LIMITS.maxNameLength) errors.name = "Name must not exceed 50 characters";
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
    errors.experience = "Experience must be a whole number between 0 and 80";
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
  requireField("location", "Location is required");
  requireField("clinicAddress", "Practice address is required");

  if ((!partial || Object.prototype.hasOwnProperty.call(form, "commission")) && !isValidCommission(form.commission)) {
    errors.commission = "Commission must be between 0 and 40%";
  }

  return errors;
}

export function formatDoctorValidationErrors(errors) {
  return Object.values(errors).join("; ");
}
