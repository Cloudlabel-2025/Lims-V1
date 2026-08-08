import mongoose from "mongoose";

const quotaSchema = new mongoose.Schema(
  {
    patientRegistrations: { type: Number, min: 0, default: null },
    billingRecords: { type: Number, min: 0, default: null },
    staffUsers: { type: Number, min: 0, default: null },
  },
  { _id: false }
);

const packagePricingSchema = new mongoose.Schema(
  {
    currency: { type: String, required: true, uppercase: true, trim: true, match: /^[A-Z]{3}$/ },
    monthlyAmountMinor: { type: Number, min: 0, default: null },
    annualAmountMinor: { type: Number, min: 0, default: null },
  },
  { _id: false }
);

const addonQuotaSchema = new mongoose.Schema(
  {
    units: { type: Number, min: 0, default: null },
    priceMinor: { type: Number, min: 0, default: null },
  },
  { _id: false }
);

const packageAddonsSchema = new mongoose.Schema(
  {
    patientRegistrations: { type: addonQuotaSchema, default: () => ({ units: 100, priceMinor: 10000 }) },
    billingRecords: { type: addonQuotaSchema, default: () => ({ units: 250, priceMinor: 12500 }) },
    staffUsers: { type: addonQuotaSchema, default: () => ({ units: 1, priceMinor: 20000 }) },
  },
  { _id: false }
);

const packageVersionSchema = new mongoose.Schema(
  {
    version: { type: Number, required: true, min: 1 },
    modules: { type: [String], default: [] },
    features: { type: [String], default: [] },
    quotas: { type: quotaSchema, required: true },
    pricing: {
      type: packagePricingSchema,
      default: () => ({ currency: "INR", monthlyAmountMinor: null, annualAmountMinor: null }),
    },
    addons: {
      type: packageAddonsSchema,
      default: () => ({
        patientRegistrations: { units: 100, priceMinor: 10000 },
        billingRecords: { units: 250, priceMinor: 12500 },
        staffUsers: { units: 1, priceMinor: 20000 },
      }),
    },
    effectiveAt: { type: Date, default: Date.now },
    publishedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

export const SubscriptionPackageSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    releaseVersion: {
      type: String,
      required: true,
      trim: true,
      maxlength: 30,
      default: "1.0",
      match: /^[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)*$/,
    },
    description: { type: String, trim: true, maxlength: 500 },
    type: { type: String, enum: ["system", "custom"], default: "system", index: true },
    status: { type: String, enum: ["draft", "active", "inactive", "archived"], default: "active", index: true },
    activeVersion: { type: Number, required: true, min: 1, default: 1 },
    revision: { type: Number, required: true, min: 1, default: 1 },
    versions: {
      type: [packageVersionSchema],
      validate: {
        validator: (versions) => Array.isArray(versions) && versions.length > 0,
        message: "At least one package version is required",
      },
    },
    restrictedTenantId: { type: String, trim: true, lowercase: true, index: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

SubscriptionPackageSchema.index({ status: 1, sortOrder: 1 });
SubscriptionPackageSchema.index({ name: 1, releaseVersion: 1 }, { unique: true });

export function getSubscriptionPackageModel(connection = mongoose) {
  const existing = connection.models.SubscriptionPackage;
  if (existing) {
    const versionsPath = existing.schema.path("versions");
    const pricingPath = versionsPath?.schema?.path("pricing");
    const hasCurrentSchema = Boolean(
      existing.schema.path("releaseVersion") &&
      existing.schema.path("revision") &&
      pricingPath?.schema?.path("monthlyAmountMinor")
    );

    if (hasCurrentSchema) return existing;
    connection.deleteModel("SubscriptionPackage");
  }

  return connection.model("SubscriptionPackage", SubscriptionPackageSchema);
}

const SubscriptionPackage = getSubscriptionPackageModel();
export default SubscriptionPackage;
