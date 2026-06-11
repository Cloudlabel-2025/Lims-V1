const vercelApiBaseUrl = "https://api.vercel.com";

export class VercelDomainError extends Error {
  constructor(message, status = 502, details = null) {
    super(message);
    this.name = "VercelDomainError";
    this.status = status;
    this.details = details;
  }
}

function getVercelConfig() {
  const token = String(process.env.VERCEL_TOKEN || "").trim();
  const projectId = String(process.env.VERCEL_PROJECT_ID || process.env.VERCEL_PROJECT_NAME || "").trim();
  const teamId = String(process.env.VERCEL_TEAM_ID || "").trim();

  if (!token || !projectId) {
    throw new VercelDomainError(
      "Vercel domain automation is not configured. Set VERCEL_TOKEN and VERCEL_PROJECT_ID.",
      500
    );
  }

  return { token, projectId, teamId };
}

function buildProjectDomainUrl(projectId, domain = "") {
  const path = domain
    ? `/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(domain)}`
    : `/v10/projects/${encodeURIComponent(projectId)}/domains`;
  const url = new URL(path, vercelApiBaseUrl);
  const teamId = String(process.env.VERCEL_TEAM_ID || "").trim();

  if (teamId) url.searchParams.set("teamId", teamId);
  return url;
}

export function buildProjectDomainVerifyUrl(projectId, domain) {
  const url = new URL(
    `/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(domain)}/verify`,
    vercelApiBaseUrl
  );
  const teamId = String(process.env.VERCEL_TEAM_ID || "").trim();

  if (teamId) url.searchParams.set("teamId", teamId);
  return url;
}

async function vercelFetch(url, { method = "GET", body } = {}) {
  const { token } = getVercelConfig();
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new VercelDomainError(
      data.error?.message || data.message || `Vercel request failed with HTTP ${response.status}`,
      response.status >= 500 ? 502 : response.status,
      data
    );
  }

  return data;
}

export function getVercelProjectId() {
  return getVercelConfig().projectId;
}

export async function addVercelProjectDomain(domain) {
  const { projectId } = getVercelConfig();
  return vercelFetch(buildProjectDomainUrl(projectId), {
    method: "POST",
    body: { name: domain },
  });
}

export async function getVercelProjectDomain(domain) {
  const { projectId } = getVercelConfig();
  return vercelFetch(buildProjectDomainUrl(projectId, domain));
}

export async function verifyVercelProjectDomain(domain) {
  const { projectId } = getVercelConfig();
  const url = buildProjectDomainVerifyUrl(projectId, domain);
  return vercelFetch(url, { method: "POST" });
}

export async function removeVercelProjectDomain(domain) {
  const { projectId } = getVercelConfig();
  return vercelFetch(buildProjectDomainUrl(projectId, domain), { method: "DELETE" });
}

export async function getVercelNameservers(domain) {
  const url = new URL(`/v5/domains/${encodeURIComponent(domain)}`, vercelApiBaseUrl);
  const teamId = String(process.env.VERCEL_TEAM_ID || "").trim();
  if (teamId) url.searchParams.set("teamId", teamId);
  const data = await vercelFetch(url);
  const nameservers = data.nameservers || data.ns || [];
  const intendedNameservers = data.intendedNameservers || [];
  const nsVerified = Boolean(
    nameservers.length &&
    intendedNameservers.length &&
    intendedNameservers.every((ns) => nameservers.includes(ns))
  );
  return { nameservers, intendedNameservers, nsVerified };
}
