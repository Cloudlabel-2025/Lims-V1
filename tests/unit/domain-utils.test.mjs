import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

import {
  getDomainDnsRecords,
  isPlatformDomain,
  isValidCustomDomain,
  normalizeCustomDomain,
} from "../../src/app/lib/domain-utils.js";

test("custom domain normalization strips protocol and path", () => {
  assert.equal(normalizeCustomDomain("https://Portal.Example.com/login"), "portal.example.com");
  assert.equal(normalizeCustomDomain("example.com."), "example.com");
});

test("custom domain validation rejects invalid hosts", () => {
  assert.equal(isValidCustomDomain("bloodlab.com"), true);
  assert.equal(isValidCustomDomain("portal.bloodlab.com"), true);
  assert.equal(isValidCustomDomain("localhost"), false);
  assert.equal(isValidCustomDomain("not-a-domain"), false);
});

test("platform domains are not treated as customer custom domains", () => {
  const previousRootDomain = process.env.ROOT_DOMAIN;
  process.env.ROOT_DOMAIN = "lims.store";

  try {
    assert.equal(isPlatformDomain("lims.store"), true);
    assert.equal(isPlatformDomain("blood.lims.store"), true);
    assert.equal(isPlatformDomain("bloodlab.com"), false);
  } finally {
    if (previousRootDomain === undefined) {
      delete process.env.ROOT_DOMAIN;
    } else {
      process.env.ROOT_DOMAIN = previousRootDomain;
    }
  }
});

test("subdomain DNS instructions include ownership and CNAME routing records", () => {
  const previousRootDomain = process.env.ROOT_DOMAIN;
  const previousCnameTarget = process.env.CUSTOM_DOMAIN_CNAME_TARGET;
  process.env.ROOT_DOMAIN = "lims.store";
  process.env.CUSTOM_DOMAIN_CNAME_TARGET = "app.lims.example";

  try {
    const records = getDomainDnsRecords("portal.example.com", "verify-token");
    assert.deepEqual(records, [
      {
        type: "TXT",
        host: "_lims-verify.portal.example.com",
        value: "verify-token",
        purpose: "ownership",
      },
      {
        type: "CNAME",
        host: "portal.example.com",
        value: "app.lims.example",
        purpose: "routing",
      },
    ]);
  } finally {
    if (previousRootDomain === undefined) {
      delete process.env.ROOT_DOMAIN;
    } else {
      process.env.ROOT_DOMAIN = previousRootDomain;
    }
    if (previousCnameTarget === undefined) {
      delete process.env.CUSTOM_DOMAIN_CNAME_TARGET;
    } else {
      process.env.CUSTOM_DOMAIN_CNAME_TARGET = previousCnameTarget;
    }
  }
});

test("root domain DNS instructions use the configured server A record for routing", () => {
  const previousIpv4 = process.env.CUSTOM_DOMAIN_IPV4;
  process.env.CUSTOM_DOMAIN_IPV4 = "203.0.113.10";

  try {
    const records = getDomainDnsRecords("example.com", "verify-token");

    assert.equal(records[0].type, "TXT");
    assert.deepEqual(records[1], {
      type: "A",
      host: "example.com",
      value: "203.0.113.10",
      purpose: "routing",
    });
  } finally {
    if (previousIpv4 === undefined) {
      delete process.env.CUSTOM_DOMAIN_IPV4;
    } else {
      process.env.CUSTOM_DOMAIN_IPV4 = previousIpv4;
    }
  }
});

test("DNS instructions default to Vercel routing records", () => {
  const previousIpv4 = process.env.CUSTOM_DOMAIN_IPV4;
  const previousCnameTarget = process.env.CUSTOM_DOMAIN_CNAME_TARGET;
  const previousPublicHost = process.env.PUBLIC_APP_HOST;
  delete process.env.CUSTOM_DOMAIN_IPV4;
  delete process.env.CUSTOM_DOMAIN_CNAME_TARGET;
  delete process.env.PUBLIC_APP_HOST;

  try {
    assert.deepEqual(getDomainDnsRecords("uthiram.in", "verify-token"), [
      {
        type: "TXT",
        host: "_lims-verify.uthiram.in",
        value: "verify-token",
        purpose: "ownership",
      },
      {
        type: "A",
        host: "uthiram.in",
        value: "76.76.21.21",
        purpose: "routing",
      },
    ]);

    assert.deepEqual(getDomainDnsRecords("www.uthiram.in", "verify-token")[1], {
      type: "CNAME",
      host: "www.uthiram.in",
      value: "cname.vercel-dns.com",
      purpose: "routing",
    });
  } finally {
    if (previousIpv4 === undefined) {
      delete process.env.CUSTOM_DOMAIN_IPV4;
    } else {
      process.env.CUSTOM_DOMAIN_IPV4 = previousIpv4;
    }
    if (previousCnameTarget === undefined) {
      delete process.env.CUSTOM_DOMAIN_CNAME_TARGET;
    } else {
      process.env.CUSTOM_DOMAIN_CNAME_TARGET = previousCnameTarget;
    }
    if (previousPublicHost === undefined) {
      delete process.env.PUBLIC_APP_HOST;
    } else {
      process.env.PUBLIC_APP_HOST = previousPublicHost;
    }
  }
});

test("custom domain tenant lookup allows DNS verified domains while SSL provisions", () => {
  const tenantCacheSource = fs.readFileSync(
    path.join(process.cwd(), "src/app/lib/tenant-cache.js"),
    "utf8"
  );

  assert.match(tenantCacheSource, /status:\s*\{\s*\$in:\s*\["dns_verified",\s*"ssl_provisioning",\s*"active"\]/);
  assert.match(tenantCacheSource, /dnsVerified:\s*true/);
});
