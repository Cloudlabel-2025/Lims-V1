import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../", import.meta.url);

test("tenant accounts dashboard does not expose the statistics module", async () => {
  const source = await readFile(new URL("src/app/(dashboard)/accounts/page.js", root), "utf8");

  assert.doesNotMatch(source, /href:\s*["']\/accounts\/stats["']/);
  assert.doesNotMatch(source, /label:\s*["']Statistics["']/);
});

