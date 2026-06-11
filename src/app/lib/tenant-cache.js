import { normalizeTenantId } from "@/app/lib/tenant-resolver";
import { normalizeCustomDomain } from "@/app/lib/domain-utils";

const tenantConfigCache = globalThis.tenantConfigCache || new Map();
globalThis.tenantConfigCache = tenantConfigCache;

const maxEntries = Number(process.env.TENANT_CACHE_MAX_ENTRIES || 1_000);

function getTtlMs() {
  const configuredTtl = Number(process.env.TENANT_CACHE_TTL_MS || 60_000);
  return Number.isFinite(configuredTtl) && configuredTtl > 0 ? configuredTtl : 60_000;
}

function toTenantConfig(lab) {
  if (!lab) return null;

  return {
    id: String(lab._id),
    labId: lab.labId,
    tenantId: lab.tenantId,
    name: lab.name,
    status: lab.status,
    dbName: lab.dbName,
    dbConnectionString: lab.dbConnectionString,
    subscriptionPlan: lab.subscriptionPlan,
    enabledModules: lab.enabledModules || [],
    branding: lab.branding || {},
  };
}

function buildCacheKey(tenantId, includeSecret = false) {
  return `${normalizeTenantId(tenantId)}:${includeSecret ? "secret" : "public"}`;
}

function pruneExpiredEntries(now = Date.now()) {
  for (const [key, entry] of tenantConfigCache.entries()) {
    if (!entry || entry.expiry <= now) {
      tenantConfigCache.delete(key);
    }
  }

  while (tenantConfigCache.size > maxEntries) {
    const oldestKey = tenantConfigCache.keys().next().value;
    if (!oldestKey) break;
    tenantConfigCache.delete(oldestKey);
  }
}

export function getCachedTenantConfig(tenantId, { includeSecret = false } = {}) {
  const cacheKey = buildCacheKey(tenantId, includeSecret);
  const cached = tenantConfigCache.get(cacheKey);

  if (!cached) return undefined;

  if (cached.expiry <= Date.now()) {
    tenantConfigCache.delete(cacheKey);
    return undefined;
  }

  return cached.data;
}

export function setTenantConfigCache(tenantId, data, { includeSecret = false } = {}) {
  const normalizedTenantId = normalizeTenantId(tenantId);
  const cacheKey = buildCacheKey(normalizedTenantId, includeSecret);

  pruneExpiredEntries();

  tenantConfigCache.set(cacheKey, {
    data,
    expiry: Date.now() + getTtlMs(),
  });
}

export function warmTenantConfigCache(tenant) {
  if (!tenant?.tenantId) return;

  const publicTenant = {
    ...tenant,
    dbConnectionString: undefined,
  };

  setTenantConfigCache(tenant.tenantId, publicTenant);

  if (tenant.dbConnectionString) {
    setTenantConfigCache(tenant.tenantId, tenant, { includeSecret: true });
  }
}

async function loadTenantConfigFromDb(tenantId, { includeSecret = false } = {}) {
  const normalizedTenantId = normalizeTenantId(tenantId);

  const [{ default: connectMasterDB }, { getLabModel }] = await Promise.all([
    import("@/app/lib/master-db"),
    import("@/app/models/master/Lab"),
  ]);
  const masterConnection = await connectMasterDB();
  const Lab = getLabModel(masterConnection);
  const query = Lab.findOne({ tenantId: normalizedTenantId }).select(
    "labId name tenantId dbName status subscriptionPlan enabledModules branding"
  );

  if (includeSecret) {
    query.select("+dbConnectionString");
  }

  const lab = await query.lean();
  return toTenantConfig(lab);
}

export async function getTenantConfig(tenantId, { includeSecret = false } = {}) {
  const normalizedTenantId = normalizeTenantId(tenantId);
  const cached = getCachedTenantConfig(normalizedTenantId, { includeSecret });

  if (cached !== undefined) return cached;

  const value = await loadTenantConfigFromDb(normalizedTenantId, { includeSecret });
  setTenantConfigCache(normalizedTenantId, value, { includeSecret });

  return value;
}

export async function getTenantConfigByDomain(domainName) {
  const domain = normalizeCustomDomain(domainName);
  if (!domain) return null;

  const cacheKey = `domain:${domain}`;
  const cached = tenantConfigCache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) return cached.data;

  const [{ default: connectMasterDB }, { getLabModel }, { getTenantDomainModel }] = await Promise.all([
    import("@/app/lib/master-db"),
    import("@/app/models/master/Lab"),
    import("@/app/models/master/TenantDomain"),
  ]);
  const masterConnection = await connectMasterDB();
  const Lab = getLabModel(masterConnection);
  const TenantDomain = getTenantDomainModel(masterConnection);
  const tenantDomain = await TenantDomain.findOne({
    domain,
    dnsVerified: true,
    status: { $in: ["dns_verified", "ssl_provisioning", "active"] },
  })
    .select("tenantId lab")
    .lean();
  let lab = tenantDomain
    ? await Lab.findOne({ _id: tenantDomain.lab })
        .select("labId name tenantId dbName status subscriptionPlan enabledModules branding")
        .lean()
    : null;

  if (!lab) {
    lab = await Lab.findOne({
      customDomains: {
        $elemMatch: {
          domainName: domain,
          verificationStatus: "verified",
        },
      },
    })
      .select("labId name tenantId dbName status subscriptionPlan enabledModules branding")
      .lean();
  }
  const value = toTenantConfig(lab);

  pruneExpiredEntries();
  tenantConfigCache.set(cacheKey, {
    data: value,
    expiry: Date.now() + getTtlMs(),
  });

  return value;
}

export function clearTenantConfigCache(tenantId) {
  if (!tenantId) {
    tenantConfigCache.clear();
    return;
  }

  const normalizedTenantId = normalizeTenantId(tenantId);
  for (const [cacheKey, cached] of tenantConfigCache.entries()) {
    if (
      cacheKey === `${normalizedTenantId}:secret` ||
      cacheKey === `${normalizedTenantId}:public` ||
      cached?.data?.tenantId === normalizedTenantId
    ) {
      tenantConfigCache.delete(cacheKey);
    }
  }
}

export function clearTenantDomainConfigCache(domainName) {
  const domain = normalizeCustomDomain(domainName);
  if (!domain) return;

  tenantConfigCache.delete(`domain:${domain}`);
}
