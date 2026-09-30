import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

test("BUG-005: Sample status lifecycle transitions through 'processing' before 'completed'", () => {
  const sampleModelFile = read("src/app/models/tenant/Sample.js");
  const sampleRouteFile = read("src/app/api/samples/[id]/route.js");
  const wizardPageFile = read("src/app/(dashboard)/samples/wizard/page.js");
  const stepDetailsFile = read("src/app/(dashboard)/samples/wizard/steps/StepDetails.js");
  const samplesTableFile = read("src/app/(dashboard)/samples/page.js");

  // 1. Model transition rules: collected -> processing -> completed
  assert.match(
    sampleModelFile,
    /collected:\s*\["processing",\s*"rejected"\]/,
    "Sample model must transition from collected to processing"
  );
  assert.match(
    sampleModelFile,
    /processing:\s*\["completed",\s*"rejected"\]/,
    "Sample model must transition from processing to completed"
  );

  // 2. Sample API route handles 'start-processing'
  assert.match(
    sampleRouteFile,
    /"start-processing":\s*"samples\.update"/,
    "actionPermissionMap must allow start-processing with samples.update permission"
  );

  assert.match(
    sampleRouteFile,
    /else if \(action === "start-processing"\)/,
    "PUT /api/samples/[id] must handle action === 'start-processing'"
  );

  assert.match(
    sampleRouteFile,
    /sample\.transitionStatus\("processing",\s*handledBy,\s*notes\s*\|\|\s*"Processing started"\)/,
    "start-processing must transition sample status to 'processing'"
  );

  // 3. Billing record updates when processing starts
  assert.match(
    sampleRouteFile,
    /item\.status\s*=\s*"processing"/,
    "start-processing must update billing item status to 'processing'"
  );
  assert.match(
    sampleRouteFile,
    /billingRecord\.status\s*=\s*"in-progress"/,
    "start-processing must update open billing record to 'in-progress'"
  );

  // 4. UI Wizard handles start-processing before results step
  assert.match(
    wizardPageFile,
    /action:\s*"start-processing"/,
    "Sample wizard must call PUT /api/samples/[id] with action: 'start-processing'"
  );
  assert.match(
    wizardPageFile,
    /onStartProcessing=\{handleStartProcessing\}/,
    "StepDetails in wizard must receive handleStartProcessing"
  );

  // 5. StepDetails button changes from 'Start Processing' to 'Next' once processing
  assert.match(
    stepDetailsFile,
    /sample\.status === "processing"\s*\?\s*<>Next\s*\{Icons\.arrowRight\}<\/>\s*:\s*<>Start Processing\s*\{Icons\.arrowRight\}<\/>/,
    "StepDetails button must display 'Start Processing' when collected and 'Next' when processing"
  );

  // 6. Samples table displays 'Start processing' for collected and 'Enter results' for processing
  assert.match(
    samplesTableFile,
    /sample\.status === "collected"\s*\?\s*"Start processing"/,
    "Samples list must display 'Start processing' for collected status"
  );
  assert.match(
    samplesTableFile,
    /sample\.status === "processing"\s*\?\s*"Enter results"/,
    "Samples list must display 'Enter results' for processing status"
  );
});
