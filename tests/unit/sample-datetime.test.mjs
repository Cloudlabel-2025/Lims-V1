import assert from "node:assert/strict";
import test from "node:test";
import { parseSampleDateTime } from "../../src/app/utils/sample-datetime.js";
import { getISTNow } from "../../src/app/utils/patient-helpers.js";

test("sample times use IST regardless of the browser or server timezone", () => {
  const originalTimezone = process.env.TZ;
  try {
    for (const timezone of ["UTC", "Asia/Kolkata", "America/New_York"]) {
      process.env.TZ = timezone;
      const receivedAt = parseSampleDateTime("2026-10-17T00:15");
      assert.equal(receivedAt.toISOString(), "2026-10-16T18:45:00.000Z");
      assert.ok(parseSampleDateTime(getISTNow()) <= new Date());
      assert.ok(receivedAt <= new Date("2026-10-16T18:45:30Z"));
      assert.ok(parseSampleDateTime("2026-10-17T00:16") > new Date("2026-10-16T18:45:30Z"));
      assert.ok(parseSampleDateTime("2026-10-17T00:14") < receivedAt);
    }
  } finally {
    if (originalTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimezone;
  }
});

test("sample times preserve explicit offsets and UTC payloads", () => {
  for (const timestamp of ["2026-10-17T12:00+05:30", "2026-10-17T12:00+0530", "2026-10-17T06:30:00.000Z"]) {
    const parsed = parseSampleDateTime(timestamp);
    assert.equal(parsed.toISOString(), "2026-10-17T06:30:00.000Z");
    assert.equal(parseSampleDateTime(parsed.toISOString()).getTime(), parsed.getTime());
  }
});

test("missing and malformed sample times remain invalid", () => {
  for (const timestamp of [undefined, null, "", "   ", "invalid", "2026-13-17T12:00"]) {
    assert.ok(Number.isNaN(parseSampleDateTime(timestamp).getTime()));
  }
});
