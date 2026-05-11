import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { requireDeveloperSession } from "@/app/lib/auth";
import connectMasterDB from "@/app/lib/master-db";
import { hashPassword } from "@/app/lib/password";
import { defaultLabModules, normalizeEnabledModules } from "@/app/lib/modules";
import { clearTenantConfigCache, warmTenantConfigCache } from "@/app/lib/tenant-cache";
import { getLabModel } from "@/app/models/master/Lab";
import { getUserModel } from "@/app/models/tenant/User";

const connectionOptions = {
  bufferCommands: false,
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
};

function cleanString(value) {
  return String(value || "").trim();
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

function normalizeColor(value, fallback) {
  const color = cleanString(value);
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color) ? color : fallback;
}

function buildLabLoginUrl(req, tenantId) {
  const url = new URL(req.url);
  const rootDomain = cleanString(process.env.ROOT_DOMAIN)
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .toLowerCase();

  if (rootDomain) {
    const protocol = cleanString(process.env.PUBLIC_APP_PROTOCOL || "https").replace(/:$/, "");
    url.protocol = `${protocol}:`;
    url.host = `${tenantId}.${rootDomain}`;
    url.port = "";
    url.pathname = "/";
    url.search = "";
    return url.toString();
  }

  url.pathname = "/";
  url.search = "";
  url.searchParams.set("tenantId", tenantId);
  url.searchParams.set("access", "lab");
  return url.toString();
}

function serializeLab(lab, req) {
  return {
    id: String(lab._id),
    labId: lab.labId,
    name: lab.name,
    tenantId: lab.tenantId,
    dbName: lab.dbName,
    status: lab.status,
    subscriptionPlan: lab.subscriptionPlan,
    contactName: lab.contactName || "",
    contactEmail: lab.contactEmail || "",
    contactPhone: lab.contactPhone || "",
    adminEmail: lab.adminAccess?.email || "",
    adminPassword: lab.adminAccess?.password || "",
    primaryColor: lab.branding?.primaryColor || "#0d9488",
    secondaryColor: lab.branding?.secondaryColor || "#0f766e",
    accentColor: lab.branding?.accentColor || "#f59e0b",
    logoUrl: lab.branding?.logo?.url || null,
    logoAltText: lab.branding?.logo?.altText || `${lab.name} logo`,
    loginHighlights: lab.branding?.loginHighlights || [],
    enabledModules: lab.enabledModules?.length ? lab.enabledModules : defaultLabModules,
    loginUrl: buildLabLoginUrl(req, lab.tenantId),
    createdAt: lab.createdAt,
    updatedAt: lab.updatedAt,
  };
}

async function getLabById(req, params) {
  const { tenantId } = await params;
  const labId = cleanString(tenantId);
  const masterConnection = await connectMasterDB();
  const Lab = getLabModel(masterConnection);
  const query = mongoose.Types.ObjectId.isValid(labId)
    ? { _id: labId }
    : { tenantId: labId.toLowerCase() };
  const lab = await Lab.findOne(query).select({
    dbConnectionString: 1,
    labId: 1,
    name: 1,
    tenantId: 1,
    dbName: 1,
    status: 1,
    subscriptionPlan: 1,
    contactName: 1,
    contactEmail: 1,
    contactPhone: 1,
    "adminAccess.email": 1,
    "adminAccess.password": 1,
    branding: 1,
    enabledModules: 1,
    createdAt: 1,
    updatedAt: 1,
  });

  return { lab, masterConnection };
}

export async function GET(req, context) {
  try {
    const auth = requireDeveloperSession(req);
    if (auth.error) return auth.error;

    const { lab } = await getLabById(req, context.params);
    if (!lab) {
      return NextResponse.json({ error: "Lab not found" }, { status: 404 });
    }

    return NextResponse.json({ lab: serializeLab(lab, req) });
  } catch (error) {
    return NextResponse.json(
      { error: "Unable to load lab", details: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(req, context) {
  try {
    const auth = requireDeveloperSession(req);
    if (auth.error) return auth.error;

    const body = await req.json();
    const { lab } = await getLabById(req, context.params);
    if (!lab) {
      return NextResponse.json({ error: "Lab not found" }, { status: 404 });
    }

    const name = cleanString(body.name);
    const contactEmail = cleanString(body.contactEmail).toLowerCase();
    const contactPhone = cleanString(body.contactPhone);
    const adminEmail = cleanString(body.adminEmail).toLowerCase();
    const adminPassword = String(body.adminPassword || "");
    const enabledModules = normalizeEnabledModules(body.enabledModules);
    const loginHighlights = normalizeLoginHighlights(body.loginHighlights);

    if (!name || name.length < 2) {
      return NextResponse.json({ error: "Lab name is required" }, { status: 400 });
    }

    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      return NextResponse.json({ error: "Valid contact email is required" }, { status: 400 });
    }

    if (contactPhone && !/^\d{10}$/.test(contactPhone)) {
      return NextResponse.json(
        { error: "Contact phone must be exactly 10 digits" },
        { status: 400 }
      );
    }

    if (adminEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
      return NextResponse.json({ error: "Valid lab admin email is required" }, { status: 400 });
    }

    if (adminPassword && adminPassword.length < 8) {
      return NextResponse.json(
        { error: "Lab admin password must be at least 8 characters" },
        { status: 400 }
      );
    }

    if ((adminEmail || adminPassword) && !adminEmail && !lab.adminAccess?.email) {
      return NextResponse.json(
        { error: "Lab admin email is required before saving admin credentials" },
        { status: 400 }
      );
    }

    if (adminEmail || adminPassword) {
      let tenantConnection = null;

      try {
        tenantConnection = await mongoose
          .createConnection(lab.dbConnectionString, {
            ...connectionOptions,
            dbName: lab.dbName,
          })
          .asPromise();

        const User = getUserModel(tenantConnection);
        const currentAdminEmail = lab.adminAccess?.email || adminEmail;
        const adminUser = await User.findOne({
          email: currentAdminEmail,
        }).select("+passwordHash");

        if (!adminUser) {
          return NextResponse.json({ error: "Lab admin user not found" }, { status: 404 });
        }

        if (adminEmail) adminUser.email = adminEmail;
        if (adminPassword) adminUser.passwordHash = await hashPassword(adminPassword);
        adminUser.status = "active";
        adminUser.passwordResetTokenHash = undefined;
        adminUser.passwordResetExpiresAt = undefined;
        await adminUser.save();

        lab.adminAccess = {
          ...(lab.adminAccess || {}),
          email: adminUser.email,
          ...(adminPassword ? { password: adminPassword } : {}),
          updatedAt: new Date(),
        };
      } finally {
        if (tenantConnection) {
          await tenantConnection.close();
        }
      }
    }

    lab.set({
      name,
      status: body.status || lab.status,
      subscriptionPlan: body.subscriptionPlan || lab.subscriptionPlan,
      contactName: cleanString(body.contactName),
      contactEmail,
      contactPhone,
      enabledModules,
      branding: {
        ...(lab.branding || {}),
        primaryColor: normalizeColor(body.primaryColor, lab.branding?.primaryColor || "#0d9488"),
        secondaryColor: normalizeColor(body.secondaryColor, lab.branding?.secondaryColor || "#0f766e"),
        accentColor: normalizeColor(body.accentColor, lab.branding?.accentColor || "#f59e0b"),
        loginHighlights,
      },
    });

    await lab.save();
    clearTenantConfigCache(lab.tenantId);
    warmTenantConfigCache({
      id: String(lab._id),
      labId: lab.labId,
      tenantId: lab.tenantId,
      name: lab.name,
      status: lab.status,
      dbName: lab.dbName,
      dbConnectionString: lab.dbConnectionString,
      subscriptionPlan: lab.subscriptionPlan,
      enabledModules,
      branding: lab.branding || {},
    });

    return NextResponse.json({ lab: serializeLab(lab, req) });
  } catch (error) {
    return NextResponse.json(
      { error: "Unable to update lab", details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(req, context) {
  try {
    const auth = requireDeveloperSession(req);
    if (auth.error) return auth.error;

    const { lab } = await getLabById(req, context.params);
    if (!lab) {
      return NextResponse.json({ error: "Lab not found" }, { status: 404 });
    }

    const tenantId = lab.tenantId;
    await lab.deleteOne();
    clearTenantConfigCache(tenantId);

    return NextResponse.json({ ok: true, tenantId });
  } catch (error) {
    return NextResponse.json(
      { error: "Unable to delete lab", details: error.message },
      { status: 500 }
    );
  }
}
