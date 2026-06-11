import crypto from "node:crypto";
import mongoose from "mongoose";
import { clearTenantConfigCache, clearTenantDomainConfigCache } from "@/app/lib/tenant-cache";
import {
  getCustomDomainRoutingConfig,
  getDomainDnsRecords,
  isPlatformDomain,
  isNameserverMode,
  isValidCustomDomain,
  normalizeCustomDomain,
  vercelCnameTarget,
} from "@/app/lib/domain-utils";
import {
  addVercelProjectDomain,
  getVercelProjectDomain,
  getVercelNameservers,
  getVercelProjectId,
  removeVercelProjectDomain,
  verifyVercelProjectDomain,
  VercelDomainError,
} from "@/app/lib/vercel-domains";
import { getLabModel } from "@/app/models/master/Lab";
import { getTenantDomainModel } from "@/app/models/master/TenantDomain";

function cleanString(value) {
  return String(value || "").trim();
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function getReservedCustomDomains() {
  return new Set(
    String(process.env.RESERVED_CUSTOM_DOMAINS || "")
      .split(",")
      .map((item) => normalizeCustomDomain(item))
      .filter(Boolean)
  );
}

export async function getLabByIdOrTenantId(masterConnection, labId) {
  const Lab = getLabModel(masterConnection);
  const cleanLabId = cleanString(labId);
  const normalizedLabId = cleanLabId.toLowerCase();
  const identifierFilters = [
    { tenantId: normalizedLabId },
    { labId: cleanLabId },
    { labId: normalizedLabId },
    { name: new RegExp(`^${escapeRegex(cleanLabId)}$`, "i") },
  ];

  if (mongoose.Types.ObjectId.isValid(cleanLabId)) {
    identifierFilters.unshift({ _id: cleanLabId });
  }

  const query = { $or: identifierFilters };
  const lab = await Lab.findOne(query);
  if (lab) return lab;

  const rawLab = await masterConnection.db.collection("labs").findOne(query);
  return rawLab ? Lab.hydrate(rawLab) : null;
}

function normalizeVercelVerificationRecords(domain, verification) {
  return (verification || [])
    .map((record) => ({
      type: String(record.type || "TXT").toUpperCase(),
      host: normalizeCustomDomain(record.domain || record.name || domain),
      value: String(record.value || "").trim(),
      purpose: "ownership",
      required: true,
    }))
    .filter((record) => record.value);
}

export function buildDomainDnsRecords(domain, verificationToken, vercelDomain = {}) {
  const domainName = normalizeCustomDomain(domain);

  if (isNameserverMode()) {
    return getDomainDnsRecords(domainName, verificationToken);
  }

  const vercelRecords = normalizeVercelVerificationRecords(domainName, vercelDomain.verification);
  const fallbackRecords = getDomainDnsRecords(domainName, verificationToken);
  const requiredRecords = vercelRecords.length
    ? [...vercelRecords, ...fallbackRecords.filter((record) => record.purpose === "routing")]
    : fallbackRecords;

  return [
    ...requiredRecords,
    {
      type: "CNAME",
      host: `www.${domainName}`,
      value: vercelCnameTarget,
      purpose: "optional",
      required: false,
    },
  ];
}

function isVercelDomainConfigured(vercelDomain = {}) {
  return Boolean(vercelDomain.verified && vercelDomain.configured !== false && !vercelDomain.misconfigured);
}

function inferSslStatus(vercelDomain = {}) {
  if (isVercelDomainConfigured(vercelDomain)) return "issued";
  if (vercelDomain.verified) return "provisioning";
  if (vercelDomain.misconfigured) return "failed";
  return "pending";
}

function inferStatus({ vercelDomain, dnsVerified, sslStatus }) {
  if (dnsVerified && sslStatus === "issued") return "active";
  if (dnsVerified) return "ssl_provisioning";
  if (vercelDomain?.verified) return "dns_verified";
  if (vercelDomain) return "waiting_dns";
  return "pending";
}

async function ensureVercelProjectDomain(domain) {
  try {
    return await getVercelProjectDomain(domain);
  } catch (error) {
    if (!(error instanceof VercelDomainError) || error.status !== 404) throw error;
    return addVercelProjectDomain(domain);
  }
}

export function serializeTenantDomain(domain) {
  const status = domain.status;
  const verificationStatus = status === "active" ? "verified" : status;
  return {
    id: String(domain._id),
    tenantId: domain.tenantId,
    domain: domain.domain,
    domainName: domain.domain,
    isPrimary: Boolean(domain.isPrimary),
    status,
    verificationStatus,
    dnsVerified: Boolean(domain.dnsVerified),
    sslIssued: Boolean(domain.sslIssued),
    configured: Boolean(domain.configured),
    verified: Boolean(domain.verified),
    dnsStatus: domain.dnsStatus,
    sslStatus: domain.sslStatus,
    dnsRecords: domain.dnsRecords || [],
    vercelDomainId: domain.vercelDomainId,
    lastCheckedAt: domain.lastCheckedAt,
    lastVerifiedAt: domain.lastVerifiedAt,
    certificateExpiresAt: domain.certificateExpiresAt,
    lastError: domain.lastError,
    createdAt: domain.createdAt,
    updatedAt: domain.updatedAt,
  };
}

export async function listTenantDomains(masterConnection, lab) {
  const TenantDomain = getTenantDomainModel(masterConnection);
  const domains = await TenantDomain.find({ tenantId: lab.tenantId })
    .sort({ isPrimary: -1, createdAt: -1 })
    .lean();

  return domains.map(serializeTenantDomain);
}

export async function createTenantDomain(masterConnection, lab, rawDomain, actorUserId) {
  const TenantDomain = getTenantDomainModel(masterConnection);
  const Lab = getLabModel(masterConnection);
  const domain = normalizeCustomDomain(rawDomain);

  if (!isValidCustomDomain(domain)) {
    return { error: "Enter a valid domain name", status: 400 };
  }

  if (isPlatformDomain(domain) || getReservedCustomDomains().has(domain)) {
    return { error: "This domain is reserved for the platform", status: 400 };
  }

  const [existingDomain, embeddedOwner] = await Promise.all([
    TenantDomain.findOne({ domain }).lean(),
    Lab.findOne({ _id: { $ne: lab._id }, "customDomains.domainName": domain }).select("_id tenantId").lean(),
  ]);

  if (existingDomain || embeddedOwner) {
    return { error: "This domain is already connected to another lab", status: 409 };
  }

  const verificationToken = `lims-domain-${crypto.randomBytes(16).toString("hex")}`;
  const existingTenantDomains = await TenantDomain.countDocuments({ tenantId: lab.tenantId });
  let vercelDomain = null;

  try {
    vercelDomain = await addVercelProjectDomain(domain);
  } catch (error) {
    if (!(error instanceof VercelDomainError) || error.status !== 400) throw error;
    vercelDomain = await getVercelProjectDomain(domain);
  }

  const nsMode = isNameserverMode();
  let dnsVerified = Boolean(vercelDomain.verified);

  if (nsMode && !dnsVerified) {
    const nsData = await getVercelNameservers(domain).catch(() => ({ nsVerified: false }));
    dnsVerified = nsData.nsVerified;
  }

  const sslStatus = inferSslStatus(vercelDomain);
  const createdDomain = await TenantDomain.create({
    tenantId: lab.tenantId,
    lab: lab._id,
    domain,
    isPrimary: existingTenantDomains === 0,
    status: inferStatus({ vercelDomain, dnsVerified, sslStatus }),
    dnsVerified,
    sslIssued: sslStatus === "issued",
    configured: isVercelDomainConfigured(vercelDomain),
    verified: Boolean(vercelDomain.verified),
    dnsStatus: dnsVerified ? "configured" : "pending",
    sslStatus,
    vercelDomainId: vercelDomain.uid || vercelDomain.name || domain,
    vercelProjectId: getVercelProjectId(),
    vercelResponse: vercelDomain,
    verificationToken,
    dnsRecords: buildDomainDnsRecords(domain, verificationToken, vercelDomain),
    lastCheckedAt: new Date(),
    createdBy: actorUserId,
  });

  clearTenantConfigCache(lab.tenantId);
  clearTenantDomainConfigCache(domain);
  return { domain: serializeTenantDomain(createdDomain), status: 201 };
}

export async function verifyTenantDomain(masterConnection, lab, rawDomain) {
  const TenantDomain = getTenantDomainModel(masterConnection);
  const domain = normalizeCustomDomain(rawDomain);
  const domainEntry = await TenantDomain.findOne({ tenantId: lab.tenantId, domain }).select(
    "+verificationToken"
  );

  if (!domainEntry) {
    return { error: "Domain not found", status: 404 };
  }

  let vercelDomain = await ensureVercelProjectDomain(domain);
  if (!vercelDomain.verified) {
    try {
      vercelDomain = await verifyVercelProjectDomain(domain);
    } catch {
      vercelDomain = await ensureVercelProjectDomain(domain);
    }
  }

  let dnsVerified = Boolean(vercelDomain.verified);

  if (isNameserverMode() && !dnsVerified) {
    const nsData = await getVercelNameservers(domain).catch(() => ({ nsVerified: false }));
    dnsVerified = nsData.nsVerified;
  }

  const sslStatus = inferSslStatus(vercelDomain);
  domainEntry.dnsVerified = dnsVerified;
  domainEntry.sslIssued = sslStatus === "issued";
  domainEntry.configured = isVercelDomainConfigured(vercelDomain);
  domainEntry.verified = Boolean(vercelDomain.verified);
  domainEntry.dnsStatus = dnsVerified ? "configured" : "failed";
  domainEntry.sslStatus = sslStatus;
  domainEntry.status = inferStatus({ vercelDomain, dnsVerified, sslStatus });
  domainEntry.vercelResponse = vercelDomain;
  domainEntry.dnsRecords = buildDomainDnsRecords(domain, domainEntry.verificationToken, vercelDomain);
  domainEntry.lastCheckedAt = new Date();
  domainEntry.lastVerifiedAt = dnsVerified ? new Date() : domainEntry.lastVerifiedAt;
  domainEntry.lastError = dnsVerified ? "" : isNameserverMode() ? "Nameservers not yet pointed to Vercel. Update NS records at your registrar." : "DNS is not verified by Vercel yet.";
  await domainEntry.save();
  clearTenantConfigCache(lab.tenantId);
  clearTenantDomainConfigCache(domain);

  return { domain: serializeTenantDomain(domainEntry), status: 200 };
}

export async function setPrimaryTenantDomain(masterConnection, lab, rawDomain) {
  const TenantDomain = getTenantDomainModel(masterConnection);
  const domain = normalizeCustomDomain(rawDomain);
  const domainEntry = await TenantDomain.findOne({ tenantId: lab.tenantId, domain });

  if (!domainEntry) return { error: "Domain not found", status: 404 };
  if (domainEntry.status !== "active") {
    return { error: "Only active domains can be set as primary", status: 409 };
  }

  await TenantDomain.updateMany({ tenantId: lab.tenantId }, { $set: { isPrimary: false } });
  domainEntry.isPrimary = true;
  await domainEntry.save();
  clearTenantConfigCache(lab.tenantId);
  clearTenantDomainConfigCache(domain);

  return { domain: serializeTenantDomain(domainEntry), status: 200 };
}

export async function removeTenantDomain(masterConnection, lab, rawDomain) {
  const TenantDomain = getTenantDomainModel(masterConnection);
  const domain = normalizeCustomDomain(rawDomain);
  const domainEntry = await TenantDomain.findOne({ tenantId: lab.tenantId, domain });

  if (!domainEntry) return { error: "Domain not found", status: 404 };

  domainEntry.status = "removing";
  await domainEntry.save();

  try {
    await removeVercelProjectDomain(domain);
  } catch (error) {
    if (!(error instanceof VercelDomainError) || error.status !== 404) throw error;
  }

  await TenantDomain.deleteOne({ _id: domainEntry._id });
  if (domainEntry.isPrimary) {
    const replacement = await TenantDomain.findOne({ tenantId: lab.tenantId, status: "active" }).sort({
      createdAt: 1,
    });
    if (replacement) {
      replacement.isPrimary = true;
      await replacement.save();
    }
  }
  clearTenantConfigCache(lab.tenantId);
  clearTenantDomainConfigCache(domain);

  return { status: 200 };
}
