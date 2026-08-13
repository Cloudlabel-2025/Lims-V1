import { nextJsonError } from "@/app/lib/api-response";
import { cleanString } from "@/app/lib/string-utils";
import { NextResponse } from "next/server";
import { getSessionFromRequest, requireTenantSession } from "@/app/lib/auth";
import { getHostnameFromHeaders, getTenantIdFromRequest } from "@/app/lib/tenant-resolver";
import { defaultLabModules } from "@/app/lib/modules";
import { clearTenantConfigCache, getTenantConfig, warmTenantConfigCache } from "@/app/lib/tenant-cache";

import { getLabSubscriptionEntitlements } from "@/app/lib/subscription-service";

function debugRequestLog(message, details = {}) {
  if (process.env.NODE_ENV === "production" || process.env.DEBUG_REQUESTS === "false") return;
  const detailText = Object.entries(details)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key}=${value}`)
    .join(" ");
  console.log(`[request:theme] ${message}${detailText ? ` ${detailText}` : ""}`);
}

const defaultTheme = {
  labName: "CHC LIMS",
  tenantId: null,
  logo: null,
  logoAltText: "CHC LIMS logo",
  primaryColor: "#0d9488",
  secondaryColor: "#0f766e",
  accentColor: "#f59e0b",
  enabledModules: defaultLabModules,
  loginHighlights: [],
  upiId: "",
};

function getRequestHostname(req) {
  return getHostnameFromHeaders(req.headers);
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const session = getSessionFromRequest(req);
    let tenantId = session?.userType === "tenant" ? session.tenantId : null;
    const hostname = getRequestHostname(req);
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
      host: hostname,
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

    const subscription = await getLabSubscriptionEntitlements(lab.tenantId).catch(() => null);
    const features = subscription?.features || subscription?.entitlements?.features || [];

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
        reportHeader: lab.branding?.reportHeader?.url || null,
        enabledModules: lab.enabledModules?.length ? lab.enabledModules : defaultTheme.enabledModules,
        features,
        subscriptionFeatures: features,
        loginHighlights: lab.branding?.loginHighlights || [],
        upiId: lab.branding?.upiId || "",
        numbering: {
          patientPrefix: lab.numbering?.patientPrefix || "",
          doctorPrefix: lab.numbering?.doctorPrefix || "",
        },
      },
    });
  } catch (error) {
    return nextJsonError("Unable to load theme", error, 500);
  }
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

function normalizeColor(value, fallback) {
  const color = cleanString(value);
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color) ? color : fallback;
}

function normalizeLoginHighlights(value) {
  if (!Array.isArray(value)) return [];

  return [
    ...new Set(
      value
        .map((item) => cleanString(item))
        .filter(Boolean)
        .map((item) => item.slice(0, 80))
    ),
  ].slice(0, 6);
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
    const lab = await Lab.findOne({ tenantId: auth.tenantId }).select("+dbConnectionString");

    if (!lab) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // 1. Lab Name Update
    if (body.labName !== undefined) {
      const name = cleanString(body.labName);
      if (name.length < 2) {
        return NextResponse.json({ error: "Lab Name must be at least 2 characters" }, { status: 400 });
      }
      lab.name = name;
    }

    // 2. Colors Update
    if (body.primaryColor !== undefined) {
      lab.set("branding.primaryColor", normalizeColor(body.primaryColor, lab.branding?.primaryColor || "#0f766e"));
    }
    if (body.secondaryColor !== undefined) {
      lab.set("branding.secondaryColor", normalizeColor(body.secondaryColor, lab.branding?.secondaryColor || "#164e63"));
    }
    if (body.accentColor !== undefined) {
      lab.set("branding.accentColor", normalizeColor(body.accentColor, lab.branding?.accentColor || "#f59e0b"));
    }

    // 3. Login Highlights Update
    if (body.loginHighlights !== undefined) {
      lab.set("branding.loginHighlights", normalizeLoginHighlights(body.loginHighlights));
    }
    if (body.upiId !== undefined) {
      lab.set("branding.upiId", cleanString(body.upiId).trim());
    }

    // 4. Logo Update
    const logoAltText = cleanString(body.logoAltText).slice(0, 120) || `${lab.name} logo`;
    if (body.removeLogo) {
      lab.set("branding.logo", undefined);
    } else if (body.logo) {
      const logo = normalizeLogo(body.logo, logoAltText);
      if (logo) lab.set("branding.logo", logo);
    } else if (body.logoAltText !== undefined) {
      const existingLogo = lab.branding?.logo;
      if (existingLogo) {
        const logoObj = existingLogo.toObject?.() || existingLogo;
        lab.set("branding.logo", { ...logoObj, altText: logoAltText });
      }
    }

    // 5. Report Header Update
    if (body.reportHeader !== undefined) {
      const rh = body.reportHeader;
      if (rh === null) {
        lab.set("branding.reportHeader", undefined);
      } else if (rh && rh.url && rh.publicId) {
        lab.set("branding.reportHeader", {
          url: String(rh.url).trim(),
          storageKey: String(rh.publicId).trim(),
          publicId: String(rh.publicId).trim(),
          originalName: String(rh.originalName || "").trim().slice(0, 180),
          size: Number(rh.size) || undefined,
          mimeType: String(rh.mimeType || "").trim().slice(0, 80),
          altText: String(rh.altText || "").trim().slice(0, 120) || "Report header",
          uploadedAt: rh.uploadedAt ? new Date(rh.uploadedAt) : new Date(),
        });
      }
    }

    // 6. Numbering prefixes Update
    if (body.numbering !== undefined) {
      const pPrefix = cleanString(body.numbering?.patientPrefix).toUpperCase();
      const dPrefix = cleanString(body.numbering?.doctorPrefix).toUpperCase();

      if (pPrefix && !/^[A-Z0-9-]{1,10}$/.test(pPrefix)) {
        return NextResponse.json({ error: "Patient Prefix must be 1-10 alphanumeric characters or dash" }, { status: 400 });
      }
      if (dPrefix && !/^[A-Z0-9-]{1,10}$/.test(dPrefix)) {
        return NextResponse.json({ error: "Doctor Prefix must be 1-10 alphanumeric characters or dash" }, { status: 400 });
      }

      lab.numbering = {
        patientPrefix: pPrefix || undefined,
        doctorPrefix: dPrefix || undefined,
      };
    }

    await lab.save();
    clearTenantConfigCache(auth.tenantId);

    // Warm tenant config cache so current session and styles immediately pick it up
    warmTenantConfigCache({
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
        reportHeader: lab.branding?.reportHeader?.url || null,
        enabledModules: lab.enabledModules?.length ? lab.enabledModules : defaultTheme.enabledModules,
        loginHighlights: lab.branding?.loginHighlights || [],
        upiId: lab.branding?.upiId || "",
        numbering: {
          patientPrefix: lab.numbering?.patientPrefix || "",
          doctorPrefix: lab.numbering?.doctorPrefix || "",
        },
      },
    });
  } catch (error) {
    return nextJsonError("Unable to update branding", error, 500);
  }
}
