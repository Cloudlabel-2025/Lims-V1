import { jsonError } from "@/app/lib/api-response";
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

export async function GET(req) {
  try {
    const auth = requireTenantSession(req, "accounts.view");
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "accounts.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { CorporateAccount } = await getTenantModels(auth.tenantId);
    const corporateAccounts = await CorporateAccount.find({ tenantId: auth.tenantId })
      .sort({ name: 1 })
      .lean();

    return Response.json({ corporateAccounts });
  } catch (error) {
    return jsonError("Unable to load corporate accounts", error, 500);
  }
}

export async function POST(req) {
  try {
    const auth = requireTenantSession(req, "accounts.manage");
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "accounts.view");
    if (moduleAuth.error) return moduleAuth.error;

    const body = await req.json();
    const name = clean(body.name);
    const contactPerson = clean(body.contactPerson);
    const rawCreditLimit = body.creditLimit;

    if (!name) {
      return Response.json({ error: "Corporate account name is required" }, { status: 400 });
    }
    if (hasUrl(name)) {
      return Response.json({ error: "URLs are not allowed in corporate name" }, { status: 400 });
    }
    if (!isValidName(name)) {
      return Response.json({ error: "Name contains invalid characters" }, { status: 400 });
    }
    if (!contactPerson) {
      return Response.json({ error: "Contact person is required" }, { status: 400 });
    }
    if (hasUrl(contactPerson)) {
      return Response.json({ error: "URLs are not allowed in contact person" }, { status: 400 });
    }
    if (!isValidName(contactPerson)) {
      return Response.json({ error: "Contact person contains invalid characters" }, { status: 400 });
    }
    if (rawCreditLimit === undefined || rawCreditLimit === null || rawCreditLimit === "") {
      return Response.json({ error: "Credit limit is required" }, { status: 400 });
    }
    if (isExponentialNotation(String(rawCreditLimit))) {
      return Response.json({ error: "Exponential notation is not allowed in credit limit" }, { status: 400 });
    }

    const { CorporateAccount } = await getTenantModels(auth.tenantId);
    const corporateAccount = await CorporateAccount.create({
      name,
      contactPerson,
      creditLimit: money(rawCreditLimit),
      outstandingBalance: money(body.outstandingBalance),
      tenantId: auth.tenantId,
      statementCycle: body.statementCycle === "weekly" ? "weekly" : "monthly",
    });

    return Response.json({ corporateAccount }, { status: 201 });
  } catch (error) {
    if (error.code === 11000) {
      return Response.json({ error: "Corporate account already exists" }, { status: 409 });
    }

    return jsonError("Unable to save corporate account", error, 500);
  }
}
