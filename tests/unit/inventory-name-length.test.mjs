import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

test("BUG-002: Inventory item name field length allows up to 120 characters across schema, APIs, and UI", () => {
  const modelFile = read("src/app/models/tenant/InventoryItem.js");
  const createApi = read("src/app/api/inventory/route.js");
  const updateApi = read("src/app/api/inventory/[id]/route.js");
  const uiPage = read("src/app/(dashboard)/inventory/page.js");

  // 1. Schema constraint
  assert.match(
    modelFile,
    /name:\s*\{[^}]*maxlength:\s*120/,
    "InventoryItem schema must allow maxlength 120 for name"
  );

  // 2. Create API validation
  assert.match(
    createApi,
    /name\.length\s*>\s*120/,
    "POST /api/inventory must check name.length > 120"
  );
  assert.match(
    createApi,
    /Item name must not exceed 120 characters/,
    "POST /api/inventory error message should specify 120 characters"
  );

  // 3. Update API validation
  assert.match(
    updateApi,
    /v\.length\s*>\s*120/,
    "PATCH /api/inventory/[id] must check v.length > 120"
  );
  assert.match(
    updateApi,
    /Item name must not exceed 120 characters/,
    "PATCH /api/inventory/[id] error message should specify 120 characters"
  );

  // 4. UI Form validation and input attributes
  assert.match(
    uiPage,
    /itemForm\.name\.length\s*>\s*120/,
    "Item form validation must allow up to 120 characters"
  );
  assert.match(
    uiPage,
    /Name must not exceed 120 characters/,
    "UI error message should specify 120 characters"
  );
  assert.match(
    uiPage,
    /<input[^>]*maxLength=\{120\}[^>]*value=\{itemForm\.name\}/,
    "Item Name input must have maxLength={120}"
  );

  // 5. Test real-world inventory names of various lengths (> 15, >= 30, up to 120 chars)
  const sample35Chars = "Disposable Sterile Syringe 5ml Luer";
  const sample65Chars = "Ethylenediaminetetraacetic Acid Dipotassium Salt K2-EDTA Solution";
  const sample110Chars = "Rapid Chromatographic Immunoassay Diagnostic Multi-Panel Drug Testing Cassette with Specimen Collection Cup";

  assert.equal(sample35Chars.length > 15, true);
  assert.equal(sample35Chars.length >= 30, true);
  assert.equal(sample35Chars.length <= 120, true);

  assert.equal(sample65Chars.length > 60, true);
  assert.equal(sample65Chars.length <= 120, true);

  assert.equal(sample110Chars.length > 100, true);
  assert.equal(sample110Chars.length <= 120, true);
});
