import { headers } from "next/headers";
import LoginPage from "./components/LoginPage";
import { getTenantIdFromHostname, normalizeTenantId } from "./lib/tenant-resolver";
import { getTenantConfig } from "./lib/tenant-cache";
import { defaultLabModules } from "./lib/modules";

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
  const host = requestHeaders.get("host");
  const middlewareTenantId = requestHeaders.get("x-lims-tenant-id");
  const hostname = String(host || "").split(":")[0].toLowerCase();
  let hostTenantId = "";

  try {
    hostTenantId = middlewareTenantId
      ? normalizeTenantId(middlewareTenantId)
      : getTenantIdFromHostname(hostname) || "";
  } catch {
    hostTenantId = "";
  }

  const initialTenantId = params?.tenantId || hostTenantId || "";
  const isDeveloperAccess = params?.access === "developer";
  const initialUserType = initialTenantId && !isDeveloperAccess ? "tenant" : "developer";
  const initialTheme =
    initialTenantId && initialUserType === "tenant" ? await getInitialTheme(initialTenantId) : null;

  return (
    <LoginPage
      initialTenantId={initialTenantId}
      initialUserType={initialUserType}
      lockUserType={Boolean(initialTenantId && !isDeveloperAccess)}
      initialTheme={initialTheme}
    />
  );
}
