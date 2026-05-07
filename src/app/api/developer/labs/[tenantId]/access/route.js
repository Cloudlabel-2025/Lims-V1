import { NextResponse } from "next/server";
import connectMasterDB from "@/app/lib/master-db";
import { requireDeveloperSession } from "@/app/lib/auth";
import { getLabModel } from "@/app/models/master/Lab";
import { getTenantModels } from "@/app/lib/tenant-db";
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

async function getLab(tenantId) {
  const masterConnection = await connectMasterDB();
  const Lab = getLabModel(masterConnection);
  return Lab.findOne({ tenantId }).select("name tenantId status subscriptionPlan enabledModules");
}

async function getDefaultAdminRole(tenantId) {
  const { Role } = await getTenantModels(tenantId);
  const defaultAdminRole = await Role.findOne({ isDefaultAdmin: true });
  return defaultAdminRole || Role.findOne({ name: "Admin" });
}

export async function GET(req, { params }) {
  try {
    const auth = requireDeveloperSession(req);
    if (auth.error) return auth.error;

    const { tenantId } = await params;
    const lab = await getLab(tenantId);
    if (!lab) return NextResponse.json({ error: "Lab not found" }, { status: 404 });

    const adminRole = await getDefaultAdminRole(lab.tenantId);

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
    return NextResponse.json(
      { error: "Unable to load lab access", details: error.message },
      { status: 500 }
    );
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
    if (!lab) return NextResponse.json({ error: "Lab not found" }, { status: 404 });

    lab.enabledModules = enabledModules;
    await lab.save();
    clearTenantConfigCache(lab.tenantId);

    const adminRole = await getDefaultAdminRole(lab.tenantId);
    if (!adminRole) {
      return NextResponse.json({ error: "Default lab admin role not found" }, { status: 404 });
    }

    adminRole.permissions = adminPermissions;
    adminRole.isDefaultAdmin = true;
    await adminRole.save();

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
  } catch (error) {
    return NextResponse.json(
      { error: "Unable to save lab access", details: error.message },
      { status: 500 }
    );
  }
}
