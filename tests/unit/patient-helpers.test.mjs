import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateAge,
  formatDate,
  getEmptyForm,
  getISTNow,
  getInitials,
} from "../../src/app/utils/patient-helpers.js";

test("getEmptyForm returns the expected patient registration defaults", () => {
  assert.deepEqual(getEmptyForm(), {
    name: "",
    dob: "",
    age: "",
    gender: "",
    genderIdentity: "",
    phone: "",
    address: "",
    uhId: "",
    collectionTime: "",
    receivedTime: "",
    refDoctorName: "",
    reportType: "Hand",
    barcode: "",
    selectedTests: [],
  });
});

test("getInitials handles missing, blank, single, and multi-part names", () => {
  assert.equal(getInitials(), "?");
  assert.equal(getInitials("   "), "?");
  assert.equal(getInitials("radha"), "R");
  assert.equal(getInitials("Radha Kumar"), "RK");
  assert.equal(getInitials("  radha   kumar  devi "), "RK");
});

test("calculateAge returns empty for missing DOB and zero for future DOB", () => {
  assert.equal(calculateAge(""), "");
  assert.equal(calculateAge("2999-01-01"), 0);
});

test("calculateAge calculates age relative to today's date", () => {
  const today = new Date();
  const birthYear = today.getFullYear() - 30;
  const dob = `${birthYear}-${String(today.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(today.getDate()).padStart(2, "0")}`;

  assert.equal(calculateAge(dob), 30);
});

test("getISTNow returns a datetime-local compatible timestamp", () => {
  assert.match(getISTNow(), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
});

test("formatDate returns a placeholder for empty values and formats dates", () => {
  assert.equal(formatDate(""), "—");
  assert.equal(formatDate("2026-01-15T12:00:00.000Z"), "Jan 15, 2026");
});
