import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("screen shield permits browser inspection during local development", () => {
  const source = fs.readFileSync(
    path.join(rootDir, "src/app/components/ScreenShieldProvider.js"),
    "utf8"
  );

  assert.match(source, /process\.env\.NODE_ENV !== "production"/);
  assert.match(source, /return undefined/);
});
