import assert from "node:assert/strict";
import test from "node:test";

import {
  getHostnameFromHeaders,
  getTenantIdFromHostname,
  normalizeRootDomain,
} from "../../src/app/lib/tenant-resolver.js";
import { buildTenantUrl } from "../../src/app/lib/subdomain.js";

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

test("tenant URLs use the configured root domain", () => {
  const previousRootDomain = process.env.ROOT_DOMAIN;
  const previousProtocol = process.env.PUBLIC_APP_PROTOCOL;
  process.env.ROOT_DOMAIN = "lims.store";
  process.env.PUBLIC_APP_PROTOCOL = "https";

  try {
    assert.equal(
      buildTenantUrl("blood", "https://app.lims.store/api/auth/login", "/dashboard"),
      "https://blood.lims.store/dashboard"
    );
  } finally {
    if (previousRootDomain === undefined) {
      delete process.env.ROOT_DOMAIN;
    } else {
      process.env.ROOT_DOMAIN = previousRootDomain;
    }
    if (previousProtocol === undefined) {
      delete process.env.PUBLIC_APP_PROTOCOL;
    } else {
      process.env.PUBLIC_APP_PROTOCOL = previousProtocol;
    }
  }
});

test("hostname extraction prefers forwarded host headers", () => {
  const headers = new Headers({
    host: "lims.store",
    "x-forwarded-host": "blood.lims.store",
  });

  assert.equal(getHostnameFromHeaders(headers), "blood.lims.store");
});

test("hostname extraction parses standard forwarded header", () => {
  const headers = new Headers({
    host: "lims.store",
    forwarded: "for=203.0.113.10;proto=https;host=blood.lims.store",
  });

  assert.equal(getHostnameFromHeaders(headers), "blood.lims.store");
});
