import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

test("BUG-006: Inventory stock validation during sample processing", () => {
  const sampleHelperFile = read("src/app/lib/sample-inventory.js");
  const sampleDetailApi = read("src/app/api/samples/[id]/route.js");
  const wizardPageFile = read("src/app/(dashboard)/samples/wizard/page.js");
  const stepDetailsFile = read("src/app/(dashboard)/samples/wizard/steps/StepDetails.js");

  // 1. Helper validates available stock against required stock
  assert.match(
    sampleHelperFile,
    /available\s*<\s*quantityInBase/,
    "reserveSampleInventory must check if available stock is less than required"
  );
  assert.match(
    sampleHelperFile,
    /stockFinished\s*\?/,
    "reserveSampleInventory must distinguish between stock finished (0) and insufficient stock"
  );
  assert.match(
    sampleHelperFile,
    /stock finished\. Reorder stock/,
    "reserveSampleInventory must include stock finished message"
  );
  assert.match(
    sampleHelperFile,
    /reorderRequired:\s*true/,
    "reserveSampleInventory details must indicate reorder is required"
  );
  assert.match(
    sampleHelperFile,
    /itemsToReserve\.push/,
    "reserveSampleInventory must validate all items before applying reservations"
  );

  // 2. GET /api/samples/[id] populates required inventory and reserved inventory
  assert.match(
    sampleDetailApi,
    /path:\s*"requiredInventoryItems\.item"/,
    "GET /api/samples/[id] must populate required inventory items"
  );
  assert.match(
    sampleDetailApi,
    /populate\("reservedInventory\.item"\)/,
    "GET /api/samples/[id] must populate reserved inventory item"
  );

  // 3. PUT /api/samples/[id] validates and reserves inventory on start-processing
  assert.match(
    sampleDetailApi,
    /action === "start-processing"/,
    "PUT /api/samples/[id] must handle start-processing"
  );
  assert.match(
    sampleDetailApi,
    /reserveSampleInventory\(auth\.tenantId,\s*inventoryToReserve\)/,
    "start-processing must call reserveSampleInventory"
  );
  assert.match(
    sampleDetailApi,
    /sample\.reservedInventory\s*=\s*reservations/,
    "start-processing must save reservations to sample"
  );

  // 4. Sample Wizard pre-populates configured test items
  assert.match(
    wizardPageFile,
    /testDef\.requiredInventoryItems/,
    "Wizard must read requiredInventoryItems from test definitions"
  );
  assert.match(
    wizardPageFile,
    /setReservedInventory\(initialConfigured\)/,
    "Wizard must pre-populate reservedInventory state from test configuration"
  );
  assert.match(
    wizardPageFile,
    /reservedInventory:\s*payloadInventory/,
    "handleStartProcessing must pass reserved inventory payload to PUT /api/samples/[id]"
  );

  // 5. StepDetails blocks submission when stock is 0 or insufficient, or row is invalid
  assert.match(
    stepDetailsFile,
    /available\s*<=\s*0[\s\S]*blocked:\s*true/,
    "StepDetails must block submission when available stock is 0"
  );
  assert.match(
    stepDetailsFile,
    /requested\s*>\s*available[\s\S]*blocked:\s*true/,
    "StepDetails must block submission when requested stock exceeds available"
  );
  assert.match(
    stepDetailsFile,
    /!Number\.isFinite\(qty\)\s*\|\|\s*qty\s*<=\s*0[\s\S]*blocked:\s*true/,
    "StepDetails must block submission when quantity is invalid or <= 0"
  );
  assert.match(
    stepDetailsFile,
    /disabled=\{Boolean\(inventoryBlocker\)\s*\|\|\s*submitting\}/,
    "Action button must be disabled when inventoryBlocker is present"
  );
  assert.match(
    stepDetailsFile,
    /Cannot proceed with sample processing:/,
    "StepDetails must show a clear blocker alert when stock is insufficient or finished"
  );
});
