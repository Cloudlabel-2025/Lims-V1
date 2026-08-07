import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../", import.meta.url);

test("patient portal loads signature fields on report get", async () => {
  const meRouteSrc = await readFile(new URL("src/app/api/patient-portal/me/route.js", root), "utf8");

  // Verify that it selects the signature and version fields
  assert.match(meRouteSrc, /reviewedBy/);
  assert.match(meRouteSrc, /reviewedAt/);
  assert.match(meRouteSrc, /approvedBy/);
  assert.match(meRouteSrc, /approvedAt/);
  assert.match(meRouteSrc, /releasedBy/);
  assert.match(meRouteSrc, /releasedAt/);
  assert.match(meRouteSrc, /version/);
  
  // Verify that it resolves signature names and roles using User model
  assert.match(meRouteSrc, /const\s+resolveNameAndRole\s*=\s*async/);
  assert.match(meRouteSrc, /reports\.push\(report\);/);
});

test("patient portal page.js fetches theme and supports high-fidelity printing", async () => {
  const pageSrc = await readFile(new URL("src/app/patient/portal/page.js", root), "utf8");

  // Verify that it fetches /api/theme
  assert.match(pageSrc, /fetch\("\/api\/theme"\)/);
  
  // Verify that it defines print stylesheet override
  assert.match(pageSrc, /@media print/);
  assert.match(pageSrc, /#print-root-wrapper/);
});
