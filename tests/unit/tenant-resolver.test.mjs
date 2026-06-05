import assert from "node:assert/strict";
import test from "node:test";

import {
  getTenantIdFromHostname,
  normalizeRootDomain,
} from "../../src/app/lib/tenant-resolver.js";

test("normalizeRootDomain accepts plain and URL values", () => {
  assert.equal(normalizeRootDomain("lims.store"), "lims.store");
  assert.equal(normalizeRootDomain("https://lims.store/path"), "lims.store");
});

test("root and platform subdomains are not treated as tenants", () => {
  const previousRootDomain = process.env.ROOT_DOMAIN;
  process.env.ROOT_DOMAIN = "lims.store";

  try {
    assert.equal(getTenantIdFromHostname("lims.store"), null);
    assert.equal(getTenantIdFromHostname("www.lims.store"), null);
    assert.equal(getTenantIdFromHostname("app.lims.store"), null);
    assert.equal(getTenantIdFromHostname("blood.lims.store"), "blood");
  } finally {
    if (previousRootDomain === undefined) {
      delete process.env.ROOT_DOMAIN;
    } else {
      process.env.ROOT_DOMAIN = previousRootDomain;
    }
  }
});
