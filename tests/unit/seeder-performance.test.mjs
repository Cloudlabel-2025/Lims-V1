import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { mapInBatches } from "../../src/app/lib/seeder-utils.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("mapInBatches preserves order and limits concurrent seed writes", async () => {
  let active = 0;
  let maximumActive = 0;
  const values = Array.from({ length: 11 }, (_, index) => index + 1);

  const results = await mapInBatches(values, 3, async (value) => {
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    await new Promise((resolve) => setTimeout(resolve, 2));
    active -= 1;
    return value * 2;
  });

  assert.deepEqual(results, values.map((value) => value * 2));
  assert.equal(maximumActive, 3);
});

test("lab provisioning routes allow optimized seed work to finish", () => {
  const createRoute = fs.readFileSync(
    path.join(rootDir, "src/app/api/developer/labs/route.js"),
    "utf8"
  );
  const seedRoute = fs.readFileSync(
    path.join(rootDir, "src/app/api/developer/labs/[tenantId]/seed-defaults/route.js"),
    "utf8"
  );

  assert.match(createRoute, /export const maxDuration = 300/);
  assert.match(seedRoute, /export const maxDuration = 300/);
});

test("expense categories declare the name index only once", () => {
  const source = fs.readFileSync(
    path.join(rootDir, "src/app/models/tenant/ExpenseCategory.js"),
    "utf8"
  );

  assert.match(source, /name:\s*\{[\s\S]*?unique:\s*true/);
  assert.doesNotMatch(source, /ExpenseCategorySchema\.index\(\{ name: 1 \}/);
});
