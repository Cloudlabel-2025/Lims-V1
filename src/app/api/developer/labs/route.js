import { nextJsonError } from "@/app/lib/api-response";
import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { requireDeveloperSession } from "@/app/lib/auth";
import connectMasterDB from "@/app/lib/master-db";
import { seedSystemChartOfAccounts } from "@/app/lib/accounting";
import { hashPassword } from "@/app/lib/password";
import { getDoctorModel } from "@/app/models/tenant/Doctor";
import { getLabModel } from "@/app/models/master/Lab";
import { getTenantDomainModel } from "@/app/models/master/TenantDomain";
import { getPatientModel } from "@/app/models/tenant/Patient";
import { getRoleTemplateModel } from "@/app/models/master/RoleTemplate";
import { getAccountModel } from "@/app/models/tenant/Account";
import { getAuditLogModel } from "@/app/models/tenant/AuditLog";
import { getBillingRecordModel } from "@/app/models/tenant/BillingRecord";
import { getCorporateAccountModel } from "@/app/models/tenant/CorporateAccount";
import { getExpenseEntryModel } from "@/app/models/tenant/ExpenseEntry";
import { getInventoryCategoryModel } from "@/app/models/tenant/InventoryCategory";
import { getInventoryItemModel } from "@/app/models/tenant/InventoryItem";
import { getInventoryMovementModel } from "@/app/models/tenant/InventoryMovement";
import { getInventoryUomModel } from "@/app/models/tenant/InventoryUom";
import { getJournalEntryModel } from "@/app/models/tenant/JournalEntry";
import { getPaymentReceiptModel } from "@/app/models/tenant/PaymentReceipt";
import { getRoleModel } from "@/app/models/tenant/Role";
import { getSampleModel } from "@/app/models/tenant/Sample";
import { getTestCategoryModel } from "@/app/models/tenant/TestCategory";
import { getTestDefinitionModel } from "@/app/models/tenant/TestDefinition";
import { getTestReportModel } from "@/app/models/tenant/TestReport";
import { getUserModel } from "@/app/models/tenant/User";
import { defaultLabModules, normalizeEnabledModules } from "@/app/lib/modules";
import { clearTenantConfigCache, warmTenantConfigCache } from "@/app/lib/tenant-cache";
import { buildTenantUrl } from "@/app/lib/subdomain";
import {
  isPlatformDomain,
  isValidCustomDomain,
  normalizeCustomDomain,
} from "@/app/lib/domain-utils";
import { createTenantDomain } from "@/app/lib/domain-management";

export const maxDuration = 60;

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

function normalizeCustomDomains(value) {
  if (!Array.isArray(value)) return [];

  const domains = [];
  const seen = new Set();

  for (const item of value) {
    const domainName = normalizeCustomDomain(
      typeof item === "string" ? item : item?.domainName
    );
    if (!domainName || seen.has(domainName)) continue;
    seen.add(domainName);
    domains.push(domainName);
  }

  return domains.slice(0, 5);
}

function serializeCustomDomain(domain) {
  return {
    id: domain._id,
    domainName: domain.domainName,
    verificationStatus: domain.verificationStatus,
    sslStatus: domain.sslStatus,
    dnsHealthStatus: domain.dnsHealthStatus,
    dnsRecords: domain.dnsRecords || [],
    createdAt: domain.createdAt,
    updatedAt: domain.updatedAt,
  };
}

function serializeTenantDomain(domain) {
  return {
    id: domain._id,
    domainName: domain.domain,
    domain: domain.domain,
    isPrimary: domain.isPrimary,
    status: domain.status,
    verificationStatus: domain.status === "active" ? "verified" : domain.status,
    sslStatus: domain.sslStatus,
    dnsHealthStatus: domain.dnsStatus,
    dnsStatus: domain.dnsStatus,
    dnsVerified: domain.dnsVerified,
    sslIssued: domain.sslIssued,
    dnsRecords: domain.dnsRecords || [],
    createdAt: domain.createdAt,
    updatedAt: domain.updatedAt,
  };
}

function buildLabLoginUrl(req, tenantId) {
  return buildTenantUrl(tenantId, req.url);
}

async function initializeTenantCollections(tenantConnection) {
  await Promise.all([
    getAccountModel(tenantConnection).init(),
    getAuditLogModel(tenantConnection).init(),
    getCorporateAccountModel(tenantConnection).init(),
    getExpenseEntryModel(tenantConnection).init(),
    getInventoryCategoryModel(tenantConnection).init(),
    getInventoryItemModel(tenantConnection).init(),
    getInventoryMovementModel(tenantConnection).init(),
    getInventoryUomModel(tenantConnection).init(),
    getJournalEntryModel(tenantConnection).init(),
    getPaymentReceiptModel(tenantConnection).init(),
    getRoleModel(tenantConnection).init(),
    getTestCategoryModel(tenantConnection).init(),
    getTestDefinitionModel(tenantConnection).init(),
    getTestReportModel(tenantConnection).init(),
    getUserModel(tenantConnection).init(),
    getPatientModel(tenantConnection).init(),
    getBillingRecordModel(tenantConnection).init(),
    getDoctorModel(tenantConnection).init(),
    getSampleModel(tenantConnection).init(),
  ]);
}

function getCreateLabFailureDetails(error, stage) {
  const message = error?.message || "Unknown error";

  if (error?.code === 11000) {
    return `${stage}: duplicate database value. Try a different lab name and tenant ID.`;
  }

  if (message.includes("querySrv") || error?.code === "ETIMEOUT") {
    return `${stage}: MongoDB DNS lookup timed out. Check Atlas network access and the MongoDB URI.`;
  }

  if (message.includes("No active role templates")) {
    return `${stage}: RBAC role templates are missing. Run the RBAC seed against the production database.`;
  }

  if (message.includes("Default admin role template")) {
    return `${stage}: default admin role template is missing. Run the RBAC seed against the production database.`;
  }

  if (message.includes("Tenant database connection string")) {
    return `${stage}: tenant database connection string is not configured. Check MONGODB_URI or TENANT_MONGODB_URI.`;
  }

  return `${stage}: ${message}`;
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
    const TenantDomain = getTenantDomainModel(masterConnection);
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
        customDomains: 1,
        enabledModules: 1,
        createdAt: 1,
      });
    const tenantDomains = await TenantDomain.find({
      tenantId: { $in: labs.map((lab) => lab.tenantId) },
    })
      .sort({ isPrimary: -1, createdAt: -1 })
      .lean();
    const domainsByTenant = tenantDomains.reduce((groups, domain) => {
      const list = groups.get(domain.tenantId) || [];
      list.push(serializeTenantDomain(domain));
      groups.set(domain.tenantId, list);
      return groups;
    }, new Map());

    return NextResponse.json({
      labs: labs.map((lab) => {
        const tenantDomainList = domainsByTenant.get(lab.tenantId) || [];
        return {
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
          defaultDomain: (() => {
            try {
              return new URL(buildLabLoginUrl(req, lab.tenantId)).host;
            } catch {
              return "";
            }
          })(),
          customDomains: tenantDomainList.length
            ? tenantDomainList
            : (lab.customDomains || []).map(serializeCustomDomain),
          enabledModules: lab.enabledModules?.length ? lab.enabledModules : defaultLabModules,
          loginUrl: buildLabLoginUrl(req, lab.tenantId),
          createdAt: lab.createdAt,
        };
      }),
    });
  } catch (error) {
    return nextJsonError("Unable to load labs", error, 500);
  }
}

export async function POST(req) {
  let tenantConnection = null;
  let createdLab = null;
  let stage = "starting";

  try {
    stage = "checking developer session";
    const auth = requireDeveloperSession(req);
    if (auth.error) return auth.error;

    stage = "reading request";
    const body = await req.json();
    const name = cleanString(body.name);
    const tenantId = normalizeTenantId(body.tenantId);
    const adminEmail = cleanString(body.adminEmail).toLowerCase();
    const adminPassword = String(body.adminPassword || "");
    const adminPasswordConfirm = String(body.adminPasswordConfirm || body.adminConfirmPassword || "");
    const enabledModules = normalizeEnabledModules(body.enabledModules);
    const loginHighlights = normalizeLoginHighlights(body.loginHighlights);
    const customDomains = normalizeCustomDomains(body.customDomains);
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

    for (const domainName of customDomains) {
      if (!isValidCustomDomain(domainName)) {
        return NextResponse.json(
          { error: `Enter a valid custom domain: ${domainName}` },
          { status: 400 }
        );
      }

      if (isPlatformDomain(domainName)) {
        return NextResponse.json(
          { error: "Use customer-owned domains only. Platform domains are already handled by tenant ID." },
          { status: 400 }
        );
      }
    }

    stage = "connecting master database";
    const masterConnection = await connectMasterDB();
    const Lab = getLabModel(masterConnection);
    const TenantDomain = getTenantDomainModel(masterConnection);
    stage = "checking existing tenant";
    const existingLab = await Lab.findOne({ tenantId }).select("tenantId status name").lean();

    if (existingLab) {
      if (existingLab.status === "archived") {
        return NextResponse.json(
          { error: `Tenant ID "${tenantId}" belongs to a deleted lab (${existingLab.name}). Tenant IDs are permanently reserved and cannot be reused. Choose a different tenant ID.` },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: `Tenant ID "${tenantId}" is already in use by lab "${existingLab.name}". Choose a different tenant ID.` },
        { status: 409 }
      );
    }

    if (customDomains.length > 0) {
      stage = "checking existing custom domains";
      const [existingRegisteredDomain, existingEmbeddedDomain] = await Promise.all([
        TenantDomain.findOne({ domain: { $in: customDomains } }).select("domain tenantId").lean(),
        Lab.findOne({
          "customDomains.domainName": { $in: customDomains },
        }).select("name customDomains.domainName"),
      ]);

      if (existingRegisteredDomain || existingEmbeddedDomain) {
        return NextResponse.json(
          { error: "One of these custom domains is already connected to another lab" },
          { status: 409 }
        );
      }
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

    stage = "checking existing tenant database";
    const existingDbName = await Lab.findOne({ dbName });

    if (existingDbName) {
      return NextResponse.json(
        { error: "A tenant database with this lab name already exists" },
        { status: 409 }
      );
    }

    stage = "creating lab metadata";
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

    stage = "connecting tenant database";
    tenantConnection = await mongoose
      .createConnection(dbConnectionString, {
        ...connectionOptions,
        dbName,
      })
      .asPromise();

    stage = "initializing tenant collections";
    await initializeTenantCollections(tenantConnection);
    stage = "creating tenant roles";
    const adminRole = await createTenantRoles(masterConnection, tenantConnection);
    stage = "seeding chart of accounts";
    await seedSystemChartOfAccounts(tenantConnection, tenantId);

    stage = "creating lab admin";
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

    stage = "saving lab admin access";
    lab.adminAccess = {
      email: adminUser.email,
      updatedAt: new Date(),
    };
    await lab.save();

    stage = "warming tenant cache";
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

    stage = "creating custom domains";
    const createdDomains = [];
    const domainSetupErrors = [];
    for (const domainName of customDomains) {
      try {
        const result = await createTenantDomain(masterConnection, lab, domainName, auth.session.userId);
        if (result.error) {
          domainSetupErrors.push({ domainName, error: result.error });
        } else if (result.domain) {
          createdDomains.push(result.domain);
        }
      } catch (domainError) {
        domainSetupErrors.push({
          domainName,
          error: domainError.message || "Unable to start domain mapping",
        });
      }
    }

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
          customDomains: createdDomains,
          domainSetupErrors,
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
    console.error("POST /api/developer/labs error:", {
      stage,
      name: error?.name,
      code: error?.code,
      message: error?.message,
    });

    if (createdLab) {
      await createdLab.deleteOne().catch(() => {});
    }

    return NextResponse.json(
      {
        error: "Unable to create lab",
        details: getCreateLabFailureDetails(error, stage),
      },
      { status: 500 }
    );
  } finally {
    if (tenantConnection) {
      await tenantConnection.close();
    }
  }
}
