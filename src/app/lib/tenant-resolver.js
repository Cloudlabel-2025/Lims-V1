const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
const trustedTenantHeader = "x-lims-tenant-id";

export function getTenantIdFromRequest(req) {
  const middlewareTenantId = req.headers.get(trustedTenantHeader);
  if (middlewareTenantId) {
    return normalizeTenantId(middlewareTenantId);
  }

  const url = new URL(req.url);
  const host = getTrustedHost(req) || url.host;

  return getTenantIdFromHost(host);
}

export function getTenantIdFromHost(host) {
  const hostname = String(host || "").split(":")[0].toLowerCase();
  const rootDomain = normalizeRootDomain(process.env.ROOT_DOMAIN);

  if (localHosts.has(hostname)) {
    if (process.env.DEFAULT_TENANT_ID) {
      return normalizeTenantId(process.env.DEFAULT_TENANT_ID);
    }

    throw new Error("Tenant not found. Use tenant.localhost for local development.");
  }

  if (rootDomain && hostname.endsWith(`.${rootDomain}`)) {
    return normalizeTenantId(hostname.slice(0, -(rootDomain.length + 1)));
  }

  if (hostname.endsWith(".localhost")) {
    return normalizeTenantId(hostname.slice(0, -".localhost".length));
  }

  throw new Error("Tenant not found for host.");
}

export function getTenantIdFromHostname(hostname) {
  const normalizedHostname = String(hostname || "").split(":")[0].toLowerCase();
  const rootDomain = normalizeRootDomain(process.env.ROOT_DOMAIN);

  if (!normalizedHostname) return null;
  if (localHosts.has(normalizedHostname)) return null;
  if (rootDomain && normalizedHostname === rootDomain) return null;
  if (rootDomain && normalizedHostname.endsWith(`.${rootDomain}`)) {
    return normalizeTenantId(normalizedHostname.slice(0, -(rootDomain.length + 1)));
  }
  if (normalizedHostname === "localhost") return null;
  if (normalizedHostname.endsWith(".localhost")) {
    return normalizeTenantId(normalizedHostname.slice(0, -".localhost".length));
  }

  return null;
}

export function normalizeRootDomain(value) {
  return String(value || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
}

export function getTrustedHost(req) {
  const forwardedHost = req.headers.get("x-forwarded-host");
  const host = req.headers.get("host");
  const allowedHosts = String(process.env.ALLOWED_HOSTS || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  const selectedHost = forwardedHost || host;
  const hostname = String(selectedHost || "").split(":")[0].toLowerCase();
  const rootDomain = normalizeRootDomain(process.env.ROOT_DOMAIN);
  const isAllowedRootDomain =
    rootDomain && (hostname === rootDomain || hostname.endsWith(`.${rootDomain}`));
  const isAllowedLocalhost = hostname === "localhost" || hostname.endsWith(".localhost");

  if (
    allowedHosts.length > 0 &&
    !allowedHosts.includes(hostname) &&
    !isAllowedRootDomain &&
    !isAllowedLocalhost
  ) {
    throw new Error("Untrusted host");
  }

  return selectedHost;
}

export function normalizeTenantId(value) {
  const tenantId = String(value || "").trim().toLowerCase();

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tenantId)) {
    throw new Error("Invalid tenant identifier");
  }

  return tenantId;
}
