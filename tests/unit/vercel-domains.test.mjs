import assert from "node:assert/strict";
import test from "node:test";

import { buildProjectDomainVerifyUrl } from "../../src/app/lib/vercel-domains.js";

test("Vercel verify URL appends verify after the encoded domain segment", () => {
  const previousTeamId = process.env.VERCEL_TEAM_ID;
  process.env.VERCEL_TEAM_ID = "team_123";

  try {
    const url = buildProjectDomainVerifyUrl("project_123", "portal.example.com");

    assert.equal(
      url.toString(),
      "https://api.vercel.com/v9/projects/project_123/domains/portal.example.com/verify?teamId=team_123"
    );
  } finally {
    if (previousTeamId === undefined) {
      delete process.env.VERCEL_TEAM_ID;
    } else {
      process.env.VERCEL_TEAM_ID = previousTeamId;
    }
  }
});

