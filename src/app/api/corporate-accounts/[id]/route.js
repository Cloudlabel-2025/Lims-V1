import { jsonError } from "@/app/lib/api-response";
import { writeAuditLog } from "@/app/lib/audit";
import { getTenantModels } from "@/app/lib/tenant-db";
import { requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";

function clean(value) {
  return String(value || "").trim();
}

function money(value) {
  return Math.max(0, Math.round((Number(value) || 0) * 100) / 100);
}

export async function GET(req, { params }) {
  try {
    const auth = requireTenantSession(req, "accounts.view");
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "accounts.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { id } = await params;
    const { CorporateAccount } = await getTenantModels(auth.tenantId);
    const corporateAccount = await CorporateAccount.findById(id);

    if (!corporateAccount) {
      return Response.json({ error: "Corporate account not found" }, { status: 404 });
    }

    return Response.json({ corporateAccount });
  } catch (error) {
    return jsonError("Unable to load corporate account", error, 500);
  }
}

export async function PUT(req, { params }) {
  try {
    const auth = requireTenantSession(req, "accounts.manage");
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "accounts.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { id } = await params;
    const body = await req.json();
    const { CorporateAccount } = await getTenantModels(auth.tenantId);

    const corporateAccount = await CorporateAccount.findById(id);
    if (!corporateAccount) {
      return Response.json({ error: "Corporate account not found" }, { status: 404 });
    }

    if (body.name !== undefined) corporateAccount.name = clean(body.name);
    if (body.contactPerson !== undefined) corporateAccount.contactPerson = clean(body.contactPerson);
    if (body.creditLimit !== undefined) corporateAccount.creditLimit = money(body.creditLimit);
    if (body.outstandingBalance !== undefined) corporateAccount.outstandingBalance = money(body.outstandingBalance);
    if (body.statementCycle !== undefined) {
      corporateAccount.statementCycle = body.statementCycle === "weekly" ? "weekly" : "monthly";
    }

    await corporateAccount.save();

    await writeAuditLog(req, auth, {
      action: "corporate_account.updated",
      resourceType: "CorporateAccount",
      resourceId: corporateAccount._id,
      metadata: { name: corporateAccount.name },
    });

    return Response.json({ corporateAccount });
  } catch (error) {
    if (error.code === 11000) {
      return Response.json({ error: "Corporate account already exists" }, { status: 409 });
    }
    return jsonError("Unable to update corporate account", error, 500);
  }
}

export async function DELETE(req, { params }) {
  try {
    const auth = requireTenantSession(req, "accounts.manage");
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "accounts.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { id } = await params;
    const { CorporateAccount } = await getTenantModels(auth.tenantId);

    const corporateAccount = await CorporateAccount.findById(id);
    if (!corporateAccount) {
      return Response.json({ error: "Corporate account not found" }, { status: 404 });
    }

    if (corporateAccount.outstandingBalance > 0) {
      return Response.json({ error: "Cannot delete corporate account with outstanding balance" }, { status: 400 });
    }

    await CorporateAccount.deleteOne({ _id: id });

    await writeAuditLog(req, auth, {
      action: "corporate_account.deleted",
      resourceType: "CorporateAccount",
      resourceId: id,
      metadata: { name: corporateAccount.name },
    });

    return Response.json({ message: "Corporate account deleted successfully" });
  } catch (error) {
    return jsonError("Unable to delete corporate account", error, 500);
  }
}
