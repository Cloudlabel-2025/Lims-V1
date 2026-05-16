import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { requireDeveloperSession } from "@/app/lib/auth";
import connectMasterDB from "@/app/lib/master-db";
import { hashPassword } from "@/app/lib/password";
import { getDoctorModel } from "@/app/models/doctor";
import { getLabModel } from "@/app/models/master/Lab";
import { getPatientModel } from "@/app/models/patient";
import { getRoleTemplateModel } from "@/app/models/master/RoleTemplate";
import { getBillingRecordModel } from "@/app/models/tenant/BillingRecord";
import { getRoleModel } from "@/app/models/tenant/Role";
import { getSampleModel } from "@/app/models/tenant/Sample";
import { getTestCategoryModel } from "@/app/models/tenant/TestCategory";
import { getTestDefinitionModel } from "@/app/models/tenant/TestDefinition";
import { getTestReportModel } from "@/app/models/tenant/TestReport";
import { getUserModel } from "@/app/models/tenant/User";
import { getVisitModel } from "@/app/models/visit";
import { defaultLabModules, normalizeEnabledModules } from "@/app/lib/modules";
import { clearTenantConfigCache, warmTenantConfigCache } from "@/app/lib/tenant-cache";
import { buildTenantUrl } from "@/app/lib/subdomain";

const tenantIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const connectionOptions = {
  bufferCommands: false,
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
};

function cleanString(value) {
  return String(value || "").trim();
}

function normalizeTenantId(value) {
  return cleanString(value).toLowerCase();
}

function normalizeDbName(value) {
  return cleanString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

function buildDefaultDbName(labName) {
  const normalizedName = normalizeDbName(labName);
  return normalizedName || "lab";
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

function normalizeLogoUrl(value) {
  const logoUrl = cleanString(value);
  if (!logoUrl) return "";

  try {
    const url = new URL(logoUrl);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    return url.toString();
  } catch {
    return "";
  }
}

function normalizeCloudinaryLogo(value, fallbackAltText) {
  if (!value || typeof value !== "object") return null;

  const url = normalizeLogoUrl(value.url);
  const publicId = cleanString(value.publicId);
  if (!url || !publicId) return null;

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

function buildLabLoginUrl(req, tenantId) {
  return buildTenantUrl(tenantId, req.url);
}

async function initializeTenantCollections(tenantConnection) {
  await Promise.all([
    getRoleModel(tenantConnection).init(),
    getTestCategoryModel(tenantConnection).init(),
    getTestDefinitionModel(tenantConnection).init(),
    getTestReportModel(tenantConnection).init(),
    getUserModel(tenantConnection).init(),
    getPatientModel(tenantConnection).init(),
    getBillingRecordModel(tenantConnection).init(),
    getDoctorModel(tenantConnection).init(),
    getSampleModel(tenantConnection).init(),
    getVisitModel(tenantConnection).init(),
  ]);
}

async function createTenantRoles(masterConnection, tenantConnection) {
  const RoleTemplate = getRoleTemplateModel(masterConnection);
  const Role = getRoleModel(tenantConnection);
  const templates = await RoleTemplate.find({ isActive: true }).sort({ sortOrder: 1, name: 1 });

  if (templates.length === 0) {
    throw new Error("No active role templates found. Run seed-rbac first.");
  }

  let adminRole = null;

  for (const template of templates) {
    let role = await Role.findOne({ name: template.name });
    const roleData = {
      name: template.name,
      description: template.description,
      permissions: template.permissions,
      isDefaultAdmin: template.isDefaultAdmin,
      isSystemRole: template.isSystemTemplate,
      status: "active",
    };

    if (role) {
      role.set(roleData);
      await role.save();
    } else {
      role = await Role.create(roleData);
    }

    if (role.isDefaultAdmin) adminRole = role;
  }

  if (!adminRole) {
    throw new Error("Default admin role template not found.");
  }

  return adminRole;
}

export async function GET(req) {
  try {
    const auth = requireDeveloperSession(req);
    if (auth.error) return auth.error;

    const masterConnection = await connectMasterDB();
    const Lab = getLabModel(masterConnection);
    const labs = await Lab.find({})
      .sort({ createdAt: -1 })
      .select({
        labId: 1,
        name: 1,
        tenantId: 1,
        dbName: 1,
        status: 1,
        subscriptionPlan: 1,
        contactEmail: 1,
        contactPhone: 1,
        "adminAccess.email": 1,
        branding: 1,
        enabledModules: 1,
        createdAt: 1,
      });

    return NextResponse.json({
      labs: labs.map((lab) => ({
        id: lab._id,
        labId: lab.labId,
        name: lab.name,
        tenantId: lab.tenantId,
        dbName: lab.dbName,
        status: lab.status,
        subscriptionPlan: lab.subscriptionPlan,
        contactEmail: lab.contactEmail,
        contactPhone: lab.contactPhone,
        adminEmail: lab.adminAccess?.email || "",
        primaryColor: lab.branding?.primaryColor,
        logoUrl: lab.branding?.logo?.url || null,
        loginHighlights: lab.branding?.loginHighlights || [],
        enabledModules: lab.enabledModules?.length ? lab.enabledModules : defaultLabModules,
        loginUrl: buildLabLoginUrl(req, lab.tenantId),
        createdAt: lab.createdAt,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Unable to load labs", details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  let tenantConnection = null;
  let createdLab = null;

  try {
    const auth = requireDeveloperSession(req);
    if (auth.error) return auth.error;

    const body = await req.json();
    const name = cleanString(body.name);
    const tenantId = normalizeTenantId(body.tenantId);
    const adminEmail = cleanString(body.adminEmail).toLowerCase();
    const adminPassword = String(body.adminPassword || "");
    const adminPasswordConfirm = String(body.adminPasswordConfirm || body.adminConfirmPassword || "");
    const enabledModules = normalizeEnabledModules(body.enabledModules);
    const loginHighlights = normalizeLoginHighlights(body.loginHighlights);
    const logoAltText = cleanString(body.logoAltText).slice(0, 120) || `${name} logo`;
    const logo = normalizeCloudinaryLogo(body.logo, logoAltText);

    if (!name || name.length < 2) {
      return NextResponse.json({ error: "Lab name is required" }, { status: 400 });
    }

    if (!tenantIdPattern.test(tenantId)) {
      return NextResponse.json(
        { error: "Tenant ID must use lowercase letters, numbers, and hyphens" },
        { status: 400 }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
      return NextResponse.json({ error: "Valid lab admin email is required" }, { status: 400 });
    }

    if (adminPassword.length < 8) {
      return NextResponse.json(
        { error: "Lab admin password must be at least 8 characters" },
        { status: 400 }
      );
    }

    if (!adminPasswordConfirm || adminPassword !== adminPasswordConfirm) {
      return NextResponse.json(
        { error: "Lab admin password and confirm password must match" },
        { status: 400 }
      );
    }

    const masterConnection = await connectMasterDB();
    const Lab = getLabModel(masterConnection);
    const existingLab = await Lab.findOne({ tenantId });

    if (existingLab) {
      return NextResponse.json(
        { error: "A lab with this tenant ID already exists" },
        { status: 409 }
      );
    }

    const masterUri = process.env.MASTER_MONGODB_URI || process.env.MONGODB_URI;
    const dbConnectionString = cleanString(body.dbConnectionString) || process.env.TENANT_MONGODB_URI || masterUri;
    const dbName = normalizeDbName(body.dbName) || buildDefaultDbName(name);

    if (!dbConnectionString) {
      return NextResponse.json(
        { error: "Tenant database connection string is not configured" },
        { status: 500 }
      );
    }

    const existingDbName = await Lab.findOne({ dbName });

    if (existingDbName) {
      return NextResponse.json(
        { error: "A tenant database with this lab name already exists" },
        { status: 409 }
      );
    }

    const lab = await Lab.create({
      name,
      tenantId,
      dbName,
      dbConnectionString,
      status: "active",
      subscriptionPlan: body.subscriptionPlan || "trial",
      enabledModules,
      contactName: cleanString(body.contactName),
      contactEmail: cleanString(body.contactEmail).toLowerCase(),
      contactPhone: cleanString(body.contactPhone),
      branding: {
        logo: logo || undefined,
        primaryColor: body.primaryColor || "#0d9488",
        secondaryColor: body.secondaryColor || "#0f766e",
        accentColor: body.accentColor || "#f59e0b",
        loginHighlights,
      },
      createdBy: auth.session.userId,
    });
    createdLab = lab;
    clearTenantConfigCache(tenantId);

    tenantConnection = await mongoose
      .createConnection(dbConnectionString, {
        ...connectionOptions,
        dbName,
      })
      .asPromise();

    await initializeTenantCollections(tenantConnection);
    const adminRole = await createTenantRoles(masterConnection, tenantConnection);

    const User = getUserModel(tenantConnection);
    const passwordHash = await hashPassword(adminPassword);
    const adminFirstName = cleanString(body.adminFirstName) || "Lab";
    const adminLastName = cleanString(body.adminLastName) || "Admin";
    const existingAdmin = await User.findOne({ email: adminEmail }).select("+passwordHash");
    let adminUser = existingAdmin;

    if (existingAdmin) {
      existingAdmin.set({
        firstName: adminFirstName,
        lastName: adminLastName,
        passwordHash,
        role: adminRole._id,
        status: "active",
        passwordResetTokenHash: undefined,
        passwordResetExpiresAt: undefined,
      });
      await existingAdmin.save();
    } else {
      adminUser = await User.create({
        firstName: adminFirstName,
        lastName: adminLastName,
        email: adminEmail,
        passwordHash,
        role: adminRole._id,
        status: "active",
      });
    }

    lab.adminAccess = {
      email: adminUser.email,
      updatedAt: new Date(),
    };
    await lab.save();

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

    return NextResponse.json(
      {
        lab: {
          id: lab._id,
          labId: lab.labId,
          name: lab.name,
          tenantId: lab.tenantId,
          dbName: lab.dbName,
          status: lab.status,
          subscriptionPlan: lab.subscriptionPlan,
          enabledModules,
          loginHighlights,
          logoUrl: logo?.url || null,
          adminEmail: adminUser.email,
          adminPassword,
        },
        admin: {
          email: adminEmail,
          password: adminPassword,
          firstName: adminFirstName,
          lastName: adminLastName,
        },
        loginUrl: buildLabLoginUrl(req, tenantId),
      },
      { status: 201 }
    );
  } catch (error) {
    if (createdLab) {
      await createdLab.deleteOne().catch(() => {});
    }

    return NextResponse.json(
      { error: "Unable to create lab", details: error.message },
      { status: 500 }
    );
  } finally {
    if (tenantConnection) {
      await tenantConnection.close();
    }
  }
}
