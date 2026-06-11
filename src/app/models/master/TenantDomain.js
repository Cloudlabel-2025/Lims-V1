import mongoose from "mongoose";

export const tenantDomainStatuses = [
  "pending",
  "added_to_vercel",
  "waiting_dns",
  "dns_verified",
  "ssl_provisioning",
  "active",
  "failed",
  "removing",
];

export const TenantDomainSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    },
    lab: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lab",
      required: true,
      index: true,
    },
    domain: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    isPrimary: {
      type: Boolean,
      default: false,
      index: true,
    },
    status: {
      type: String,
      enum: tenantDomainStatuses,
      default: "pending",
      index: true,
    },
    dnsVerified: {
      type: Boolean,
      default: false,
      index: true,
    },
    sslIssued: {
      type: Boolean,
      default: false,
      index: true,
    },
    configured: {
      type: Boolean,
      default: false,
    },
    verified: {
      type: Boolean,
      default: false,
    },
    dnsStatus: {
      type: String,
      enum: ["pending", "configured", "failed"],
      default: "pending",
    },
    sslStatus: {
      type: String,
      enum: ["pending", "provisioning", "issued", "failed"],
      default: "pending",
    },
    vercelDomainId: {
      type: String,
      trim: true,
    },
    vercelProjectId: {
      type: String,
      trim: true,
    },
    vercelResponse: {
      type: mongoose.Schema.Types.Mixed,
    },
    verificationToken: {
      type: String,
      required: false,
      select: false,
    },
    dnsRecords: {
      type: [
        {
          type: {
            type: String,
            enum: ["A", "AAAA", "CNAME", "TXT", "NS"],
            required: true,
          },
          host: {
            type: String,
            required: true,
            trim: true,
          },
          value: {
            type: String,
            required: true,
            trim: true,
          },
          purpose: {
            type: String,
            enum: ["ownership", "routing", "optional"],
            default: "routing",
          },
          required: {
            type: Boolean,
            default: true,
          },
        },
      ],
      default: [],
    },
    lastCheckedAt: {
      type: Date,
    },
    lastVerifiedAt: {
      type: Date,
    },
    certificateExpiresAt: {
      type: Date,
    },
    lastError: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeveloperUser",
    },
  },
  { timestamps: true }
);

TenantDomainSchema.index(
  { tenantId: 1, isPrimary: 1 },
  {
    unique: true,
    partialFilterExpression: { isPrimary: true },
  }
);
TenantDomainSchema.index({ status: 1, updatedAt: 1 });
TenantDomainSchema.index({ dnsVerified: 1, sslIssued: 1, updatedAt: 1 });

export function getTenantDomainModel(connection = mongoose) {
  return connection.models.TenantDomain || connection.model("TenantDomain", TenantDomainSchema);
}

const TenantDomain = getTenantDomainModel();
export default TenantDomain;
