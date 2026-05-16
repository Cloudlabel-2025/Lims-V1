import mongoose from "mongoose";
import { getDoctorModel } from "@/app/models/doctor";
import { getPatientModel } from "@/app/models/patient";
import { getVisitModel } from "@/app/models/visit";
import { getTenantConfig } from "@/app/lib/tenant-cache";
import { getBillingRecordModel } from "@/app/models/tenant/BillingRecord";
import { getRoleModel } from "@/app/models/tenant/Role";
import { getSampleModel } from "@/app/models/tenant/Sample";
import { getTestCategoryModel } from "@/app/models/tenant/TestCategory";
import { getTestDefinitionModel } from "@/app/models/tenant/TestDefinition";
import { getTestPackageModel } from "@/app/models/tenant/TestPackage";
import { getTestReportModel } from "@/app/models/tenant/TestReport";
import { getUserModel } from "@/app/models/tenant/User";

const tenantDbCache = globalThis.tenantDbCache || new Map();

globalThis.tenantDbCache = tenantDbCache;

const connectionOptions = {
  bufferCommands: false,
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
};

async function getActiveLab(tenantId) {
  if (!tenantId) {
    throw new Error("tenantId is required to connect to a tenant database");
  }

  const lab = await getTenantConfig(tenantId, { includeSecret: true });

  if (!lab) {
    throw new Error(`Tenant not found for tenantId: ${tenantId}`);
  }

  if (lab.status !== "active") {
    throw new Error(`Tenant is not active for tenantId: ${tenantId}`);
  }

  if (!lab.dbConnectionString || !lab.dbName) {
    throw new Error(`Tenant database is not configured for tenantId: ${tenantId}`);
  }

  return lab;
}

export async function connectTenantDB(tenantId) {
  if (!tenantId) {
    throw new Error("tenantId is required to connect to a tenant database");
  }

  const cacheKey = String(tenantId).toLowerCase();

  if (tenantDbCache.has(cacheKey)) {
    const cached = tenantDbCache.get(cacheKey);

    if (cached.conn) {
      return cached.conn;
    }

    if (cached.promise) {
      cached.conn = await cached.promise;
      return cached.conn;
    }
  }

  const lab = await getActiveLab(cacheKey);
  const promise = mongoose
    .createConnection(lab.dbConnectionString, {
      ...connectionOptions,
      dbName: lab.dbName,
    })
    .asPromise()
    .catch((error) => {
      tenantDbCache.delete(cacheKey);
      throw error;
    });

  tenantDbCache.set(cacheKey, { conn: null, promise, lab });

  const conn = await promise;
  tenantDbCache.set(cacheKey, { conn, promise: null, lab });

  return conn;
}

export async function getTenantModels(tenantId) {
  const connection = await connectTenantDB(tenantId);

  return {
    connection,
    Doctor: getDoctorModel(connection),
    Patient: getPatientModel(connection),
    BillingRecord: getBillingRecordModel(connection),
    Role: getRoleModel(connection),
    Sample: getSampleModel(connection),
    TestCategory: getTestCategoryModel(connection),
    TestDefinition: getTestDefinitionModel(connection),
    TestPackage: getTestPackageModel(connection),
    TestReport: getTestReportModel(connection),
    User: getUserModel(connection),
    Visit: getVisitModel(connection),
  };
}

export default connectTenantDB;
