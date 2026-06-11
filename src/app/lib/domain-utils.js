export const domainStatusValues = ["pending", "verifying", "verified", "failed"];
export const sslStatusValues = ["pending", "active", "expired", "failed"];
export const vercelApexIpv4 = "76.76.21.21";
export const vercelCnameTarget = "cname.vercel-dns.com";

export function normalizeCustomDomain(value) {
  return String(value || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "")
    .toLowerCase();
}

export function isValidCustomDomain(value) {
  const domain = normalizeCustomDomain(value);
  if (!domain || domain.length > 253) return false;
  if (domain === "localhost" || domain.endsWith(".localhost")) return false;
  if (!domain.includes(".")) return false;

  return domain
    .split(".")
    .every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label));
}

export function getCustomDomainRoutingConfig() {
  const cnameTarget = normalizeCustomDomain(
    process.env.CUSTOM_DOMAIN_CNAME_TARGET || process.env.PUBLIC_APP_HOST || vercelCnameTarget
  );
  const ipv4Target = String(
    process.env.CUSTOM_DOMAIN_IPV4 || process.env.SERVER_PUBLIC_IPV4 || vercelApexIpv4
  ).trim();

  return {
    cnameTarget: cnameTarget || vercelCnameTarget,
    ipv4Target: ipv4Target || vercelApexIpv4,
  };
}

export function isNameserverMode() {
  return String(process.env.DOMAIN_CONNECTION_MODE || "").toLowerCase() === "nameserver";
}

export function getVercelIntendedNameservers() {
  const configured = String(process.env.VERCEL_INTENDED_NAMESERVERS || "").trim();
  if (configured) return configured.split(",").map((ns) => ns.trim()).filter(Boolean);
  return ["ns1.vercel-dns.com", "ns2.vercel-dns.com"];
}

export function getDomainDnsRecords(domainName, verificationToken) {
  const domain = normalizeCustomDomain(domainName);

  if (isNameserverMode()) {
    return getVercelIntendedNameservers().map((ns) => ({
      type: "NS",
      host: domain,
      value: ns,
      purpose: "routing",
      required: true,
    }));
  }

  const { cnameTarget, ipv4Target } = getCustomDomainRoutingConfig();
  const isLikelyRootDomain = domain.split(".").length === 2;

  const records = [
    {
      type: "TXT",
      host: `_lims-verify.${domain}`,
      value: verificationToken,
      purpose: "ownership",
    },
  ];

  if (isLikelyRootDomain) {
    records.push({
      type: "A",
      host: domain,
      value: ipv4Target,
      purpose: "routing",
    });
  } else {
    records.push({
      type: "CNAME",
      host: domain,
      value: cnameTarget,
      purpose: "routing",
    });
  }

  return records;
}

export function isPlatformDomain(domainName) {
  const domain = normalizeCustomDomain(domainName);
  const rootDomain = normalizeCustomDomain(process.env.ROOT_DOMAIN);
  return Boolean(rootDomain && (domain === rootDomain || domain.endsWith(`.${rootDomain}`)));
}
