import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

test("BUG-009, BUG-033, BUG-034: Billing & Payments workflow fixes", async (t) => {
  const receiptsRouteSrc = read("src/app/api/billing/[id]/receipts/route.js");
  const paymentModalSrc = read("src/app/(dashboard)/billing/PaymentHistoryModal.js");
  const billingByIdRouteSrc = read("src/app/api/billing/[id]/route.js");
  const revertRouteSrc = read("src/app/api/billing/[id]/revert/route.js");
  const billingPageSrc = read("src/app/(dashboard)/billing/page.js");

  await t.test("BUG-009: Pending amount calculation in receipts route and payment modal", () => {
    // 1. receipts route must compute chronological running totals and return balanceDue & totalPaid
    assert.match(
      receiptsRouteSrc,
      /chronological\s*=\s*\[\.\.\.receipts\]\.reverse\(\)/,
      "receipts route must process chronological receipts for running totals"
    );
    assert.match(
      receiptsRouteSrc,
      /totalPaid\s*=\s*receipts\s*\.filter\(\(r\)\s*=>\s*!r\.isRefunded\)/,
      "receipts route must compute totalPaid summing non-refunded receipts"
    );
    assert.match(
      receiptsRouteSrc,
      /balanceDue\s*=\s*isPaid\s*\?\s*0\s*:/,
      "receipts route must enforce balanceDue === 0 when bill is paid"
    );
    assert.match(
      receiptsRouteSrc,
      /totalPaid:\s*isPaid\s*\?\s*Math\.max\(totalPaid,\s*Number\(billingRecord\.totalAmount/,
      "receipts route must return full paid amount on billSummary when bill is paid"
    );

    // 2. PaymentHistoryModal must guarantee remaining is 0 when bill is paid
    assert.match(
      paymentModalSrc,
      /isPaid\s*=\s*bill\?\.billingStatus\s*===\s*"paid"/,
      "PaymentHistoryModal must check if bill is paid"
    );
    assert.match(
      paymentModalSrc,
      /remaining\s*=\s*isPaid\s*\?\s*0\s*:/,
      "PaymentHistoryModal must enforce remaining === 0 when bill is paid"
    );
  });

  await t.test("BUG-033: Cancellation reason must be required in API and UI", () => {
    // 1. API route validates cancellation reason
    assert.match(
      billingByIdRouteSrc,
      /const\s+reason\s*=\s*String\(body\.reason\s*\|\|\s*""\)\.trim\(\)/,
      "PATCH /api/billing/:id must extract and trim cancellation reason"
    );
    assert.match(
      billingByIdRouteSrc,
      /if\s*\(!reason\)\s*\{\s*return\s+Response\.json\(\{\s*error:\s*"Cancellation reason is required"/,
      "PATCH /api/billing/:id must reject missing cancellation reason with 400"
    );
    assert.match(
      billingByIdRouteSrc,
      /billingRecord\.cancellationReason\s*=\s*reason;/,
      "PATCH /api/billing/:id must save the non-empty cancellation reason"
    );

    // 2. Billing UI provides cancellation textarea and requires reason
    assert.match(
      billingPageSrc,
      /cancelReason,\s*setCancelReason/,
      "BillingPage must maintain cancelReason state"
    );
    assert.match(
      billingPageSrc,
      /placeholder="Enter reason for cancelling this bill \(required\)"/,
      "showCancelConfirm modal must have a required cancellation textarea"
    );
    assert.match(
      billingPageSrc,
      /disabled=\{closing\s*\|\|\s*!cancelReason\.trim\(\)\}/,
      "Cancel bill confirm button must be disabled when cancelReason is empty"
    );
    assert.match(
      billingPageSrc,
      /body:\s*JSON\.stringify\(\{\s*action:\s*"cancel",\s*reason:\s*trimmedReason\s*\}\)/,
      "confirmCancelBill must send trimmed reason in request body"
    );
  });

  await t.test("BUG-034: Revert / refund reason must be required in API and UI", () => {
    // 1. Revert API route validates non-empty reason
    assert.match(
      revertRouteSrc,
      /const\s+reason\s*=\s*String\(body\.reason\s*\|\|\s*""\)\.trim\(\)\.slice\(0,\s*150\);/,
      "POST /api/billing/:id/revert must extract and trim revert reason"
    );
    assert.match(
      revertRouteSrc,
      /if\s*\(!reason\)\s*\{\s*return\s+Response\.json\(\{\s*error:\s*"Revert reason is required"/,
      "POST /api/billing/:id/revert must reject empty revert reason with 400"
    );

    // 2. Billing UI requires revert reason
    assert.match(
      billingPageSrc,
      /placeholder="Why is this bill being reverted\? \(required\)"/,
      "showRevertConfirm modal must indicate revert reason is required"
    );
    assert.match(
      billingPageSrc,
      /disabled=\{closing\s*\|\|\s*!revertReason\.trim\(\)\}/,
      "Revert bill confirm button must be disabled when revertReason is empty"
    );
    assert.match(
      billingPageSrc,
      /if\s*\(!trimmedReason\)\s*\{\s*setError\("Revert reason is required\."\);\s*return;\s*\}/,
      "confirmRevertBill must validate non-empty revert reason before sending"
    );
  });
});
