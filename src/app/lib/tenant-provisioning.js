import mongoose from "mongoose";
import connectMasterDB from "@/app/lib/master-db";
import { seedSystemChartOfAccounts } from "@/app/lib/accounting";
import { clearTenantConfigCache, warmTenantConfigCache } from "@/app/lib/tenant-cache";
import { defaultLabModules } from "@/app/lib/modules";
import { getDoctorModel } from "@/app/models/tenant/Doctor";
import { getPatientModel } from "@/app/models/tenant/Patient";
import { getLabModel } from "@/app/models/master/Lab";
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
import { slugifySubdomain, validateSubdomain } from "@/app/lib/subdomain";

const connectionOptions = {
  bufferCommands: false,
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
};

function cleanString(value) {
  return String(value || "").trim();
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

export async function isSubdomainAvailable(subdomain) {
  const validation = validateSubdomain(subdomain);
  if (!validation.valid) return false;

  const masterConnection = await connectMasterDB();
  const Lab = getLabModel(masterConnection);
  const existingLab = await Lab.exists({ tenantId: validation.subdomain });

  return !existingLab;
}

export async function getAvailableSubdomain(baseValue) {
  const base = slugifySubdomain(baseValue);
  const validation = validateSubdomain(base);
  const fallbackBase = validation.valid ? validation.subdomain : "lab";

  if (await isSubdomainAvailable(fallbackBase)) {
    return fallbackBase;
  }

  for (let index = 1; index <= 100; index += 1) {
    const candidate = `${fallbackBase}-${index}`;
    if (await isSubdomainAvailable(candidate)) {
      return candidate;
    }
  }

  throw new Error("Unable to find an available subdomain");
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

async function createTenantRoles(masterConnection, tenantConnection) {
  const RoleTemplate = getRoleTemplateModel(masterConnection);
  const Role = getRoleModel(tenantConnection);
  const templates = await RoleTemplate.find({ isActive: true }).sort({ sortOrder: 1, name: 1 });

  if (templates.length === 0) {
    throw new Error("No active role templates found. Run seed-rbac first.");
  }

  for (const template of templates) {
    await Role.findOneAndUpdate(
      { name: template.name },
      {
        name: template.name,
        description: template.description,
        permissions: template.permissions,
        isDefaultAdmin: template.isDefaultAdmin,
        isSystemRole: template.isSystemTemplate,
        status: "active",
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
  }
}

export async function createTenant({ name, subdomain, createdBy }) {
  const labName = cleanString(name);
  const validation = validateSubdomain(subdomain);

  if (!labName || labName.length < 2) {
    throw new Error("Lab name is required");
  }

  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const masterConnection = await connectMasterDB();
  const Lab = getLabModel(masterConnection);
  const existingLab = await Lab.findOne({ tenantId: validation.subdomain }).select("tenantId");

  if (existingLab) {
    const suggestion = await getAvailableSubdomain(validation.subdomain);
    const error = new Error("Subdomain is already taken");
    error.code = "SUBDOMAIN_TAKEN";
    error.suggestion = suggestion;
    throw error;
  }

  const masterUri = process.env.MASTER_MONGODB_URI || process.env.MONGODB_URI;
  const dbConnectionString = cleanString(process.env.TENANT_MONGODB_URI) || masterUri;
  const dbName = buildDefaultDbName(labName);

  if (!dbConnectionString) {
    throw new Error("Tenant database connection string is not configured");
  }

  const existingDbName = await Lab.findOne({ dbName }).select("dbName");

  if (existingDbName) {
    throw new Error("A tenant database with this lab name already exists");
  }

  let tenantConnection = null;
  let createdLab = null;

  try {
    createdLab = await Lab.create({
      name: labName,
      tenantId: validation.subdomain,
      dbName,
      dbConnectionString,
      status: "active",
      subscriptionPlan: "trial",
      enabledModules: defaultLabModules,
      branding: {
        primaryColor: "#0d9488",
        secondaryColor: "#0f766e",
        accentColor: "#f59e0b",
        loginHighlights: [],
      },
      createdBy,
    });

    tenantConnection = await mongoose
      .createConnection(dbConnectionString, {
        ...connectionOptions,
        dbName,
      })
      .asPromise();

    await initializeTenantCollections(tenantConnection);
    await createTenantRoles(masterConnection, tenantConnection);
    await seedSystemChartOfAccounts(tenantConnection, createdLab.tenantId);
    warmTenantConfigCache({
      id: String(createdLab._id),
      labId: createdLab.labId,
      tenantId: createdLab.tenantId,
      name: createdLab.name,
      status: createdLab.status,
      dbName: createdLab.dbName,
      dbConnectionString: createdLab.dbConnectionString,
      subscriptionPlan: createdLab.subscriptionPlan,
      enabledModules: createdLab.enabledModules || [],
      branding: createdLab.branding || {},
    });

    return createdLab;
  } catch (error) {
    if (createdLab) {
      await createdLab.deleteOne().catch(() => {});
      clearTenantConfigCache(validation.subdomain);
    }

    throw error;
  } finally {
    if (tenantConnection) {
      await tenantConnection.close();
    }
  }
}
