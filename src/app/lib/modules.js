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
];

export const defaultLabModules = [
  "dashboard",
  "patients",
  "doctors",
  "tests",
  "billing",
  "samples",
  "reports",
  "analytics",
  "accounts",
  "inventory",
];

export const tenantModuleGroups = [
  {
    id: "operations",
    label: "Lab Operations",
    items: ["dashboard", "patients", "doctors", "tests", "samples", "reports"],
  },
  {
    id: "finance",
    label: "Finance",
    items: ["billing", "accounts", "inventory", "analytics"],
  },
];

export const tenantAdminItems = [
  {
    id: "users",
    label: "Users",
    href: "/settings",
    permissionAny: ["settings.users.view", "settings.roles.view"],
  },
  {
    id: "roles",
    label: "Roles",
    href: "/settings",
    permissionAny: ["settings.roles.view"],
  },
  {
    id: "audit",
    label: "Audit",
    href: "/audit",
    permissionAny: ["audit.view"],
  },
];

export const topbarSearchScopes = [
  {
    id: "patients",
    label: "Patients",
    endpoint: "/api/patient",
    permission: "patients.view",
    fields: ["name", "phone", "uhId"],
  },
  {
    id: "doctors",
    label: "Doctors",
    endpoint: "/api/doctor",
    permission: "doctors.view",
    fields: ["name", "phone", "doctorId", "mciNumber", "speciality"],
  },
  {
    id: "tests",
    label: "Tests",
    endpoint: "/api/tests/definitions",
    permission: "tests.view",
    fields: ["name", "code", "category"],
  },
  {
    id: "samples",
    label: "Samples",
    endpoint: "/api/samples",
    permission: "samples.view",
    fields: ["sampleId", "patientName", "status"],
  },
  {
    id: "reports",
    label: "Reports",
    endpoint: "/api/reports",
    permission: "reports.view",
    fields: ["reportId", "patientName", "status"],
  },
];

export const notificationRules = [
  {
    id: "inactive-doctors",
    label: "Inactive or on-leave doctors",
    href: "/doctors",
    priority: "high",
    permissionAny: ["doctors.view"],
  },
  {
    id: "sample-stock-out",
    label: "Sample collection inventory low",
    href: "/samples",
    priority: "critical",
    permissionAny: ["samples.view", "inventory.view"],
  },
  {
    id: "pending-reports",
    label: "Pending report verification",
    href: "/reports",
    priority: "normal",
    permissionAny: ["reports.view"],
  },
];

export const tenantActionPermissions = {
  samples: ["samples.collect", "samples.reject", "samples.view"],
  reports: ["reports.verify", "reports.release", "reports.view", "reports.edit"],
  billing: ["billing.collect", "billing.refund", "billing.view"],
  doctors: ["doctors.register", "doctors.edit", "doctors.delete"],
  patients: ["patients.register", "patients.edit", "patients.delete"],
};

export function normalizeEnabledModules(value) {
  const allowed = new Set(availableLabModules.map((module) => module.id));
  const modules = Array.isArray(value) ? value : defaultLabModules;
  const normalized = modules.filter((module) => allowed.has(module));

  return normalized.includes("dashboard")
    ? [...new Set(normalized)]
    : ["dashboard", ...new Set(normalized)];
}
