import mongoose from "mongoose";
import { getDoctorModel } from "@/app/models/tenant/Doctor";
import { getPatientModel } from "@/app/models/tenant/Patient";
import { getTenantConfig } from "@/app/lib/tenant-cache";
import { getAccountModel } from "@/app/models/tenant/Account";
import { getAuditLogModel } from "@/app/models/tenant/AuditLog";
import { getBillingRecordModel } from "@/app/models/tenant/BillingRecord";
import { getCorporateAccountModel } from "@/app/models/tenant/CorporateAccount";
import { getExpenseEntryModel } from "@/app/models/tenant/ExpenseEntry";
import { getRoleModel } from "@/app/models/tenant/Role";
import { getSampleModel } from "@/app/models/tenant/Sample";
import { getJournalEntryModel } from "@/app/models/tenant/JournalEntry";
import { getPaymentReceiptModel } from "@/app/models/tenant/PaymentReceipt";
import { getTestCategoryModel } from "@/app/models/tenant/TestCategory";
import { getTestDefinitionModel } from "@/app/models/tenant/TestDefinition";
import { getTestPackageModel } from "@/app/models/tenant/TestPackage";
import { getTestReportModel } from "@/app/models/tenant/TestReport";
import { getUserModel } from "@/app/models/tenant/User";
import { getInventoryCategoryModel } from "@/app/models/tenant/InventoryCategory";
import { getInventoryItemModel } from "@/app/models/tenant/InventoryItem";
import { getInventoryMovementModel } from "@/app/models/tenant/InventoryMovement";
import { getInventoryUomModel } from "@/app/models/tenant/InventoryUom";
import { getInventoryItemTypeModel } from "@/app/models/tenant/InventoryItemType";
import { getInventoryStorageConditionModel } from "@/app/models/tenant/InventoryStorageCondition";


const tenantDbCache = globalThis.tenantDbCache || new Map();
globalThis.tenantDbCache = tenantDbCache;

const connectionOptions = {
  bufferCommands: false,
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
};

async function getActiveLab(tenantId) {
  if (!tenantId) throw new Error("tenantId is required to connect to a tenant database");

  const lab = await getTenantConfig(tenantId, { includeSecret: true });
  if (!lab) throw new Error(`Tenant not found for tenantId: ${tenantId}`);
  if (lab.status !== "active") throw new Error(`Tenant is not active for tenantId: ${tenantId}`);
  if (!lab.dbConnectionString || !lab.dbName) throw new Error(`Tenant database is not configured for tenantId: ${tenantId}`);

  return lab;
}

export async function connectTenantDB(tenantId) {
  if (!tenantId) throw new Error("tenantId is required to connect to a tenant database");

  const cacheKey = String(tenantId).toLowerCase();

  if (tenantDbCache.has(cacheKey)) {
    const cached = tenantDbCache.get(cacheKey);
    if (cached.conn) return cached.conn;
    if (cached.promise) {
      cached.conn = await cached.promise;
      return cached.conn;
    }
  }

  const lab = await getActiveLab(cacheKey);
  const promise = mongoose
    .createConnection(lab.dbConnectionString, { ...connectionOptions, dbName: lab.dbName })
    .asPromise()
    .catch((error) => { tenantDbCache.delete(cacheKey); throw error; });

  tenantDbCache.set(cacheKey, { conn: null, promise, lab });
  const conn = await promise;
  tenantDbCache.set(cacheKey, { conn, promise: null, lab });

  return conn;
}

export async function getTenantModels(tenantId) {
  const connection = await connectTenantDB(tenantId);

  const lab = await getTenantConfig(tenantId);

  return {
    connection,
    Account: getAccountModel(connection),
    AuditLog: getAuditLogModel(connection),
    BillingRecord: getBillingRecordModel(connection),
    CorporateAccount: getCorporateAccountModel(connection),
    Doctor: getDoctorModel(connection),
    ExpenseEntry: getExpenseEntryModel(connection),
    JournalEntry: getJournalEntryModel(connection),
    Patient: getPatientModel(connection, { patientPrefix: lab?.numbering?.patientPrefix }),
    PaymentReceipt: getPaymentReceiptModel(connection),
    Role: getRoleModel(connection),
    Sample: getSampleModel(connection),
    TestCategory: getTestCategoryModel(connection),
    TestDefinition: getTestDefinitionModel(connection),
    TestPackage: getTestPackageModel(connection),
    TestReport: getTestReportModel(connection),
    User: getUserModel(connection),
    InventoryCategory: getInventoryCategoryModel(connection),
    InventoryItem: getInventoryItemModel(connection),
    InventoryMovement: getInventoryMovementModel(connection),
    InventoryUom: getInventoryUomModel(connection),
    InventoryItemType: getInventoryItemTypeModel(connection),
    InventoryStorageCondition: getInventoryStorageConditionModel(connection),
  };
}

export default connectTenantDB;
