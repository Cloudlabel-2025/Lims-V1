import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

test("Patients & Visits: BUG-019 (Edit patient), BUG-020 (Soft delete and restore), BUG-021 (Patient edit audit)", async (t) => {
  const patientModelSrc = read("src/app/models/tenant/Patient.js");
  const patientIdRouteSrc = read("src/app/api/patient/[id]/route.js");
  const patientRestoreRouteSrc = read("src/app/api/patient/[id]/restore/route.js");
  const patientRouteSrc = read("src/app/api/patient/route.js");
  const editPageSrc = read("src/app/(dashboard)/patients/edit/[id]/page.js");
  const patientsPageSrc = read("src/app/(dashboard)/patients/page.js");
  const patientTableSrc = read("src/app/(dashboard)/patients/PatientTable.js");
  const patientGridSrc = read("src/app/(dashboard)/patients/PatientGrid.js");
  const patientSidebarSrc = read("src/app/(dashboard)/patients/PatientSidebar.js");

  await t.test("BUG-019: Patient profile editing and form state persistence", () => {
    assert.match(
      editPageSrc,
      /const\s*\[showErrors,\s*setShowErrors\]\s*=\s*useState\(false\)/,
      "Edit patient page must define showErrors state so handleSubmit does not throw ReferenceError"
    );
    assert.match(
      editPageSrc,
      /setShowErrors\(true\)/,
      "Edit patient page must trigger setShowErrors on submission"
    );
    assert.match(
      patientIdRouteSrc,
      /delete\s+body\.patientId;\s+delete\s+body\._id;\s+delete\s+body\.createdAt;/,
      "PUT /api/patient/[id] must strip immutable fields before update"
    );
    assert.match(
      patientIdRouteSrc,
      /Patient\.findByIdAndUpdate/,
      "PUT /api/patient/[id] must persist validated patient profile changes"
    );
  });

  await t.test("BUG-020: Soft delete and restore preserves history and links", () => {
    assert.match(
      patientModelSrc,
      /isDeleted:\s*\{\s*type:\s*Boolean,\s*default:\s*false\s*\}/,
      "Patient schema must declare isDeleted field with default false"
    );
    assert.match(
      patientModelSrc,
      /deletedAt:\s*\{\s*type:\s*Date,\s*default:\s*null\s*\}/,
      "Patient schema must declare deletedAt field"
    );
    assert.match(
      patientIdRouteSrc,
      /patient\.isDeleted\s*=\s*true/,
      "DELETE /api/patient/[id] must mark isDeleted = true instead of hard deleting"
    );
    assert.match(
      patientIdRouteSrc,
      /body\.action\s*===\s*"restore"\s*\|\|\s*body\.restore\s*===\s*true/,
      "PUT /api/patient/[id] must support restore action"
    );
    assert.match(
      patientRestoreRouteSrc,
      /patient\.isDeleted\s*=\s*false/,
      "POST /api/patient/[id]/restore must reset isDeleted to false"
    );
    assert.match(
      patientRouteSrc,
      /query\.isDeleted\s*=\s*\{\s*\$ne:\s*true\s*\}/,
      "GET /api/patient must exclude soft-deleted records from active patient listings"
    );
    assert.match(
      patientsPageSrc,
      /restorePatient\s*=\s*useCallback/,
      "patients/page.js must implement restorePatient callback"
    );
    assert.match(
      patientsPageSrc,
      /onRestorePatient=\{restorePatient\}/,
      "patients/page.js must pass onRestorePatient to child components"
    );
    assert.match(
      patientTableSrc,
      /patient\.isDeleted\s*&&\s*onRestorePatient/,
      "PatientTable must render Restore button when patient is soft-deleted"
    );
    assert.match(
      patientGridSrc,
      /patient\.isDeleted\s*&&\s*onRestorePatient/,
      "PatientGrid must render Restore button when patient is soft-deleted"
    );
    assert.match(
      patientSidebarSrc,
      /patient\.isDeleted\s*&&\s*onRestorePatient/,
      "PatientSidebar must render Restore Patient button when patient is soft-deleted"
    );
  });

  await t.test("BUG-021: Patient profile update audit trail records old/new values, actor, and timestamp", () => {
    assert.match(
      patientIdRouteSrc,
      /action:\s*"patients\.updated"/,
      "PUT /api/patient/[id] must write audit log with action 'patients.updated'"
    );
    assert.match(
      patientIdRouteSrc,
      /changes\[key\]\s*=\s*\{\s*old:\s*oldVal/,
      "PUT /api/patient/[id] audit log must capture old and new values for modified fields"
    );
    assert.match(
      patientIdRouteSrc,
      /action:\s*"patients\.deleted"/,
      "DELETE /api/patient/[id] must write audit log with action 'patients.deleted'"
    );
    assert.match(
      patientRestoreRouteSrc,
      /action:\s*"patients\.restored"/,
      "POST /api/patient/[id]/restore must write audit log with action 'patients.restored'"
    );
  });
});
