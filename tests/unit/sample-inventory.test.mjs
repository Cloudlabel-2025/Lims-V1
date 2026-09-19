import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../", import.meta.url);

test("sample registration processes custom reservedInventory from payload", async () => {
  const routeSrc = await readFile(new URL("src/app/api/samples/route.js", root), "utf8");
  const inventoryHelperSrc = await readFile(new URL("src/app/lib/sample-inventory.js", root), "utf8");

  // Verify that it reads reservedInventory from request body
  assert.match(routeSrc, /const\s*\{\s*reservedInventory\s*\}\s*=\s*body;/);

  // Verify that sample registration delegates inventory reservation through the shared helper
  assert.match(routeSrc, /reserveSampleInventory\(auth\.tenantId,\s*reservedInventory\)/);

  // Verify that it iterates over the reservedInventory array
  assert.match(inventoryHelperSrc, /for\s*\(\s*const\s+reqItem\s+of\s+reservedInventory\s*\)/);

  // Verify that it calculates quantityInBase and validates availability
  assert.match(inventoryHelperSrc, /qty\s*\*\s*conversionToBase/);
  assert.match(inventoryHelperSrc, /item\.stockOnHandBase/);
  assert.match(inventoryHelperSrc, /available\s*<\s*quantityInBase/);
  assert.match(inventoryHelperSrc, /reservedBase:\s*quantityInBase/);
  assert.match(inventoryHelperSrc, /Reorder stock/);
  assert.match(routeSrc, /sample\.reservedInventory\s*=\s*reservations;/);
});

test("sample status PUT transition does not fall back to requiredInventoryItems", async () => {
  const detailRouteSrc = await readFile(new URL("src/app/api/samples/[id]/route.js", root), "utf8");

  // Verify that the fallback block requiredInventoryItems is deleted/removed
  assert.doesNotMatch(detailRouteSrc, /testWithInventory\?\.requiredInventoryItems\?\.length/);
  assert.doesNotMatch(detailRouteSrc, /Auto-consumed\s+for\s+sample\s+.*requiredInventoryItems/);

  // Verify that it clears reservedInventory after consumption
  assert.match(detailRouteSrc, /sample\.reservedInventory\s*=\s*\[\];/);
});
