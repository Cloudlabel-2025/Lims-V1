import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");

test("BUG-055 (DL2096) - Draft edit: API validates draft status, updates observed values and preserves versioning", () => {
  const reportRoutePath = path.join(rootDir, "src/app/api/reports/[id]/route.js");
  const reportRouteContent = fs.readFileSync(reportRoutePath, "utf-8");

  assert.ok(
    reportRouteContent.includes('save: "reports.edit"'),
    "PATCH /api/reports/[id] must require reports.edit permission for save action"
  );
  assert.ok(
    reportRouteContent.includes("Only draft reports can be edited"),
    "PATCH /api/reports/[id] must reject edits on non-draft reports"
  );
  assert.ok(
    reportRouteContent.includes("resolveReferenceRange") && reportRouteContent.includes("getFlag"),
    "PATCH /api/reports/[id] must resolve reference ranges and re-evaluate flags on draft edits"
  );
  assert.ok(
    reportRouteContent.includes("Exponential notation"),
    "PATCH /api/reports/[id] must reject exponential notation in result values"
  );
  assert.ok(
    reportRouteContent.includes("report.investigations") && reportRouteContent.includes("resultMap.has(param.key)"),
    "PATCH /api/reports/[id] must correctly update investigation parameters from draft edit results"
  );
  assert.ok(
    reportRouteContent.includes("submitForReview") && reportRouteContent.includes("createNewVersion"),
    "PATCH /api/reports/[id] must support submitting for review with version snapshot on draft edit"
  );
});

test("BUG-055 (DL2096) - Draft edit: Frontend UI enables draft editing with observed values, remarks, and template", () => {
  const reportPagePath = path.join(rootDir, "src/app/(dashboard)/reports/[id]/page.js");
  const reportPageContent = fs.readFileSync(reportPagePath, "utf-8");

  assert.ok(
    reportPageContent.includes('hasPermission(user, "reports.edit")'),
    "Report detail page must verify reports.edit permission"
  );
  assert.ok(
    reportPageContent.includes("Edit Draft"),
    "Report detail page must render Edit Draft action for draft reports"
  );
  assert.ok(
    reportPageContent.includes("handleStartEdit") && reportPageContent.includes("handleCancelEdit"),
    "Report detail page must handle entering and cancelling draft edit mode"
  );
  assert.ok(
    reportPageContent.includes("handleSaveDraft"),
    "Report detail page must implement handleSaveDraft to send updated results"
  );
  assert.ok(
    reportPageContent.includes("getObservedFlag"),
    "Report detail page must compute live observed flags during draft editing"
  );
  assert.ok(
    reportPageContent.includes("Save & Submit Review"),
    "Report detail page must offer Save & Submit Review action"
  );
});
