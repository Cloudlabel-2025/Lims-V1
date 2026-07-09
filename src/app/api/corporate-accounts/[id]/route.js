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

function isExponentialNotation(value) {
  if (typeof value === "string" && /[eE]/.test(value)) return true;
  return false;
}

function hasUrl(value) {
  return /https?:\/\//.test(value);
}

function isValidName(value) {
  return /^[A-Za-z0-9 .&'\/,()@_-]*$/.test(value);
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

    if (body.name !== undefined) {
      const name = clean(body.name);
      if (!name) return Response.json({ error: "Corporate account name is required" }, { status: 400 });
      if (name.length < 3) return Response.json({ error: "Corporate account name must be at least 3 characters" }, { status: 400 });
      if (name.length > 30) return Response.json({ error: "Corporate account name must be 30 characters or less" }, { status: 400 });
      if (hasUrl(name)) return Response.json({ error: "URLs are not allowed in corporate name" }, { status: 400 });
      if (!isValidName(name)) return Response.json({ error: "Name contains invalid characters" }, { status: 400 });
      corporateAccount.name = name;
    }
    if (body.contactPerson !== undefined) {
      const contactPerson = clean(body.contactPerson);
      if (!contactPerson) return Response.json({ error: "Contact person is required" }, { status: 400 });
      if (contactPerson.length < 3) return Response.json({ error: "Contact person must be at least 3 characters" }, { status: 400 });
      if (contactPerson.length > 30) return Response.json({ error: "Contact person must be 30 characters or less" }, { status: 400 });
      if (hasUrl(contactPerson)) return Response.json({ error: "URLs are not allowed in contact person" }, { status: 400 });
      if (!isValidName(contactPerson)) return Response.json({ error: "Contact person contains invalid characters" }, { status: 400 });
      corporateAccount.contactPerson = contactPerson;
    }
    if (body.creditLimit !== undefined) {
      if (body.creditLimit === null || body.creditLimit === "") {
        return Response.json({ error: "Credit limit is required" }, { status: 400 });
      }
      if (isExponentialNotation(String(body.creditLimit))) {
        return Response.json({ error: "Exponential notation is not allowed in credit limit" }, { status: 400 });
      }
      corporateAccount.creditLimit = money(body.creditLimit);
    }
    if (body.outstandingBalance !== undefined) corporateAccount.outstandingBalance = money(body.outstandingBalance);
    if (body.statementCycle !== undefined) {
      corporateAccount.statementCycle = ["monthly", "weekly", "quarterly", "half-yearly", "yearly"].includes(body.statementCycle) ? body.statementCycle : "monthly";
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
    const { CorporateAccount, BillingRecord, PaymentReceipt } = await getTenantModels(auth.tenantId);

    const corporateAccount = await CorporateAccount.findById(id);
    if (!corporateAccount) {
      return Response.json({ error: "Corporate account not found" }, { status: 404 });
    }

    if (corporateAccount.outstandingBalance > 0) {
      return Response.json({ error: "Cannot delete corporate account with outstanding balance" }, { status: 400 });
    }

    // Check for active invoices linked to this corporate account
    const activeCorporateBills = await BillingRecord.countDocuments({
      tenantId: auth.tenantId,
      "paymentBreakdown.corporate": { $gt: 0 },
      billingStatus: { $in: ["unpaid", "partial"] },
    });
    if (activeCorporateBills > 0) {
      return Response.json({ error: "Cannot delete corporate account with active invoices" }, { status: 400 });
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
