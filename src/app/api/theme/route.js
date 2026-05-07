import { NextResponse } from "next/server";
import connectMasterDB from "@/app/lib/master-db";
import { getLabModel } from "@/app/models/master/Lab";
import { getSessionFromRequest, requireTenantSession } from "@/app/lib/auth";
import { getTenantIdFromRequest } from "@/app/lib/tenant-resolver";
import { defaultLabModules } from "@/app/lib/modules";
import { clearTenantConfigCache, getTenantConfig } from "@/app/lib/tenant-cache";

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

    if (!tenantId) {
      try {
        tenantId = getTenantIdFromRequest(req);
      } catch {
        tenantId = searchParams.get("tenantId");
      }
    }

    if (!tenantId) {
      return NextResponse.json({ theme: defaultTheme });
    }

    const lab = await getTenantConfig(tenantId);
    if (!lab) {
      return NextResponse.json({ theme: defaultTheme });
    }

    if (lab.status === "suspended") {
      return NextResponse.json({ error: "Tenant is suspended" }, { status: 423 });
    }

    if (lab.status !== "active") {
      return NextResponse.json({ error: "Tenant is not active" }, { status: 403 });
    }

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

function normalizeColor(value, fallback) {
  const color = cleanString(value);
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color) ? color : fallback;
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
    const auth = requireTenantSession(req, "settings.manage");
    if (auth.error) return auth.error;

    const body = await req.json();
    const masterConnection = await connectMasterDB();
    const Lab = getLabModel(masterConnection);
    const lab = await Lab.findOne({ tenantId: auth.tenantId });

    if (!lab) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const logoAltText = cleanString(body.logoAltText).slice(0, 120) || `${lab.name} logo`;
    const logo = normalizeLogo(body.logo, logoAltText);

    lab.branding = {
      ...(lab.branding || {}),
      ...(logo ? { logo } : {}),
      primaryColor: normalizeColor(body.primaryColor, lab.branding?.primaryColor || defaultTheme.primaryColor),
      secondaryColor: normalizeColor(body.secondaryColor, lab.branding?.secondaryColor || defaultTheme.secondaryColor),
      accentColor: normalizeColor(body.accentColor, lab.branding?.accentColor || defaultTheme.accentColor),
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
      { error: "Unable to update theme", details: error.message },
      { status: 500 }
    );
  }
}
