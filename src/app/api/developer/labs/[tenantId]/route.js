import { nextJsonError } from "@/app/lib/api-response";
import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { requireDeveloperSession } from "@/app/lib/auth";
import connectMasterDB from "@/app/lib/master-db";
import { hashPassword } from "@/app/lib/password";
import { defaultLabModules, normalizeEnabledModules } from "@/app/lib/modules";
import { clearTenantConfigCache, warmTenantConfigCache } from "@/app/lib/tenant-cache";
import { getLabModel } from "@/app/models/master/Lab";
import { getUserModel } from "@/app/models/tenant/User";
import { buildTenantUrl } from "@/app/lib/subdomain";

const connectionOptions = {
  bufferCommands: false,
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
};

function cleanString(value) {
  return String(value || "").trim();
}

function isContactEmail(value) {
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(cleanString(value));
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

function normalizeEnum(value, fallback, allowedValues) {
  const normalizedValue = cleanString(value).toLowerCase();
  const normalizedFallback = cleanString(fallback).toLowerCase();

  if (allowedValues.includes(normalizedValue)) return normalizedValue;
  if (allowedValues.includes(normalizedFallback)) return normalizedFallback;

  return allowedValues[0];
}

function normalizeOptionalEmail(value) {
  const email = cleanString(value).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function normalizeRequiredName(value, fallback) {
  const name = cleanString(value);
  if (name.length >= 2) return name;

  const fallbackName = cleanString(fallback);
  return fallbackName.length >= 2 ? fallbackName : "Lab";
}

function buildLabLoginUrl(req, tenantId) {
  return buildTenantUrl(tenantId, req.url);
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
    return nextJsonError("Unable to load lab", error, 500);
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

    const name = normalizeRequiredName(body.name, lab.name);
    const rawContactEmail = cleanString(body.contactEmail).toLowerCase();
    const contactEmail = isContactEmail(rawContactEmail) ? rawContactEmail : "";
    const submittedContactPhone = cleanString(body.contactPhone);
    const contactPhone = /^\d{10}$/.test(submittedContactPhone) ? submittedContactPhone : "";
    const rawAdminEmail = cleanString(body.adminEmail).toLowerCase();
    const adminEmail = normalizeOptionalEmail(rawAdminEmail);
    const existingAdminEmail = cleanString(lab.adminAccess?.email).toLowerCase();
    const adminPassword = cleanString(body.adminPassword);
    const adminPasswordConfirm = cleanString(body.adminPasswordConfirm || body.adminConfirmPassword);
    const enabledModules = normalizeEnabledModules(body.enabledModules);
    const loginHighlights = normalizeLoginHighlights(body.loginHighlights);
    const status = normalizeEnum(body.status, lab.status, [
      "pending",
      "active",
      "archived",
    ]);
    const subscriptionPlan = normalizeEnum(body.subscriptionPlan, lab.subscriptionPlan, [
      "trial",
      "basic",
      "professional",
      "enterprise",
    ]);
    const adminEmailChanged = Boolean(rawAdminEmail && rawAdminEmail !== existingAdminEmail);
    const adminPasswordChanged = Boolean(adminPassword);
    if (!rawContactEmail) {
      return NextResponse.json({ error: "Contact email is required" }, { status: 400 });
    }

    if (!contactEmail) {
      return NextResponse.json({ error: "Valid contact email is required" }, { status: 400 });
    }

    if (!submittedContactPhone) {
      return NextResponse.json({ error: "Contact phone is required" }, { status: 400 });
    }

    if (!contactPhone) {
      return NextResponse.json({ error: "Enter a valid 10 digit contact phone" }, { status: 400 });
    }

    if (adminEmailChanged && rawAdminEmail && !adminEmail) {
      return NextResponse.json({ error: "Valid lab admin email is required" }, { status: 400 });
    }

    if (adminPasswordChanged && adminPassword.length < 8) {
      return NextResponse.json(
        { error: "Lab admin password must be at least 8 characters" },
        { status: 400 }
      );
    }

    if (adminPasswordChanged && (!adminPasswordConfirm || adminPassword !== adminPasswordConfirm)) {
      return NextResponse.json(
        { error: "Lab admin password and confirm password must match" },
        { status: 400 }
      );
    }

    if ((adminEmailChanged || adminPasswordChanged) && !adminEmail && !existingAdminEmail) {
      return NextResponse.json(
        { error: "Lab admin email is required before saving admin credentials" },
        { status: 400 }
      );
    }

    if (adminEmailChanged || adminPasswordChanged) {
      let tenantConnection = null;

      try {
        tenantConnection = await mongoose
          .createConnection(lab.dbConnectionString, {
            ...connectionOptions,
            dbName: lab.dbName,
          })
          .asPromise();

        const User = getUserModel(tenantConnection);
        const currentAdminEmail = existingAdminEmail || adminEmail;
        const adminUser = await User.findOne({
          email: currentAdminEmail,
        }).select("+passwordHash");

        if (!adminUser) {
          return NextResponse.json({ error: "Lab admin user not found" }, { status: 404 });
        }

        if (adminEmailChanged) adminUser.email = adminEmail;
        if (adminPasswordChanged) adminUser.passwordHash = await hashPassword(adminPassword);
        adminUser.status = "active";
        adminUser.passwordResetTokenHash = undefined;
        adminUser.passwordResetExpiresAt = undefined;
        await adminUser.save();

        lab.adminAccess = {
          ...(lab.adminAccess || {}),
          email: adminUser.email,
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
      status,
      subscriptionPlan,
      contactName: cleanString(body.contactName),
      contactEmail,
      contactPhone,
      enabledModules,
    });
    lab.set("branding.primaryColor", normalizeColor(body.primaryColor, lab.branding?.primaryColor || "#0d9488"));
    lab.set("branding.secondaryColor", normalizeColor(body.secondaryColor, lab.branding?.secondaryColor || "#0f766e"));
    lab.set("branding.accentColor", normalizeColor(body.accentColor, lab.branding?.accentColor || "#f59e0b"));
    lab.set("branding.loginHighlights", loginHighlights);

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
    if (error?.code === 11000) {
      return nextJsonError("A lab or admin user already uses this value", error, 409);
    }

    if (error?.name === "ValidationError") {
      const details = Object.values(error.errors || {})
        .map((item) => item.message)
        .filter(Boolean)
        .join("; ");

      return nextJsonError(details || "Invalid lab update", error, 400);
    }

    return nextJsonError("Unable to update lab", error, 500);
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

    if (lab.status === "archived") {
      return NextResponse.json({ error: "Lab is already archived" }, { status: 400 });
    }

    lab.status = "archived";
    lab.archivedAt = new Date();
    lab.archivedBy = auth.session.userId;
    await lab.save();
    clearTenantConfigCache(lab.tenantId);

    return NextResponse.json({ ok: true, tenantId: lab.tenantId, status: "archived" });
  } catch (error) {
    return nextJsonError("Unable to archive lab", error, 500);
  }
}
