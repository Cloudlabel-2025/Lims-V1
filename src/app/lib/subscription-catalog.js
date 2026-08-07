import { availableLabModules, defaultLabModules, normalizeEnabledModules } from "./modules.js";

const moduleDependencies = {
  billing: ["patients", "tests"],
  samples: ["patients", "tests"],
  reports: ["patients", "tests", "samples"],
  accounts: ["billing"],
  analytics: ["dashboard"],
};

export const SUBSCRIPTION_STATUS = [
  "trialing",
  "active",
  "past_due",
  "grace_period",
  "paused",
  "expired",
  "cancelled",
];

export const ENFORCEMENT_MODES = ["off", "shadow", "hard"];

export const QUOTA_KEYS = {
  patientRegistrations: "patientRegistrations",
  billingRecords: "billingRecords",
  staffUsers: "staffUsers",
};

export const entitlementCatalog = {
  features: [
    "patient-portal",
    "doctor-portal",
    "corporate-accounts",
    "doctor-commissions",
    "refunds",
    "excel-export",
    "pdf-export",
    "advanced-analytics",
    "custom-branding",
    "digital-signatures",
    "inventory-import-export",
    "record-deletion",
    "record-deletion:5min",
    "record-deletion:all",
    "record-deletion:patients",
    "record-deletion:accounts",
    "record-deletion:doctors",
    "record-deletion:billing",
    "record-deletion:reports",
    "record-deletion:samples",
    "record-deletion:tests",
  ],
  quotas: [
    {
      key: QUOTA_KEYS.patientRegistrations,
      label: "Patient registrations",
      unit: "registrations",
      resetFrequency: "calendar-month",
      addOnsAllowed: true,
    },
    {
      key: QUOTA_KEYS.billingRecords,
      label: "Confirmed bills",
      unit: "bills",
      resetFrequency: "calendar-month",
      addOnsAllowed: true,
    },
    {
      key: QUOTA_KEYS.staffUsers,
      label: "Active staff users",
      unit: "users",
      resetFrequency: "none",
      addOnsAllowed: false,
    },
  ],
};

export const defaultSubscriptionPackages = [
  {
    key: "basic",
    name: "Basic",
    releaseVersion: "1.0",
    description: "Core laboratory workflows for smaller diagnostic labs.",
    modules: ["dashboard", "patients", "doctors", "tests", "billing", "samples", "reports"],
    features: ["pdf-export"],
    quotas: { patientRegistrations: 250, billingRecords: 500, staffUsers: 5 },
    pricing: { currency: "INR", monthlyAmountMinor: null, annualAmountMinor: null },
  },
  {
    key: "standard",
    name: "Standard",
    releaseVersion: "1.0",
    description: "Operational, financial, inventory, portal, and analytics workflows.",
    modules: [...defaultLabModules, "doctor-portal", "patient-portal"],
    features: [
      "patient-portal",
      "doctor-portal",
      "corporate-accounts",
      "doctor-commissions",
      "refunds",
      "excel-export",
      "pdf-export",
      "custom-branding",
      "inventory-import-export",
    ],
    quotas: { patientRegistrations: 1_000, billingRecords: 2_500, staffUsers: 20 },
    pricing: { currency: "INR", monthlyAmountMinor: null, annualAmountMinor: null },
  },
  {
    key: "premium",
    name: "Premium",
    releaseVersion: "1.0",
    description: "High-volume LIMS access with advanced analytics and higher allowances.",
    modules: [...defaultLabModules, "doctor-portal", "patient-portal"],
    features: entitlementCatalog.features,
    quotas: { patientRegistrations: 5_000, billingRecords: 10_000, staffUsers: 75 },
    pricing: { currency: "INR", monthlyAmountMinor: null, annualAmountMinor: null },
  },
];

export function getDefaultPackageDefinition(packageKey) {
  return defaultSubscriptionPackages.find((item) => item.key === packageKey) || null;
}

export function mapLegacyPlanToPackageKey(value) {
  const plan = String(value || "").trim().toLowerCase();
  if (plan === "basic") return "basic";
  if (plan === "enterprise" || plan === "premium") return "premium";
  if (plan === "professional" || plan === "standard" || plan === "trial") return "standard";
  return "standard";
}

export function normalizeQuotaLimit(value, fallback = null) {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

export function resolvePackageModules(value) {
  const knownModules = new Set(availableLabModules.map((module) => module.id));
  const selected = new Set(["dashboard"]);

  function includeModule(moduleId) {
    if (!knownModules.has(moduleId) || selected.has(moduleId)) return;
    selected.add(moduleId);
    for (const dependency of moduleDependencies[moduleId] || []) includeModule(dependency);
  }

  for (const moduleId of Array.isArray(value) ? value : []) includeModule(moduleId);
  return availableLabModules.map((module) => module.id).filter((moduleId) => selected.has(moduleId));
}

export function buildEntitlementSnapshot(definition, { modulesOverride } = {}) {
  const fallback = getDefaultPackageDefinition(definition?.key) || getDefaultPackageDefinition("standard");
  const quotas = definition?.quotas || fallback.quotas;

  return {
    modules: normalizeEnabledModules(modulesOverride?.length ? modulesOverride : definition?.modules || fallback.modules),
    features: [...new Set(Array.isArray(definition?.features) ? definition.features : fallback.features)],
    quotas: {
      patientRegistrations: normalizeQuotaLimit(quotas.patientRegistrations, fallback.quotas.patientRegistrations),
      billingRecords: normalizeQuotaLimit(quotas.billingRecords, fallback.quotas.billingRecords),
      staffUsers: normalizeQuotaLimit(quotas.staffUsers, fallback.quotas.staffUsers),
    },
  };
}

export function getCalendarMonthPeriod(value = new Date()) {
  const date = new Date(value);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 1));

  return {
    key: `${year}-${String(month + 1).padStart(2, "0")}`,
    start,
    end,
  };
}

export function calculateQuotaState({ included = 0, addOn = 0, adjustment = 0, consumed = 0, reserved = 0 }) {
  const unlimited = included === null;
  const effectiveLimit = unlimited ? null : Math.max(0, included + addOn + adjustment);
  const used = Math.max(0, consumed + reserved);
  const remaining = unlimited ? null : Math.max(0, effectiveLimit - used);

  return {
    included,
    addOn,
    adjustment,
    consumed,
    reserved,
    effectiveLimit,
    remaining,
    unlimited,
    atLimit: !unlimited && used >= effectiveLimit,
    overLimit: !unlimited && used > effectiveLimit,
    utilizationPercent: unlimited || effectiveLimit === 0 ? null : Math.round((used / effectiveLimit) * 1000) / 10,
  };
}
