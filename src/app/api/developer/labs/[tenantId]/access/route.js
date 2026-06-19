import { nextJsonError } from "@/app/lib/api-response";
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectMasterDB from "@/app/lib/master-db";
import { requireDeveloperSession } from "@/app/lib/auth";
import { getLabModel } from "@/app/models/master/Lab";
import { getRoleModel } from "@/app/models/tenant/Role";
import { clearTenantConfigCache } from "@/app/lib/tenant-cache";
import { normalizeEnabledModules } from "@/app/lib/modules";
import rbacConfig from "@/app/lib/rbac-config.json";

const labPermissions = rbacConfig.permissions.filter((permission) => permission.scope !== "developer");

function normalizePermissionKeys(permissionKeys, enabledModules) {
  const enabledModuleSet = new Set(enabledModules);
  const allowedPermissionKeys = new Set(
    labPermissions
      .filter(
        (permission) =>
          enabledModuleSet.has(permission.module) ||
          permission.module === "users" ||
          permission.module === "settings"
      )
      .map((permission) => permission.key)
  );

  return [...new Set(Array.isArray(permissionKeys) ? permissionKeys : [])].filter((key) =>
    allowedPermissionKeys.has(key)
  );
}

function cleanString(value) {
  return String(value || "").trim();
}

async function getLab(tenantId) {
  const labId = cleanString(tenantId);
  const masterConnection = await connectMasterDB();
  const Lab = getLabModel(masterConnection);
  const query = mongoose.Types.ObjectId.isValid(labId)
    ? { $or: [{ _id: labId }, { tenantId: labId.toLowerCase() }, { labId }] }
    : { $or: [{ tenantId: labId.toLowerCase() }, { labId }] };

  return Lab.findOne(query).select(
    "name tenantId status subscriptionPlan enabledModules dbName +dbConnectionString"
  );
}

async function connectLabRoleModel(lab) {
  if (!lab.dbName || !lab.dbConnectionString) {
    throw new Error(`Tenant database is not configured for tenantId: ${lab.tenantId}`);
  }

  const connection = await mongoose
    .createConnection(lab.dbConnectionString, {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      dbName: lab.dbName,
    })
    .asPromise();

  return {
    connection,
    Role: getRoleModel(connection),
  };
}

async function getDefaultAdminRole(Role) {
  const defaultAdminRole = await Role.findOne({ isDefaultAdmin: true });
  return defaultAdminRole || Role.findOne({ name: "Admin" });
}

export async function GET(req, { params }) {
  try {
    const auth = requireDeveloperSession(req);
    if (auth.error) return auth.error;

    const { tenantId } = await params;
    const lab = await getLab(tenantId);
    if (!lab) {
      return NextResponse.json(
        { error: "Lab not found", details: `No lab exists for identifier "${tenantId}".` },
        { status: 404 }
      );
    }

    const { connection, Role } = await connectLabRoleModel(lab);
    let adminRole;
    try {
      adminRole = await getDefaultAdminRole(Role);
    } finally {
      await connection.close();
    }

    return NextResponse.json({
      lab: {
        name: lab.name,
        tenantId: lab.tenantId,
        status: lab.status,
        subscriptionPlan: lab.subscriptionPlan,
        enabledModules: lab.enabledModules,
      },
      adminRole: adminRole
        ? {
            id: adminRole._id,
            name: adminRole.name,
            permissions: adminRole.permissions || [],
          }
        : null,
    });
  } catch (error) {
    console.error("GET /api/developer/labs/[tenantId]/access error:", error);
    return nextJsonError("Unable to load lab access", error, 500);
  }
}

export async function PATCH(req, { params }) {
  try {
    const auth = requireDeveloperSession(req);
    if (auth.error) return auth.error;

    const { tenantId } = await params;
    const body = await req.json();
    const enabledModules = normalizeEnabledModules(body.enabledModules);
    const adminPermissions = normalizePermissionKeys(body.adminPermissions, enabledModules);

    const lab = await getLab(tenantId);
    if (!lab) {
      return NextResponse.json(
        { error: "Lab not found", details: `No lab exists for identifier "${tenantId}".` },
        { status: 404 }
      );
    }

    const { connection, Role } = await connectLabRoleModel(lab);
    try {
      const adminRole = await getDefaultAdminRole(Role);
      if (!adminRole) {
        return NextResponse.json({ error: "Default lab admin role not found" }, { status: 404 });
      }

      adminRole.permissions = adminPermissions;
      adminRole.isDefaultAdmin = true;
      await adminRole.save();

      await lab.constructor.updateOne(
        { _id: lab._id },
        { $set: { enabledModules } },
        { runValidators: true }
      );
      clearTenantConfigCache(lab.tenantId);

      return NextResponse.json({
        lab: {
          name: lab.name,
          tenantId: lab.tenantId,
          status: lab.status,
          subscriptionPlan: lab.subscriptionPlan,
          enabledModules,
        },
        adminRole: {
          id: adminRole._id,
          name: adminRole.name,
          permissions: adminRole.permissions,
        },
      });
    } finally {
      await connection.close();
    }
  } catch (error) {
    console.error("PATCH /api/developer/labs/[tenantId]/access error:", error);
    return nextJsonError("Unable to save lab access", error, 500);
  }
}
