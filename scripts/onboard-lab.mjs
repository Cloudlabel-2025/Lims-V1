import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import mongoose from "mongoose";
import { hashPassword } from "../src/app/lib/password.js";
import { getDoctorModel } from "../src/app/models/doctor.js";
import { getLabModel } from "../src/app/models/master/Lab.js";
import { getRoleTemplateModel } from "../src/app/models/master/RoleTemplate.js";
import { getPatientModel } from "../src/app/models/patient.js";
import { getVisitModel } from "../src/app/models/visit.js";
import { getLabOrderModel } from "../src/app/models/tenant/LabOrder.js";
import { getRoleModel } from "../src/app/models/tenant/Role.js";
import { getSampleModel } from "../src/app/models/tenant/Sample.js";
import { getTestCategoryModel } from "../src/app/models/tenant/TestCategory.js";
import { getTestDefinitionModel } from "../src/app/models/tenant/TestDefinition.js";
import { getTestReportModel } from "../src/app/models/tenant/TestReport.js";
import { getUserModel } from "../src/app/models/tenant/User.js";
import { defaultLabModules, normalizeEnabledModules } from "../src/app/lib/modules.js";

const rootDir = process.cwd();

function loadLocalEnv() {
  const envPath = path.join(rootDir, ".env.local");
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value.replace(/^['"]|['"]$/g, "");
    }
  }
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function optionalEnv(name, fallback) {
  return process.env[name]?.trim() || fallback;
}

async function createTenantRoles(masterConnection, tenantConnection) {
  const RoleTemplate = getRoleTemplateModel(masterConnection);
  const Role = getRoleModel(tenantConnection);
  const templates = await RoleTemplate.find({ isActive: true }).sort({ sortOrder: 1, name: 1 });

  if (templates.length === 0) {
    throw new Error("No active role templates found. Run scripts/seed-rbac.mjs first.");
  }

  let adminRole = null;

  for (const template of templates) {
    const existing = await Role.findOne({ name: template.name });
    const roleData = {
      name: template.name,
      description: template.description,
      permissions: template.permissions,
      isDefaultAdmin: template.isDefaultAdmin,
      isSystemRole: template.isSystemTemplate,
      status: "active",
    };

    const role = existing
      ? await Role.findByIdAndUpdate(existing._id, { $set: roleData }, { returnDocument: "after", runValidators: true })
      : await Role.create(roleData);

    if (role.isDefaultAdmin) {
      adminRole = role;
    }
  }

  if (!adminRole) {
    throw new Error("Default admin role template not found.");
  }

  return adminRole;
}

async function initializeTenantCollections(tenantConnection) {
  await Promise.all([
    getRoleModel(tenantConnection).init(),
    getTestCategoryModel(tenantConnection).init(),
    getTestDefinitionModel(tenantConnection).init(),
    getTestReportModel(tenantConnection).init(),
    getUserModel(tenantConnection).init(),
    getPatientModel(tenantConnection).init(),
    getLabOrderModel(tenantConnection).init(),
    getDoctorModel(tenantConnection).init(),
    getSampleModel(tenantConnection).init(),
    getVisitModel(tenantConnection).init(),
  ]);
}

async function main() {
  loadLocalEnv();

  const masterUri = process.env.MASTER_MONGODB_URI || requiredEnv("MONGODB_URI");
  const labName = requiredEnv("LAB_NAME");
  const tenantId = requiredEnv("TENANT_ID").toLowerCase();
  const dbName = optionalEnv("TENANT_DB_NAME", `lims_${tenantId.replaceAll("-", "_")}`);
  const dbConnectionString = optionalEnv("TENANT_MONGODB_URI", masterUri);
  const adminEmail = requiredEnv("LAB_ADMIN_EMAIL").toLowerCase();
  const adminPassword = requiredEnv("LAB_ADMIN_PASSWORD");
  const adminFirstName = optionalEnv("LAB_ADMIN_FIRST_NAME", "Lab");
  const adminLastName = optionalEnv("LAB_ADMIN_LAST_NAME", "Admin");
  const enabledModules = normalizeEnabledModules(
    optionalEnv("LAB_ENABLED_MODULES", defaultLabModules.join(",")).split(",").map((module) => module.trim())
  );

  const masterConnection = await mongoose
    .createConnection(masterUri, {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    })
    .asPromise();

  const Lab = getLabModel(masterConnection);

  let lab = await Lab.findOne({ tenantId }).select("+dbConnectionString");
  const labData = {
    name: labName,
    tenantId,
    dbName,
    dbConnectionString,
    status: "active",
    subscriptionPlan: optionalEnv("LAB_SUBSCRIPTION_PLAN", "trial"),
    enabledModules,
    contactName: optionalEnv("LAB_CONTACT_NAME", ""),
    contactEmail: optionalEnv("LAB_CONTACT_EMAIL", ""),
    contactPhone: optionalEnv("LAB_CONTACT_PHONE", ""),
  };

  if (lab) {
    lab.set(labData);
  } else {
    lab = new Lab(labData);
  }

  await lab.save();

  const tenantConnection = await mongoose
    .createConnection(dbConnectionString, {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      dbName,
    })
    .asPromise();

  await initializeTenantCollections(tenantConnection);
  const adminRole = await createTenantRoles(masterConnection, tenantConnection);

  const User = getUserModel(tenantConnection);
  const passwordHash = await hashPassword(adminPassword);
  const existingAdmin = await User.findOne({ email: adminEmail }).select("+passwordHash");

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
    await User.create({
      firstName: adminFirstName,
      lastName: adminLastName,
      email: adminEmail,
      passwordHash,
      role: adminRole._id,
      status: "active",
    });
  }

  console.log("Lab onboarding complete");
  console.log(`Lab: ${lab.name}`);
  console.log(`Tenant ID: ${tenantId}`);
  console.log(`Database: ${dbName}`);
  console.log(`Lab admin: ${adminEmail}`);

  await tenantConnection.close();
  await masterConnection.close();
}

main().catch(async (error) => {
  console.error("Lab onboarding failed:", error.message);
  await mongoose.disconnect();
  process.exitCode = 1;
});
