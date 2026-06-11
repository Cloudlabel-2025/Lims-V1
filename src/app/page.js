import { headers } from "next/headers";
import LoginPage from "./components/LoginPage";
import {
  getHostnameFromHeaders,
  getTenantIdFromHostname,
  normalizeTenantId,
  normalizeRootDomain,
} from "./lib/tenant-resolver";
import { getTenantConfig } from "./lib/tenant-cache";
import { defaultLabModules } from "./lib/modules";

function isPlatformHost(hostname) {
  const rootDomain = normalizeRootDomain(process.env.ROOT_DOMAIN);
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    (rootDomain && (hostname === rootDomain || hostname.endsWith(`.${rootDomain}`)))
  );
}

const defaultThemeColors = {
  primaryColor: "#0d9488",
  secondaryColor: "#0f766e",
  accentColor: "#f59e0b",
};

async function getInitialTheme(tenantId) {
  if (!tenantId) return null;

  try {
    const lab = await getTenantConfig(tenantId);
    if (!lab || lab.status !== "active") return null;

    return {
      labName: lab.name,
      tenantId: lab.tenantId,
      subscriptionPlan: lab.subscriptionPlan,
      logo: lab.branding?.logo?.url || null,
      logoAltText: lab.branding?.logo?.altText || `${lab.name} logo`,
      primaryColor: lab.branding?.primaryColor || defaultThemeColors.primaryColor,
      secondaryColor: lab.branding?.secondaryColor || defaultThemeColors.secondaryColor,
      accentColor: lab.branding?.accentColor || defaultThemeColors.accentColor,
      enabledModules: lab.enabledModules?.length ? lab.enabledModules : defaultLabModules,
      loginHighlights: lab.branding?.loginHighlights || [],
    };
  } catch {
    return null;
  }
}

export default async function Home({ searchParams }) {
  const params = await searchParams;
  const requestHeaders = await headers();
  const middlewareTenantId = requestHeaders.get("x-lims-tenant-id");
  const hostname = getHostnameFromHeaders(requestHeaders);
  const onTenantSubdomain = !isPlatformHost(hostname);
  let hostTenantId = "";

  try {
    hostTenantId = middlewareTenantId
      ? normalizeTenantId(middlewareTenantId)
      : getTenantIdFromHostname(hostname) || "";
  } catch {
    hostTenantId = "";
  }

  if (process.env.NODE_ENV !== "production" || process.env.DEBUG_REQUESTS === "true") {
    console.log("[request:home]", {
      hostname,
      rootDomain: normalizeRootDomain(process.env.ROOT_DOMAIN),
      onTenantSubdomain,
      middlewareTenantId,
      hostTenantId,
      initialUserType: onTenantSubdomain || hostTenantId ? "tenant" : "developer",
    });
  }

  const initialTenantId = params?.tenantId || hostTenantId || "";
  const isDeveloperAccess = !onTenantSubdomain && params?.access === "developer";
  const initialUserType = onTenantSubdomain || (initialTenantId && !isDeveloperAccess) ? "tenant" : "developer";
  const initialTheme =
    initialTenantId && initialUserType === "tenant" ? await getInitialTheme(initialTenantId) : null;

  return (
    <LoginPage
      initialTenantId={initialTenantId}
      initialUserType={initialUserType}
      lockUserType={Boolean(onTenantSubdomain || (initialTenantId && !isDeveloperAccess))}
      initialTheme={initialTheme}
    />
  );
}
