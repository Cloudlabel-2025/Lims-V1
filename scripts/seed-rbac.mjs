import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import mongoose from "mongoose";

const rootDir = process.cwd();
const envPath = path.join(rootDir, ".env.local");
const rbacConfigPath = path.join(rootDir, "src", "app", "lib", "rbac-config.json");
const permissionKeyPattern = /^[a-z]+(?:\.[a-z]+)+$/;
const defaultPlans = ["trial", "basic", "professional", "enterprise"];

function loadLocalEnv() {
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
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

function createCounterModel(connection) {
  return (
    connection.models.Counter ||
    connection.model(
      "Counter",
      new mongoose.Schema({
        name: { type: String, required: true, unique: true },
        seq: { type: Number, default: 0 },
      })
    )
  );
}

async function getNextSequence(connection, name) {
  const Counter = createCounterModel(connection);
  const counter = await Counter.findOneAndUpdate(
    { name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  return counter.seq;
}

function createPermissionModel(connection) {
  const schema = new mongoose.Schema(
    {
      permissionId: { type: String, unique: true, immutable: true, index: true },
      name: { type: String, required: true, trim: true, maxlength: 100 },
      key: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        match: /^[a-z]+(?:\.[a-z]+)+$/,
      },
      module: { type: String, required: true, trim: true, lowercase: true },
      action: { type: String, required: true, trim: true, lowercase: true },
      scope: {
        type: String,
        enum: ["tenant", "developer"],
        default: "tenant",
        index: true,
      },
      category: { type: String, trim: true, lowercase: true, default: "general", index: true },
      description: { type: String, trim: true, maxlength: 500 },
      dependencies: {
        type: [
          {
            type: String,
            trim: true,
            lowercase: true,
            match: /^[a-z]+(?:\.[a-z]+)+$/,
          },
        ],
        default: [],
      },
      availableForPlans: {
        type: [
          {
            type: String,
            enum: ["trial", "basic", "professional", "enterprise"],
          },
        ],
        default: ["trial", "basic", "professional", "enterprise"],
      },
      isSystem: { type: Boolean, default: true },
      isDangerous: { type: Boolean, default: false },
      isActive: { type: Boolean, default: true, index: true },
      sortOrder: { type: Number, default: 0 },
    },
    { timestamps: true }
  );

  schema.pre("save", async function generatePermissionId() {
    if (this.permissionId) return;

    const seq = await getNextSequence(this.constructor.db, "permissionId");
    this.permissionId = `PERM-${String(seq).padStart(6, "0")}`;
  });

  return connection.models.Permission || connection.model("Permission", schema);
}

function createRoleTemplateModel(connection) {
  const permissionKeySchema = {
    type: String,
    trim: true,
    lowercase: true,
    match: /^(?:\*|[a-z]+(?:\.[a-z]+)+)$/,
  };

  const schema = new mongoose.Schema(
    {
      roleTemplateId: { type: String, unique: true, immutable: true, index: true },
      name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
      description: { type: String, trim: true, maxlength: 500 },
      scope: { type: String, enum: ["tenant"], default: "tenant", immutable: true },
      permissions: { type: [permissionKeySchema], default: [] },
      category: { type: String, trim: true, lowercase: true, default: "general", index: true },
      availableForPlans: {
        type: [
          {
            type: String,
            enum: ["trial", "basic", "professional", "enterprise"],
          },
        ],
        default: ["trial", "basic", "professional", "enterprise"],
      },
      isDefaultAdmin: { type: Boolean, default: false },
      isSystemTemplate: { type: Boolean, default: true },
      isActive: { type: Boolean, default: true, index: true },
      sortOrder: { type: Number, default: 0 },
    },
    { timestamps: true }
  );

  schema.pre("save", async function generateRoleTemplateId() {
    if (this.roleTemplateId) return;

    const seq = await getNextSequence(this.constructor.db, "roleTemplateId");
    this.roleTemplateId = `RTPL-${String(seq).padStart(6, "0")}`;
  });

  return connection.models.RoleTemplate || connection.model("RoleTemplate", schema);
}

function loadRbacConfig() {
  if (!fs.existsSync(rbacConfigPath)) {
    throw new Error(`RBAC config not found: ${rbacConfigPath}`);
  }

  const config = JSON.parse(fs.readFileSync(rbacConfigPath, "utf8"));
  validateRbacConfig(config);

  return {
    permissions: normalizePermissions(config.permissions),
    roleTemplates: normalizeRoleTemplates(config.roleTemplates, config.permissions),
  };
}

function validateRbacConfig(config) {
  if (!Array.isArray(config.permissions) || config.permissions.length === 0) {
    throw new Error("RBAC config must include a non-empty permissions array.");
  }

  if (!Array.isArray(config.roleTemplates) || config.roleTemplates.length === 0) {
    throw new Error("RBAC config must include a non-empty roleTemplates array.");
  }

  const permissionKeys = new Set();
  const tenantPermissionKeys = new Set();

  for (const permission of config.permissions) {
    if (!permission.name || !permission.key || !permission.module || !permission.action) {
      throw new Error("Every permission must include name, key, module, and action.");
    }

    if (permission.scope && !["tenant", "developer"].includes(permission.scope)) {
      throw new Error(`Invalid permission scope for ${permission.key}: ${permission.scope}`);
    }

    if (!permissionKeyPattern.test(permission.key)) {
      throw new Error(`Invalid permission key: ${permission.key}`);
    }

    if (permissionKeys.has(permission.key)) {
      throw new Error(`Duplicate permission key: ${permission.key}`);
    }

    permissionKeys.add(permission.key);

    if ((permission.scope || "tenant") === "tenant") {
      tenantPermissionKeys.add(permission.key);
    }

    for (const dependency of permission.dependencies || []) {
      if (!permissionKeys.has(dependency) && !config.permissions.some((item) => item.key === dependency)) {
        throw new Error(`Permission ${permission.key} depends on unknown permission ${dependency}.`);
      }
    }
  }

  for (const roleTemplate of config.roleTemplates) {
    if (!roleTemplate.name || !Array.isArray(roleTemplate.permissions)) {
      throw new Error("Every role template must include name and permissions array.");
    }

    for (const permission of roleTemplate.permissions) {
      if (permission !== "*" && !permissionKeys.has(permission)) {
        throw new Error(`Role template ${roleTemplate.name} uses unknown permission ${permission}.`);
      }

      if (permission !== "*" && !tenantPermissionKeys.has(permission)) {
        throw new Error(`Role template ${roleTemplate.name} uses non-tenant permission ${permission}.`);
      }
    }
  }
}

function normalizePermissions(permissions) {
  return permissions.map((permission) => ({
    scope: "tenant",
    isSystem: true,
    isActive: true,
    dependencies: [],
    availableForPlans: defaultPlans,
    isDangerous: false,
    ...permission,
  }));
}

function normalizeRoleTemplates(roleTemplates, permissions) {
  const tenantPermissionKeys = permissions
    .filter((permission) => (permission.scope || "tenant") === "tenant")
    .map((permission) => permission.key);

  return roleTemplates.map((roleTemplate) => ({
    scope: "tenant",
    isSystemTemplate: true,
    isActive: true,
    isDefaultAdmin: false,
    availableForPlans: defaultPlans,
    ...roleTemplate,
    permissions: roleTemplate.permissions.includes("*")
      ? tenantPermissionKeys
      : roleTemplate.permissions,
  }));
}

async function upsertByKey(Model, keyField, item) {
  const existing = await Model.findOne({ [keyField]: item[keyField] });

  if (existing) {
    existing.set(item);
    await existing.save();
    return { action: "updated", doc: existing };
  }

  const created = await Model.create(item);
  return { action: "created", doc: created };
}

async function main() {
  loadLocalEnv();
  const { permissions, roleTemplates } = loadRbacConfig();

  if (process.argv.includes("--validate-config")) {
    console.log("RBAC config is valid");
    console.log(`Permissions: ${permissions.length}`);
    console.log(`Role templates: ${roleTemplates.length}`);
    return;
  }

  const uri = process.env.MASTER_MONGODB_URI || process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MASTER_MONGODB_URI or MONGODB_URI is required before seeding RBAC.");
  }

  const connection = await mongoose.createConnection(uri, {
    bufferCommands: false,
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
  }).asPromise();

  const Permission = createPermissionModel(connection);
  const RoleTemplate = createRoleTemplateModel(connection);

  let createdPermissions = 0;
  let updatedPermissions = 0;

  for (const permission of permissions) {
    const result = await upsertByKey(Permission, "key", permission);

    if (result.action === "created") createdPermissions += 1;
    if (result.action === "updated") updatedPermissions += 1;
  }

  let createdRoles = 0;
  let updatedRoles = 0;

  for (const roleTemplate of roleTemplates) {
    const result = await upsertByKey(RoleTemplate, "name", roleTemplate);

    if (result.action === "created") createdRoles += 1;
    if (result.action === "updated") updatedRoles += 1;
  }

  console.log("RBAC seed complete");
  console.log(`Permissions: ${createdPermissions} created, ${updatedPermissions} updated`);
  console.log(`Role templates: ${createdRoles} created, ${updatedRoles} updated`);

  await connection.close();
}

main()
  .catch(async (error) => {
    console.error("RBAC seed failed:", error.message);
    await mongoose.disconnect();
    process.exitCode = 1;
  });
