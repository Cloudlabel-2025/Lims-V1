import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveReferenceRange, getFlag } from "../../src/app/lib/reference-ranges.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");

test("BUG-028 (DL2052) - Package invalid member: inactive or duplicate tests blocked from package creation/update", () => {
  const postPkgRoutePath = path.join(rootDir, "src/app/api/tests/packages/route.js");
  const postPkgRouteContent = fs.readFileSync(postPkgRoutePath, "utf-8");

  assert.ok(
    postPkgRouteContent.includes("Duplicate tests cannot be added to a package"),
    "POST /api/tests/packages must reject duplicate tests in a package"
  );
  assert.ok(
    postPkgRouteContent.includes("Cannot add inactive test(s) to package"),
    "POST /api/tests/packages must reject inactive tests in a package"
  );

  const putPkgRoutePath = path.join(rootDir, "src/app/api/tests/packages/[id]/route.js");
  const putPkgRouteContent = fs.readFileSync(putPkgRoutePath, "utf-8");

  assert.ok(
    putPkgRouteContent.includes("Duplicate tests cannot be added to a package"),
    "PUT /api/tests/packages/[id] must reject duplicate tests in a package"
  );
  assert.ok(
    putPkgRouteContent.includes("Cannot add inactive test(s) to package"),
    "PUT /api/tests/packages/[id] must reject inactive tests in a package"
  );

  const testsPagePath = path.join(rootDir, "src/app/(dashboard)/tests/page.js");
  const testsPageContent = fs.readFileSync(testsPagePath, "utf-8");
  assert.ok(
    testsPageContent.includes("packageTestOptions") &&
    testsPageContent.includes('test.status === "active"'),
    "Tests page must filter out inactive tests from packageTestOptions"
  );
});

test("BUG-029 (DL2054) - Deactivate test: inactive tests and packages blocked from new billing while preserving existing bills", () => {
  const billingRoutePath = path.join(rootDir, "src/app/api/billing/route.js");
  const billingRouteContent = fs.readFileSync(billingRoutePath, "utf-8");

  assert.ok(
    billingRouteContent.includes("is inactive and cannot be billed"),
    "POST /api/billing must reject inactive tests and packages"
  );
  assert.ok(
    billingRouteContent.includes("contains inactive test"),
    "POST /api/billing must reject packages containing inactive member tests"
  );

  const billingPagePath = path.join(rootDir, "src/app/(dashboard)/billing/page.js");
  const billingPageContent = fs.readFileSync(billingPagePath, "utf-8");
  assert.ok(
    billingPageContent.includes("/api/tests/packages?status=active"),
    "Billing UI must fetch active packages"
  );
  assert.ok(
    billingPageContent.includes("investigationOptions") &&
    (billingPageContent.includes('t.status === "inactive"') || billingPageContent.includes('test.status === "inactive"')),
    "Billing UI must filter out inactive packages and packages with inactive member tests"
  );
});

test("BUG-030 (DL2056) - Age-specific ranges: model schema, API validation, and result interpretation with age gap tracking", () => {
  const modelPath = path.join(rootDir, "src/app/models/tenant/TestDefinition.js");
  const modelContent = fs.readFileSync(modelPath, "utf-8");
  assert.ok(
    modelContent.includes("ageMin:") && modelContent.includes("ageMax:") && modelContent.includes("ageRanges:"),
    "TestDefinition model must include ageMin, ageMax, and ageRanges in TestParameterSchema"
  );

  const reportModelPath = path.join(rootDir, "src/app/models/tenant/TestReport.js");
  const reportModelContent = fs.readFileSync(reportModelPath, "utf-8");
  assert.ok(
    reportModelContent.includes("outOfAgeRange:") && reportModelContent.includes("ageGap:"),
    "TestReport model must support outOfAgeRange and ageGap on ResultParameterSchema"
  );

  const editorPath = path.join(rootDir, "src/app/(dashboard)/tests/TestDefinitionEditor.js");
  const editorContent = fs.readFileSync(editorPath, "utf-8");
  assert.ok(
    editorContent.includes("Applicable test age range") && editorContent.includes("ageMin"),
    "TestDefinitionEditor must include applicable test age range input fields"
  );

  const pediatricAdultParameter = {
    key: "hemoglobin",
    name: "Hemoglobin",
    normalMin: 12,
    normalMax: 16,
    maleMin: 13.5,
    maleMax: 17.5,
    femaleMin: 12.0,
    femaleMax: 15.5,
    ageMin: 18,
    ageMax: 65,
    ageRanges: [
      {
        label: "Pediatric (1-12 yrs)",
        ageMin: 1,
        ageMax: 12,
        normalMin: 11.5,
        normalMax: 14.5,
      },
      {
        label: "Adult (18-65 yrs)",
        ageMin: 18,
        ageMax: 65,
        normalMin: 12.0,
        normalMax: 16.0,
        maleMin: 13.5,
        maleMax: 17.5,
        femaleMin: 12.0,
        femaleMax: 15.5,
      },
    ],
  };

  // Test 1: Pediatric patient uses pediatric age range
  const pediatricResolved = resolveReferenceRange(pediatricAdultParameter, { age: 5, gender: "female" });
  assert.equal(pediatricResolved.min, 11.5);
  assert.equal(pediatricResolved.max, 14.5);
  assert.equal(pediatricResolved.source, "age-common");

  // Test 2: Adult male uses adult male range
  const adultMaleResolved = resolveReferenceRange(pediatricAdultParameter, { age: 30, gender: "male" });
  assert.equal(adultMaleResolved.min, 13.5);
  assert.equal(adultMaleResolved.max, 17.5);
  assert.equal(adultMaleResolved.source, "age-male");

  // Test 3: Elderly patient (age 80, outside 18-65 parameter configured age) records age gap
  const simpleParameter = {
    key: "fasting_sugar",
    name: "Fasting Blood Sugar",
    normalMin: 70,
    normalMax: 100,
    ageMin: 18,
    ageMax: 65,
  };
  const elderlyResolved = resolveReferenceRange(simpleParameter, { age: 80, gender: "female" });
  assert.equal(elderlyResolved.outOfAgeRange, true);
  assert.ok(elderlyResolved.ageGap && elderlyResolved.ageGap.includes("Patient age 80 outside configured test age range"));

  // Test 4: Flags evaluated correctly against age/gender-specific ranges
  const lowFlag = getFlag(pediatricAdultParameter, "10.0", { age: 5, gender: "female" });
  assert.equal(lowFlag, "low");

  const normalFlag = getFlag(pediatricAdultParameter, "12.0", { age: 5, gender: "female" });
  assert.equal(normalFlag, "normal");

  const highFlag = getFlag(pediatricAdultParameter, "18.0", { age: 30, gender: "male" });
  assert.equal(highFlag, "high");
});
