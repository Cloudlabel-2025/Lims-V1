import assert from "node:assert/strict";
import test from "node:test";

import {
  isValidDoctorDegree,
  isValidExperienceYears,
  isValidMciNumber,
  validateDoctorPayload,
} from "../../src/app/utils/doctor-validation.js";

const validDoctor = {
  name: "Aravind",
  speciality: "Cardiologist",
  degree: "MBBS",
  experience: "3",
  mciNumber: "TNMC 345/67",
  phone: "9679796796",
  email: "aravind@gmail.com",
  clinicName: "Unity Hospital",
  location: "Chennai",
  clinicAddress: "Main Road",
  commission: "0",
};

test("doctor validation accepts valid registration data", () => {
  assert.deepEqual(validateDoctorPayload(validDoctor), {});
});

test("doctor validation rejects invalid, empty, and illegal MCI numbers", () => {
  assert.equal(isValidMciNumber("TNMC 345/67"), true);
  assert.equal(isValidMciNumber("^^)%$546$#@"), false);
  assert.equal(isValidMciNumber("https://www.youtube.com/watch?v=wFn8Exk6I9I"), false);

  assert.match(validateDoctorPayload({ ...validDoctor, mciNumber: "" }).mciNumber, /required/);
});

test("doctor validation rejects illegal qualification text", () => {
  assert.equal(isValidDoctorDegree("MBBS"), true);
  assert.equal(isValidDoctorDegree("www.youtube.com"), false);
  assert.equal(isValidDoctorDegree("sg32342td"), false);
});

test("doctor validation rejects non-whole and unrealistic experience values", () => {
  assert.equal(isValidExperienceYears("3"), true);
  assert.equal(isValidExperienceYears("3.46346E+78"), false);
  assert.equal(isValidExperienceYears(".e"), false);
  assert.equal(isValidExperienceYears("81"), false);
});

test("doctor validation requires email address", () => {
  assert.match(validateDoctorPayload({ ...validDoctor, email: "" }).email, /required/);
  assert.match(validateDoctorPayload({ ...validDoctor, email: "^%$#!:)@mail.com" }).email, /Invalid/);
});
