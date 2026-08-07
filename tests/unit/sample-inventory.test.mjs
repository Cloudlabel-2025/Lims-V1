import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../", import.meta.url);

test("sample registration processes custom reservedInventory from payload", async () => {
  const routeSrc = await readFile(new URL("src/app/api/samples/route.js", root), "utf8");

  // Verify that it reads reservedInventory from request body
  assert.match(routeSrc, /const\s*\{\s*reservedInventory\s*\}\s*=\s*body;/);
  
  // Verify that it iterates over the reservedInventory array
  assert.match(routeSrc, /for\s*\(\s*const\s+reqItem\s+of\s+reservedInventory\s*\)/);
  
  // Verify that it calculates quantityInBase and validates availability
  assert.match(routeSrc, /qty\s*\*\s*\(\s*uom\.conversionToBase\s*\|\|\s*1\s*\)/);
  assert.match(routeSrc, /item\.stockOnHandBase/);
  assert.match(routeSrc, /reservedBase:\s*quantityInBase/);
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
