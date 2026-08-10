import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("billing patient selection supports searching by name, ID, and phone", () => {
  const source = fs.readFileSync(
    path.join(rootDir, "src/app/(dashboard)/billing/CreateBillTab.js"),
    "utf8"
  );

  assert.match(source, /SearchableSelect/);
  assert.match(source, /Search by patient name, ID, or phone/);
  assert.match(source, /searchTerms: `\$\{item\.name/);
  assert.doesNotMatch(source, /<select\s+id="billing-patient"/);
});
