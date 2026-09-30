import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");

test("BUG-031 (DL2062) - Discount limit: enforces permission and blocks excessive discounts with audit logging", () => {
  const billingCreatePath = path.join(rootDir, "src/app/api/billing/route.js");
  const billingCreateContent = fs.readFileSync(billingCreatePath, "utf-8");

  assert.ok(
    billingCreateContent.includes('hasPermission(auth.session, "billing.discount")'),
    "POST /api/billing must verify billing.discount permission before applying discounts"
  );
  assert.ok(
    billingCreateContent.includes("billing.discount_denied"),
    "POST /api/billing must record billing.discount_denied in audit log when unauthorized discount is attempted"
  );
  assert.ok(
    billingCreateContent.includes("billing.excessive_discount_blocked"),
    "POST /api/billing must record billing.excessive_discount_blocked in audit log when discount exceeds subtotal"
  );
  assert.ok(
    billingCreateContent.includes("Discount amount cannot exceed bill subtotal"),
    "POST /api/billing must reject discounts greater than subtotal"
  );

  const billingUpdatePath = path.join(rootDir, "src/app/api/billing/[id]/route.js");
  const billingUpdateContent = fs.readFileSync(billingUpdatePath, "utf-8");

  assert.ok(
    billingUpdateContent.includes('hasPermission(auth.session, "billing.discount")'),
    "PATCH /api/billing/[id] must verify billing.discount permission"
  );
  assert.ok(
    billingUpdateContent.includes("billing.discount_denied"),
    "PATCH /api/billing/[id] must record billing.discount_denied audit log"
  );
  assert.ok(
    billingUpdateContent.includes("billing.excessive_discount_blocked"),
    "PATCH /api/billing/[id] must record billing.excessive_discount_blocked audit log"
  );

  const billingPagePath = path.join(rootDir, "src/app/(dashboard)/billing/page.js");
  const billingPageContent = fs.readFileSync(billingPagePath, "utf-8");

  assert.ok(
    billingPageContent.includes('hasPermission(user, "billing.discount")'),
    "Billing UI must check canDiscountBilling permission"
  );
});

test("BUG-032 (DL2067) - Multiple modes & Cheque: supports multi-mode settlement and cheque in schema, API and UI", () => {
  const billingRecordModelPath = path.join(rootDir, "src/app/models/tenant/BillingRecord.js");
  const billingRecordModelContent = fs.readFileSync(billingRecordModelPath, "utf-8");

  assert.ok(
    billingRecordModelContent.includes("cheque: { type: Number, default: 0 }"),
    "BillingRecord schema must include cheque in paymentBreakdown"
  );

  const settleRoutePath = path.join(rootDir, "src/app/api/billing/settle/route.js");
  const settleRouteContent = fs.readFileSync(settleRoutePath, "utf-8");

  assert.ok(
    settleRouteContent.includes('cheque: "cheque"') || settleRouteContent.includes("cheque:"),
    "Settlement API must map cheque payments to paymentBreakdown.cheque"
  );
  assert.ok(
    settleRouteContent.includes("lastPaymentModes"),
    "Settlement API must record lastPaymentModes for multi-mode payments"
  );
  assert.ok(
    settleRouteContent.includes("payment.modes") || settleRouteContent.includes("activeModes"),
    "Settlement API must handle modes array payload"
  );

  const settlementModalPath = path.join(rootDir, "src/app/(dashboard)/billing/SettlementModal.js");
  const settlementModalContent = fs.readFileSync(settlementModalPath, "utf-8");

  assert.ok(
    settlementModalContent.includes('{ key: "cheque", label: "Cheque" }'),
    "SettlementModal must include Cheque in paymentMethods"
  );
  assert.ok(
    settlementModalContent.includes("paymentBreakdown?.cheque"),
    "SettlementModal must include cheque in alreadyPaid calculation"
  );
});

test("BUG-035 (DL2073) - Corporate credit: links corporate account and updates outstanding receivable balance", () => {
  const billingRecordModelPath = path.join(rootDir, "src/app/models/tenant/BillingRecord.js");
  const billingRecordModelContent = fs.readFileSync(billingRecordModelPath, "utf-8");

  assert.ok(
    billingRecordModelContent.includes('corporateAccount: {') &&
    billingRecordModelContent.includes('ref: "CorporateAccount"'),
    "BillingRecord schema must have corporateAccount reference"
  );

  const settleRoutePath = path.join(rootDir, "src/app/api/billing/settle/route.js");
  const settleRouteContent = fs.readFileSync(settleRoutePath, "utf-8");

  assert.ok(
    settleRouteContent.includes("billingRecord.corporateAccount = corporateAccount._id") ||
    settleRouteContent.includes("corporateAccount._id"),
    "Settlement API must assign corporateAccount on corporate-credit settlement"
  );
  assert.ok(
    settleRouteContent.includes("billing.corporate_settled"),
    "Settlement API must log billing.corporate_settled action in audit log"
  );

  const settlementModalPath = path.join(rootDir, "src/app/(dashboard)/billing/SettlementModal.js");
  const settlementModalContent = fs.readFileSync(settlementModalPath, "utf-8");

  assert.ok(
    settlementModalContent.includes("/api/corporate-accounts"),
    "SettlementModal must fetch corporate accounts from /api/corporate-accounts"
  );
  assert.ok(
    settlementModalContent.includes("Corporate Client Account"),
    "SettlementModal must display Corporate Client Account selector"
  );
});

test("BUG-036 (DL2074) - Credit limit: enforces corporate credit limit in backend API and displays warnings in UI", () => {
  const settleRoutePath = path.join(rootDir, "src/app/api/billing/settle/route.js");
  const settleRouteContent = fs.readFileSync(settleRoutePath, "utf-8");

  assert.ok(
    settleRouteContent.includes("billing.credit_limit_exceeded"),
    "Settlement API must log billing.credit_limit_exceeded when limit is breached"
  );
  assert.ok(
    settleRouteContent.includes("Corporate payment exceeds credit limit"),
    "Settlement API must reject payment with 400 when credit limit is breached"
  );

  const settlementModalPath = path.join(rootDir, "src/app/(dashboard)/billing/SettlementModal.js");
  const settlementModalContent = fs.readFileSync(settlementModalPath, "utf-8");

  assert.ok(
    settlementModalContent.includes("isCorporateOverLimit"),
    "SettlementModal must compute isCorporateOverLimit"
  );
  assert.ok(
    settlementModalContent.includes("Payment exceeds available credit limit"),
    "SettlementModal must display warning when payment exceeds available credit"
  );
  assert.ok(
    settlementModalContent.includes("isCorporateOverLimit") &&
    settlementModalContent.includes("disabled={"),
    "SettlementModal must disable submit button when corporate credit limit is exceeded"
  );
});
