import { jsonError } from "@/app/lib/api-response";
import { getTenantModels } from "@/app/lib/tenant-db";
import { requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";

function clean(value) {
  return String(value || "").trim();
}

function money(value) {
  return Math.max(0, Math.round((Number(value) || 0) * 100) / 100);
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

    if (!name) {
      return Response.json({ error: "Corporate account name is required" }, { status: 400 });
    }

    const { CorporateAccount } = await getTenantModels(auth.tenantId);
    const corporateAccount = await CorporateAccount.create({
      name,
      contactPerson: clean(body.contactPerson),
      creditLimit: money(body.creditLimit),
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
