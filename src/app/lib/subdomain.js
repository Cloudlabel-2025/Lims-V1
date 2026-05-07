import { normalizeRootDomain } from "@/app/lib/tenant-resolver";

export const subdomainPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const reservedSubdomains = new Set([
  "admin",
  "api",
  "app",
  "assets",
  "auth",
  "billing",
  "cdn",
  "dashboard",
  "developer",
  "docs",
  "help",
  "internal",
  "login",
  "mail",
  "onboarding",
  "root",
  "static",
  "support",
  "www",
]);

export function slugifySubdomain(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 63);
}

export function validateSubdomain(value) {
  const subdomain = slugifySubdomain(value);

  if (!subdomain) {
    return { valid: false, subdomain, error: "Subdomain is required" };
  }

  if (subdomain.length < 3) {
    return { valid: false, subdomain, error: "Subdomain must be at least 3 characters" };
  }

  if (!subdomainPattern.test(subdomain)) {
    return {
      valid: false,
      subdomain,
      error: "Use lowercase letters, numbers, and single hyphens only",
    };
  }

  if (reservedSubdomains.has(subdomain)) {
    return { valid: false, subdomain, error: "This subdomain is reserved" };
  }

  return { valid: true, subdomain, error: "" };
}

export function buildTenantUrl(subdomain, requestUrl) {
  const rootDomain = normalizeRootDomain(process.env.ROOT_DOMAIN);
  const protocol = String(process.env.PUBLIC_APP_PROTOCOL || "https").replace(/:$/, "");

  if (rootDomain) {
    return `${protocol}://${subdomain}.${rootDomain}/`;
  }

  const url = new URL(requestUrl);
  url.pathname = "/";
  url.search = "";
  url.searchParams.set("tenantId", subdomain);
  url.searchParams.set("access", "lab");
  return url.toString();
}
