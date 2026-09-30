import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

test("lab name validation supports hyphens, slashes, ampersands, and punctuation", () => {
  const createPage = read("src/app/developer/labs/create/page.js");
  const labsRoute = read("src/app/api/developer/labs/route.js");

  const labNameRegex = /^[A-Za-z0-9][A-Za-z0-9\s.&'()\/,-]*[A-Za-z0-9.)]$/;

  // Check that both files use the updated regex
  assert.match(createPage, /A-Za-z0-9\\s\.&'\(\)\\\/,-/);
  assert.match(labsRoute, /A-Za-z0-9\\s\.&'\(\)\\\/,-/);

  // Check valid lab names
  assert.equal(labNameRegex.test("City-Lab"), true, "Hyphens should be valid");
  assert.equal(labNameRegex.test("City/Lab"), true, "Forward slashes should be valid");
  assert.equal(labNameRegex.test("R&D Diagnostics"), true, "Ampersands should be valid");
  assert.equal(labNameRegex.test("Apollo / SRL Diagnostics"), true, "Slashes with spaces should be valid");
  assert.equal(labNameRegex.test("Dr. Reddy's Lab"), true, "Apostrophes and dots should be valid");
  assert.equal(labNameRegex.test("HealthCare Co."), true, "Trailing dots for abbreviations should be valid");
  assert.equal(labNameRegex.test("Metropolitan (Branch 1)"), true, "Parentheses should be valid");
  assert.equal(labNameRegex.test("A/B"), true, "Short names with slash should be valid");

  // Check invalid lab names
  assert.equal(labNameRegex.test("/InvalidStart"), false, "Cannot start with slash");
  assert.equal(labNameRegex.test("-InvalidStart"), false, "Cannot start with hyphen");
  assert.equal(labNameRegex.test("InvalidEnd/"), false, "Cannot end with slash");
  assert.equal(labNameRegex.test("InvalidEnd-"), false, "Cannot end with hyphen");
  assert.equal(labNameRegex.test("<script>"), false, "HTML tags should be rejected");
});
