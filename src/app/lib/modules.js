export const availableLabModules = [
  {
    id: "dashboard",
    label: "Dashboard",
    permission: "dashboard.view",
    href: "/dashboard",
  },
  {
    id: "doctors",
    label: "Doctors",
    permission: "doctors.view",
    href: "/doctors",
  },
  {
    id: "patients",
    label: "Patients",
    permission: "patients.view",
    href: "/patients",
  },
  {
    id: "tests",
    label: "Test Master",
    permission: "tests.view",
    href: "/tests",
  },
  {
    id: "billing",
    label: "Billing",
    permission: "billing.view",
    href: "/billing",
  },
  {
    id: "samples",
    label: "Samples",
    permission: "samples.view",
    href: "/samples",
  },
  {
    id: "reports",
    label: "Reports",
    permission: "reports.view",
    href: "/reports",
  },
  {
    id: "analytics",
    label: "Analytics",
    permission: "analytics.view",
    href: "/analytics",
  },
  {
    id: "accounts",
    label: "Accounts",
    permission: "accounts.view",
    href: "/accounts",
  },
  {
    id: "inventory",
    label: "Inventory",
    permission: "inventory.view",
    href: "/inventory",
  },
  {
    id: "quality",
    label: "Quality Control",
    permission: "quality.view",
    href: "/quality",
  },
];

export const defaultLabModules = [
  "dashboard",
  "patients",
  "doctors",
  "tests",
  "billing",
  "samples",
  "reports",
  "accounts",
  "inventory",
];

export function normalizeEnabledModules(value) {
  const allowed = new Set(availableLabModules.map((module) => module.id));
  const modules = Array.isArray(value) ? value : defaultLabModules;
  const normalized = modules.filter((module) => allowed.has(module));

  return normalized.includes("dashboard")
    ? [...new Set(normalized)]
    : ["dashboard", ...new Set(normalized)];
}
