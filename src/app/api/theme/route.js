import { NextResponse } from "next/server";
import { getSessionFromRequest, requireTenantSession } from "@/app/lib/auth";
import { getTenantIdFromRequest } from "@/app/lib/tenant-resolver";
import { defaultLabModules } from "@/app/lib/modules";
import { clearTenantConfigCache, getTenantConfig } from "@/app/lib/tenant-cache";

function debugRequestLog(message, details = {}) {
  if (process.env.NODE_ENV === "production" || process.env.DEBUG_REQUESTS === "false") return;
  const detailText = Object.entries(details)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key}=${value}`)
    .join(" ");
  console.log(`[request:theme] ${message}${detailText ? ` ${detailText}` : ""}`);
}

const defaultTheme = {
  labName: "Uthiram LIMS",
  tenantId: null,
  logo: null,
  logoAltText: "Uthiram LIMS logo",
  primaryColor: "#0d9488",
  secondaryColor: "#0f766e",
  accentColor: "#f59e0b",
  enabledModules: defaultLabModules,
  loginHighlights: [],
};

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const session = getSessionFromRequest(req);
    let tenantId = session?.userType === "tenant" ? session.tenantId : null;
    const source = tenantId ? "session" : "request";

    if (!tenantId) {
      try {
        tenantId = getTenantIdFromRequest(req);
      } catch {
        tenantId = searchParams.get("tenantId");
      }
    }

    debugRequestLog("start", {
      tenantId,
      source,
      host: req.headers.get("host"),
    });

    if (!tenantId) {
      debugRequestLog("default-no-tenant");
      return NextResponse.json({ theme: defaultTheme });
    }

    const lab = await getTenantConfig(tenantId);
    if (!lab) {
      debugRequestLog("default-missing-lab", { tenantId });
      return NextResponse.json({ theme: defaultTheme });
    }

    if (lab.status === "suspended") {
      return NextResponse.json({ error: "Tenant is suspended" }, { status: 423 });
    }

    if (lab.status !== "active") {
      return NextResponse.json({ error: "Tenant is not active" }, { status: 403 });
    }

    debugRequestLog("ok", {
      tenantId: lab.tenantId,
      status: lab.status,
    });
    return NextResponse.json({
      theme: {
        labName: lab.name,
        tenantId: lab.tenantId,
        subscriptionPlan: lab.subscriptionPlan,
        logo: lab.branding?.logo?.url || null,
        logoAltText: lab.branding?.logo?.altText || `${lab.name} logo`,
        primaryColor: lab.branding?.primaryColor || defaultTheme.primaryColor,
        secondaryColor: lab.branding?.secondaryColor || defaultTheme.secondaryColor,
        accentColor: lab.branding?.accentColor || defaultTheme.accentColor,
        enabledModules: lab.enabledModules?.length ? lab.enabledModules : defaultTheme.enabledModules,
        loginHighlights: lab.branding?.loginHighlights || [],
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Unable to load theme", details: error.message },
      { status: 500 }
    );
  }
}

function cleanString(value) {
  return String(value || "").trim();
}

function normalizeLogo(value, fallbackAltText) {
  if (!value || typeof value !== "object") return undefined;

  const url = cleanString(value.url);
  const publicId = cleanString(value.publicId);
  if (!url || !publicId) return undefined;

  return {
    url,
    publicId,
    storageKey: publicId,
    originalName: cleanString(value.originalName).slice(0, 180),
    size: Number(value.size) || undefined,
    mimeType: cleanString(value.mimeType).slice(0, 80),
    altText: cleanString(value.altText).slice(0, 120) || fallbackAltText,
    uploadedAt: value.uploadedAt ? new Date(value.uploadedAt) : new Date(),
  };
}

export async function PATCH(req) {
  try {
    const auth = requireTenantSession(req, "settings.branding");
    if (auth.error) return auth.error;

    const body = await req.json();
    const [{ default: connectMasterDB }, { getLabModel }] = await Promise.all([
      import("@/app/lib/master-db"),
      import("@/app/models/master/Lab"),
    ]);
    const masterConnection = await connectMasterDB();
    const Lab = getLabModel(masterConnection);
    const lab = await Lab.findOne({ tenantId: auth.tenantId });

    if (!lab) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const logoAltText = cleanString(body.logoAltText).slice(0, 120) || `${lab.name} logo`;
    const logo = normalizeLogo(body.logo, logoAltText);
    const existingLogo = lab.branding?.logo;

    lab.branding = {
      ...(lab.branding || {}),
      ...(logo
        ? { logo }
        : existingLogo
          ? {
              logo: {
                ...(existingLogo.toObject?.() || existingLogo),
                altText: logoAltText,
              },
            }
          : {}),
    };

    await lab.save();
    clearTenantConfigCache(auth.tenantId);

    return NextResponse.json({
      theme: {
        labName: lab.name,
        tenantId: lab.tenantId,
        subscriptionPlan: lab.subscriptionPlan,
        logo: lab.branding?.logo?.url || null,
        logoAltText: lab.branding?.logo?.altText || `${lab.name} logo`,
        primaryColor: lab.branding?.primaryColor || defaultTheme.primaryColor,
        secondaryColor: lab.branding?.secondaryColor || defaultTheme.secondaryColor,
        accentColor: lab.branding?.accentColor || defaultTheme.accentColor,
        enabledModules: lab.enabledModules?.length ? lab.enabledModules : defaultTheme.enabledModules,
        loginHighlights: lab.branding?.loginHighlights || [],
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Unable to update branding", details: error.message },
      { status: 500 }
    );
  }
}
