import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");
const appDir = path.join(rootDir, "src", "app");

const criticalPages = [
  "page.js",
  "forgot-password/page.js",
  "reset-password/page.js",
  "onboarding/page.js",
  "(dashboard)/dashboard/page.js",
  "(dashboard)/patients/page.js",
  "(dashboard)/patients/register/page.js",
  "(dashboard)/patients/edit/[id]/page.js",
  "(dashboard)/doctors/page.js",
  "(dashboard)/doctors/register/page.js",
  "(dashboard)/doctors/edit/[id]/page.js",
  "(dashboard)/billing/page.js",
  "(dashboard)/accounts/page.js",
  "(dashboard)/reports/page.js",
  "(dashboard)/samples/page.js",
  "(dashboard)/inventory/page.js",
  "(dashboard)/quality/page.js",
  "(dashboard)/settings/page.js",
  "(dashboard)/tests/page.js",
  "(dashboard)/analytics/page.js",
  "(dashboard)/audit/page.js",
  "developer/dashboard/page.js",
  "developer/labs/page.js",
  "developer/labs/create/page.js",
  "developer/labs/[id]/edit/page.js",
  "developer/defaults/page.js",
  "developer/modules/page.js",
  "developer/system/page.js",
];

const criticalApiMethods = {
  "api/auth/login/route.js": ["POST"],
  "api/auth/logout/route.js": ["POST"],
  "api/auth/me/route.js": ["GET"],
  "api/patient/route.js": ["GET", "POST"],
  "api/patient/[id]/route.js": ["GET", "PUT"],
  "api/doctor/route.js": ["GET", "POST"],
  "api/doctor/[id]/route.js": ["GET", "PUT"],
  "api/billing/route.js": ["GET", "POST"],
  "api/billing/[id]/route.js": ["GET"],
  "api/billing/settle/route.js": ["POST"],
  "api/accounting/accounts/route.js": ["GET", "POST"],
  "api/accounting/accounts/[id]/route.js": ["DELETE"],
  "api/accounting/journal-entries/route.js": ["GET"],
  "api/accounting/pl/route.js": ["GET"],
  "api/expenses/route.js": ["GET", "POST"],
  "api/reports/route.js": ["GET", "POST"],
  "api/reports/[id]/route.js": ["GET", "PATCH"],
  "api/samples/route.js": ["GET"],
  "api/samples/[id]/route.js": ["PUT"],
  "api/inventory/route.js": ["GET", "POST"],
  "api/inventory/[id]/route.js": ["PATCH"],
  "api/quality/route.js": ["GET", "POST"],
  "api/settings/users/route.js": ["GET", "POST"],
  "api/settings/roles/route.js": ["GET", "PATCH", "DELETE"],
  "api/tests/categories/route.js": ["GET", "POST"],
  "api/tests/definitions/route.js": ["GET", "POST"],
  "api/tests/definitions/[id]/route.js": ["GET", "PUT"],
  "api/tests/packages/route.js": ["GET", "POST"],
};

const criticalModels = [
  "models/tenant/Patient.js",
  "models/tenant/Doctor.js",
  "models/tenant/BillingRecord.js",
  "models/tenant/JournalEntry.js",
  "models/tenant/Account.js",
  "models/tenant/ExpenseEntry.js",
  "models/tenant/Sample.js",
  "models/tenant/TestReport.js",
  "models/tenant/TestDefinition.js",
  "models/tenant/TestPackage.js",
  "models/tenant/InventoryItem.js",
  "models/tenant/QcLog.js",
  "models/tenant/User.js",
  "models/tenant/Role.js",
  "models/master/Lab.js",
  "models/master/DeveloperUser.js",
];

const requiredPackageScripts = ["dev", "build", "start", "lint", "test"];
const requiredDependencies = [
  "next",
  "react",
  "react-dom",
  "mongoose",
  "bootstrap",
  "cloudinary",
];

function readAppFile(relativePath) {
  return fs.readFileSync(path.join(appDir, relativePath), "utf8");
}

function listFiles(dir, predicate) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(fullPath, predicate);
    return predicate(fullPath) ? [fullPath] : [];
  });
}

test("package.json exposes the scripts and dependencies needed to verify the app", () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(rootDir, "package.json"), "utf8")
  );

  for (const script of requiredPackageScripts) {
    assert.ok(packageJson.scripts?.[script], `Missing script: ${script}`);
  }

  for (const dependency of requiredDependencies) {
    assert.ok(
      packageJson.dependencies?.[dependency],
      `Missing dependency: ${dependency}`
    );
  }
});

test("critical app pages exist and export default page components", () => {
  for (const page of criticalPages) {
    const source = readAppFile(page);
    assert.match(source, /export\s+default/, `${page} must export a page`);
  }
});

test("every API route exports at least one valid HTTP handler", () => {
  const routeFiles = listFiles(path.join(appDir, "api"), (file) =>
    file.endsWith(`${path.sep}route.js`)
  );

  assert.ok(routeFiles.length > 0, "No API route files found");

  for (const file of routeFiles) {
    const source = fs.readFileSync(file, "utf8");
    const relativePath = path.relative(appDir, file);

    assert.match(
      source,
      /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(/,
      `${relativePath} must export at least one HTTP handler`
    );
  }
});

test("critical API routes expose the expected HTTP methods", () => {
  for (const [route, methods] of Object.entries(criticalApiMethods)) {
    const source = readAppFile(route);

    for (const method of methods) {
      assert.match(
        source,
        new RegExp(`export\\s+async\\s+function\\s+${method}\\s*\\(`),
        `${route} must export ${method}`
      );
    }
  }
});

test("critical data models exist and define mongoose models", () => {
  for (const model of criticalModels) {
    const source = readAppFile(model);
    assert.match(source, /mongoose|Schema/, `${model} should define a schema`);
    assert.match(
      source,
      /models\.|model\(/,
      `${model} should export or register a mongoose model`
    );
  }
});

test("dashboard route modules keep their expected child components", () => {
  const componentFiles = [
    "(dashboard)/billing/CreateBillTab.js",
    "(dashboard)/billing/BillingHistoryTab.js",
    "(dashboard)/billing/SettlementModal.js",
    "(dashboard)/patients/PatientTable.js",
    "(dashboard)/patients/PatientGrid.js",
    "(dashboard)/reports/ReportEntryPanel.js",
    "(dashboard)/reports/ReportList.js",
    "(dashboard)/inventory/InventoryTable.js",
    "(dashboard)/settings/UserManager.js",
    "(dashboard)/settings/RoleManager.js",
    "components/Sidebar.js",
    "components/Topbar.js",
    "lib/modules.js",
    "lib/client-rbac.js",
  ];

  for (const component of componentFiles) {
    const source = readAppFile(component);
    assert.match(
      source,
      /export\s+default|export\s+function|export\s+const/,
      `${component} should export a component`
    );
  }
});
