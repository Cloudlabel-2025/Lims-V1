import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function source(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

test("billing creates one sample containing every bill investigation", () => {
  const billingRoute = source("src/app/api/billing/route.js");

  assert.match(billingRoute, /const \[createdSample\] = await Sample\.create/);
  assert.match(billingRoute, /investigations:\s*createdBillingRecord\.items\.map/);
  assert.doesNotMatch(billingRoute, /Sample\.create\(\s*createdBillingRecord\.items\.map/);
});

test("sample completion creates one grouped report for the sample", () => {
  const sampleRoute = source("src/app/api/samples/[id]/route.js");
  const sampleModel = source("src/app/models/tenant/Sample.js");
  const reportModel = source("src/app/models/tenant/TestReport.js");

  assert.match(sampleModel, /investigations:\s*\{\s*type:\s*\[SampleInvestigationSchema\]/);
  assert.match(reportModel, /investigations:\s*\{\s*type:\s*\[ReportInvestigationSchema\]/);
  assert.match(sampleRoute, /const existingReport = await TestReport\.findOne\(\{ sample: sample\._id \}\)/);
  assert.match(sampleRoute, /investigations:\s*reportInvestigations/);
});

test("sample and report screens expose all grouped investigations", () => {
  const wizard = source("src/app/(dashboard)/samples/wizard/page.js");
  const sampleList = source("src/app/(dashboard)/samples/page.js");
  const reportList = source("src/app/(dashboard)/reports/ReportList.js");
  const reportDetail = source("src/app/(dashboard)/reports/[id]/page.js");

  assert.match(wizard, /loadedSample\.investigations\.map/);
  assert.match(sampleList, /investigationNames\.join/);
  assert.match(reportList, /function getInvestigations/);
  assert.match(reportDetail, /reportInvestigations\.map/);
});

test("grouped result submission identifies every investigation explicitly", () => {
  const wizard = source("src/app/(dashboard)/samples/wizard/page.js");
  const sampleRoute = source("src/app/api/samples/[id]/route.js");

  assert.match(wizard, /investigationResults:\s*testDefs\.map/);
  assert.match(wizard, /investigationId:\s*String\(testDef\.investigationKey\)/);
  assert.match(sampleRoute, /submittedInvestigations\.find/);
  assert.match(sampleRoute, /submittedInvestigation\?\.values/);
  assert.match(sampleRoute, /value === null \|\| value === undefined/);
});
