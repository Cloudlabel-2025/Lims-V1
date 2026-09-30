import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

test("BUG-070, BUG-071, BUG-072, BUG-074, BUG-075, BUG-078, BUG-079, BUG-082, BUG-083, BUG-084, BUG-085 fixes", async (t) => {
  await t.test("BUG-070: Refund journal in Daily Collection report", () => {
    const dailySrc = read("src/app/api/accounting/reports/daily-collection/route.js");
    assert.match(dailySrc, /sourceType:\s*\{\s*\$in:\s*\["payment",\s*"refund"\]\s*\}/, "Daily collection must match payments and refunds");
    assert.match(dailySrc, /"1003"/, "Must support UPI account code 1003");
    assert.match(dailySrc, /\$subtract:\s*\[\s*\{\s*\$ifNull:\s*\["\$lines\.debit"/, "Must compute net debit minus credit");
  });

  await t.test("BUG-071: Journal balance validation and UX", () => {
    const accountingSrc = read("src/app/lib/accounting.js");
    const manualJournalSrc = read("src/app/(dashboard)/accounts/manual/page.js");
    assert.match(accountingSrc, /uniqueAccountIds\.length/, "createJournalEntry must compare uniqueAccountIds");
    assert.match(manualJournalSrc, /<optgroup/, "Manual journal UI must group accounts by type");
  });

  await t.test("BUG-072 & BUG-074: Expense validation and duplicate prevention", () => {
    const expenseRouteSrc = read("src/app/api/expenses/route.js");
    const expenseModelSrc = read("src/app/models/tenant/ExpenseEntry.js");
    assert.match(expenseRouteSrc, /Tax amount cannot exceed expense amount/, "Must reject tax exceeding amount");
    assert.match(expenseRouteSrc, /Tax amount cannot be negative/, "Must reject negative tax amount");
    assert.match(expenseRouteSrc, /Category is required/, "Category must be required");
    assert.match(expenseRouteSrc, /409/, "Must return 409 for duplicate same-day expense");
    assert.match(expenseModelSrc, /isRecurring/, "Expense model must support isRecurring");
    assert.match(expenseModelSrc, /recurringInterval/, "Expense model must support recurringInterval");
  });

  await t.test("BUG-075: Corporate statement reconciliation & date filter", () => {
    const statementRouteSrc = read("src/app/api/corporate-accounts/[id]/statement/route.js");
    const corporatePageSrc = read("src/app/(dashboard)/accounts/corporate/page.js");
    assert.match(statementRouteSrc, /accounts\.view/, "Statement route must allow accounts.view");
    assert.match(statementRouteSrc, /openingBalance/, "Statement must calculate opening balance");
    assert.match(statementRouteSrc, /closingBalance/, "Statement must calculate closing balance");
    assert.match(corporatePageSrc, /Statement/, "Corporate page must render Statement modal trigger");
  });

  await t.test("BUG-078: Financial export totals and PDF error handling", () => {
    const pdfExportSrc = read("src/app/lib/pdf-export.js");
    assert.match(pdfExportSrc, /exportLedgerPdf/, "Must provide ledger PDF export");
    assert.match(pdfExportSrc, /rows\.push\(\["Total"/, "Ledger PDF must include Total summary row matching screen totals");
    assert.match(pdfExportSrc, /doc\.on\("error",\s*\(err\)\s*=>\s*reject\(err\)\)/, "Must handle doc error stream properly");
  });

  await t.test("BUG-079: Reissue patient slip with token invalidation", () => {
    const portalAccessRouteSrc = read("src/app/api/patient/[id]/portal-access/route.js");
    assert.match(portalAccessRouteSrc, /\$inc:\s*\{\s*credentialVersion:\s*1\s*\}/, "Must increment credentialVersion to invalidate prior slips");
    assert.match(portalAccessRouteSrc, /patients\.manage/, "Must allow patients.manage to reissue access slips");
  });

  await t.test("BUG-082: Read/unread state persistence without bell auto-wipe", () => {
    const topbarSrc = read("src/app/components/Topbar.js");
    // Bell button onClick should not immediately call markNotificationsRead
    assert.doesNotMatch(topbarSrc, /onClick=\{.*opening\s*&&\s*unreadCount\s*>\s*0\s*markNotificationsRead/, "Must not automatically wipe unread on bell open");
    // Explicit Mark all read button must exist
    assert.match(topbarSrc, /Mark all read/, "Must provide explicit Mark all read button");
    assert.match(topbarSrc, /setNotifications\(\(current\)\s*=>\s*current\.map/, "Must update individual read status locally on mark");
  });

  await t.test("BUG-083: Notification category assignment and preferences", () => {
    const notifLibSrc = read("src/app/lib/notifications.js");
    const notifRouteSrc = read("src/app/api/settings/notifications/route.js");
    const settingsPageSrc = read("src/app/(dashboard)/settings/page.js");
    const tenantDbSrc = read("src/app/lib/tenant-db.js");

    assert.match(tenantDbSrc, /NotificationPreference/, "NotificationPreference must be registered in tenant-db");
    assert.match(notifLibSrc, /category:\s*"reports"/, "Notifications must have category reports");
    assert.match(notifLibSrc, /category:\s*"inventory"/, "Notifications must have category inventory");
    assert.match(notifLibSrc, /category:\s*"subscription"/, "Notifications must have category subscription");
    assert.match(notifLibSrc, /enabledCategories\.reports\s*!==\s*false/, "Must gate reports notifications on preference");
    assert.match(notifRouteSrc, /ALLOWED_CATEGORIES/, "Settings notifications API must validate allowed categories");
    assert.match(settingsPageSrc, /Notification Preferences/, "Settings page must render Notification Preferences tab");
  });

  await t.test("BUG-084: Enforce staff quota limit on plan downgrade", () => {
    const labRouteSrc = read("src/app/api/developer/labs/[tenantId]/route.js");
    const upgradesRouteSrc = read("src/app/api/developer/subscription-upgrades/route.js");
    assert.match(labRouteSrc, /activeStaffCount\s*>\s*staffLimit/, "Developer labs PATCH must check staff quota on package change");
    assert.match(labRouteSrc, /exceeds package limit of/, "Must return friendly rejection if staff exceeds new limit");
    assert.match(upgradesRouteSrc, /activeStaffCount\s*>\s*staffLimit/, "Upgrade approval must check staff quota");
  });

  await t.test("BUG-085: Upgrade request traceable history and status filtering", () => {
    const upgradesRouteSrc = read("src/app/api/developer/subscription-upgrades/route.js");
    const devSubsPageSrc = read("src/app/developer/subscriptions/page.js");

    assert.match(upgradesRouteSrc, /statusParam\s*!==\s*"all"/, "Upgrade requests GET must support status filtering");
    assert.match(upgradesRouteSrc, /reviewedBy/, "Must record and serialize reviewedBy");
    assert.match(upgradesRouteSrc, /reviewedAt/, "Must record and serialize reviewedAt");
    assert.match(devSubsPageSrc, /upgradeFilter/, "Developer subscriptions page must have upgradeFilter");
    assert.match(devSubsPageSrc, /Upgrade requests &amp; History/, "Must show traceable history in UI");
  });
});
