import { headers } from "next/headers";
import LoginPage from "./components/LoginPage";
import {
  getHostnameFromHeaders,
  getTenantIdFromHostname,
  normalizeTenantId,
  normalizeRootDomain,
} from "./lib/tenant-resolver";
import { getTenantConfig, getTenantConfigByDomain } from "./lib/tenant-cache";
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

async function getInitialCustomDomainTheme(hostname) {
  try {
    const lab = await getTenantConfigByDomain(hostname);
    if (!lab || lab.status !== "active") return null;

    return {
      tenantId: lab.tenantId,
      theme: {
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
      },
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
  const onCustomDomain = !isPlatformHost(hostname);
  let hostTenantId = "";
  let customDomainTheme = null;

  try {
    hostTenantId = middlewareTenantId
      ? normalizeTenantId(middlewareTenantId)
      : getTenantIdFromHostname(hostname) || "";
  } catch {
    hostTenantId = "";
  }

  if (onCustomDomain && !hostTenantId) {
    customDomainTheme = await getInitialCustomDomainTheme(hostname);
    hostTenantId = customDomainTheme?.tenantId || "";
  }

  if (process.env.NODE_ENV !== "production" || process.env.DEBUG_REQUESTS === "true") {
    console.log("[request:home]", {
      hostname,
      rootDomain: normalizeRootDomain(process.env.ROOT_DOMAIN),
      onCustomDomain,
      middlewareTenantId,
      hostTenantId,
      customDomainMatched: Boolean(customDomainTheme),
      initialUserType: onCustomDomain || hostTenantId ? "tenant" : "developer",
    });
  }

  // On a custom domain the developer access query param is never honoured.
  // If the domain is not yet verified the tenant header won't be injected,
  // but we still must not show the CMS login — show a plain "not available" page.
  if (onCustomDomain && !hostTenantId) {
    return (
      <html lang="en">
        <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
          <div style={{ textAlign: "center", color: "#64748b" }}>
            <p style={{ fontSize: "1.1rem", fontWeight: 600 }}>Lab portal not available</p>
            <p style={{ fontSize: "0.9rem" }}>This domain is not yet active. Please try again later.</p>
          </div>
        </body>
      </html>
    );
  }

  const initialTenantId = params?.tenantId || hostTenantId || "";
  const isDeveloperAccess = !onCustomDomain && params?.access === "developer";
  const initialUserType = (onCustomDomain || (initialTenantId && !isDeveloperAccess)) ? "tenant" : "developer";
  const initialTheme =
    customDomainTheme?.theme ||
    (initialTenantId && initialUserType === "tenant" ? await getInitialTheme(initialTenantId) : null);

  return (
    <LoginPage
      initialTenantId={initialTenantId}
      initialUserType={initialUserType}
      lockUserType={Boolean(onCustomDomain || (initialTenantId && !isDeveloperAccess))}
      initialTheme={initialTheme}
    />
  );
}
