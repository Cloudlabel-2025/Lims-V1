import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("tenant theme variables also drive the corporate redesign aliases", () => {
  const provider = read("src/app/components/ThemeProvider.js");
  const css = read("src/app/globals.css");

  assert.match(provider, /"--corporate-teal": actionColor/);
  assert.match(provider, /"--corporate-teal-dark": secondary/);
  assert.match(css, /--corporate-teal:\s*var\(--brand-action, var\(--primary\)\)/);
  assert.match(css, /--corporate-teal-dark:\s*var\(--primary-dark\)/);
  assert.doesNotMatch(css, /\.login-brand-panel[^}]*background:\s*#0f766e/);
});

test("patient login and portal load and apply the tenant theme", () => {
  const login = read("src/app/patient/page.js");
  const portal = read("src/app/patient/portal/page.js");
  const themeRoute = read("src/app/api/theme/route.js");

  assert.match(login, /fetch\(`\/api\/theme\?tenantId=/);
  assert.match(login, /buildThemeVariables\(theme\)/);
  assert.match(portal, /applyTheme\(themeRes\.theme\)/);
  assert.match(portal, /themeUrl/);
  assert.match(themeRoute, /readPatientSession\(req\)/);
});

test("tenant-facing theme CSS no longer contains the fixed default brand palette", () => {
  const css = read("src/app/globals.css");
  const tenantCssStart = css.indexOf("/* Tenant application shell and dashboard */");

  assert.notEqual(tenantCssStart, -1);
  const tenantCss = css.slice(tenantCssStart);
  for (const fixedColor of ["#0d9488", "#0f766e", "#14b8a6", "#f0fdfa", "#ccfbf1", "#99f6e4"]) {
    assert.equal(tenantCss.includes(fixedColor), false, `fixed tenant brand color remains: ${fixedColor}`);
  }
});

test("tenant components do not bypass the selected theme with the legacy teal palette", () => {
  const roots = ["src/app/(dashboard)", "src/app/components", "src/app/patient"];
  const excluded = new Set([
    "src/app/(dashboard)/settings/page.js",
    "src/app/components/MarketingPage.js",
    "src/app/components/MarketingPage.module.css",
    "src/app/components/ThemeProvider.js",
  ]);
  const legacyColors = ["#0d9488", "#0f766e", "#115e59", "#14b8a6", "#f0fdfa", "#ccfbf1", "#99f6e4"];
  const failures = [];

  function visit(relativeDirectory) {
    for (const entry of fs.readdirSync(path.join(root, relativeDirectory), { withFileTypes: true })) {
      const relativePath = path.posix.join(relativeDirectory.replaceAll("\\", "/"), entry.name);
      if (entry.isDirectory()) {
        visit(relativePath);
      } else if (/\.(?:js|css)$/.test(entry.name) && !excluded.has(relativePath)) {
        const source = read(relativePath).toLowerCase();
        for (const color of legacyColors) {
          if (source.includes(color)) failures.push(`${relativePath}: ${color}`);
        }
      }
    }
  }

  roots.forEach(visit);
  assert.deepEqual(failures, []);
});
