import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

test("Reports & Pathology: BUG-053, BUG-054, BUG-056, BUG-057, BUG-058, BUG-059", async (t) => {
  const reportRouteSrc = read("src/app/api/reports/[id]/route.js");
  const sampleRouteSrc = read("src/app/api/samples/[id]/route.js");

  await t.test("BUG-053: Required test results validation before review", () => {
    assert.match(
      reportRouteSrc,
      /emptyRequired\s*=\s*allParams\.find/,
      "Report review must check for missing required parameter values"
    );
    assert.match(
      reportRouteSrc,
      /error:\s*`Parameter "\$\{emptyRequired\.name\s*\|\|\s*emptyRequired\.key\}" is required before review`/,
      "Report review must reject missing required parameters"
    );
  });

  await t.test("BUG-054: Numeric result validation before investigation status update", () => {
    // In sampleRoute, invalidValues check must occur before investigation status mutation
    const invalidValuesIdx = sampleRouteSrc.indexOf("if (invalidValues.length > 0)");
    const statusCompletedIdx = sampleRouteSrc.indexOf('completed.investigation.status = "completed"');
    assert.ok(invalidValuesIdx !== -1 && statusCompletedIdx !== -1, "Both checks must exist");
    assert.ok(
      invalidValuesIdx < statusCompletedIdx,
      "invalid numeric values check must precede investigation completion status update"
    );
  });

  await t.test("BUG-056: Non-draft report edit restriction", () => {
    assert.match(
      reportRouteSrc,
      /if\s*\(report\.status\s*!==\s*"draft"\)\s*\{\s*return\s+Response\.json\(\{\s*error:\s*"Only draft reports can be edited"/,
      "Report save action must reject edits on non-draft reports"
    );
  });

  await t.test("BUG-057: Unauthorized role report release denial", () => {
    assert.match(
      reportRouteSrc,
      /allowedRoles\s*=\s*\["pathologist",\s*"admin",\s*"lab admin",\s*"lab manager"/,
      "Report release action must verify allowed clinical roles"
    );
    assert.match(
      reportRouteSrc,
      /error:\s*"Only Pathologist or Lab Manager can release reports"/,
      "Report release must return 403 for unauthorized roles"
    );
  });

  await t.test("BUG-058 & BUG-059: Post-release amendment and audit logging", () => {
    assert.match(
      reportRouteSrc,
      /action\s*===\s*"amend"/,
      "Report route must support amend action"
    );
    assert.match(
      reportRouteSrc,
      /report\.createNewVersion\(\)/,
      "Amend action must create a new version snapshot"
    );
    assert.match(
      reportRouteSrc,
      /amend:\s*"reports\.amended"/,
      "Audit action map must include reports.amended"
    );
  });
});
