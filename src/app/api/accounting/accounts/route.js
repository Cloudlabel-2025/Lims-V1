import { jsonError } from "@/app/lib/api-response";
import { getTenantModels } from "@/app/lib/tenant-db";
import { requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";
import { accountTypes } from "@/app/models/tenant/Account";

function clean(value) {
  return String(value || "").trim();
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

    const { Account } = await getTenantModels(auth.tenantId);
    const { searchParams } = new URL(req.url);
    const type = clean(searchParams.get("type"));
    const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, Number.parseInt(searchParams.get("limit") || "20", 10)));
    const query = { tenantId: auth.tenantId };

    if (type && type !== "all") query.type = type;

    const [accounts, total] = await Promise.all([
      Account.find(query).sort({ code: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      Account.countDocuments(query),
    ]);

    return Response.json({
      accounts,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (error) {
    return jsonError("Unable to load accounts", error, 500);
  }
}

export async function POST(req) {
  try {
    const auth = requireTenantSession(req, "accounts.manage");
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "accounts.view");
    if (moduleAuth.error) return moduleAuth.error;

    const body = await req.json();
    const code = clean(body.code);
    const name = clean(body.name);
    const type = clean(body.type);
    const subtype = clean(body.subtype);

    if (!code || !name || !accountTypes.includes(type)) {
      return Response.json({ error: "Code, name, and valid type are required" }, { status: 400 });
    }

    if (name.length < 3) {
      return Response.json({ error: "Account name must be at least 3 characters" }, { status: 400 });
    }
    if (name.length > 30) {
      return Response.json({ error: "Account name must be 30 characters or less" }, { status: 400 });
    }

    if (isExponentialNotation(code)) {
      return Response.json({ error: "Exponential notation is not allowed in code" }, { status: 400 });
    }
    if (!isValidName(code)) {
      return Response.json({ error: "Code contains invalid characters" }, { status: 400 });
    }
    if (hasUrl(name)) {
      return Response.json({ error: "URLs are not allowed in account name" }, { status: 400 });
    }
    if (!isValidName(name)) {
      return Response.json({ error: "Name contains invalid characters" }, { status: 400 });
    }
    if (!subtype) {
      return Response.json({ error: "Subtype is required" }, { status: 400 });
    }
    if (hasUrl(subtype)) {
      return Response.json({ error: "URLs are not allowed in subtype" }, { status: 400 });
    }
    if (!isValidName(subtype)) {
      return Response.json({ error: "Subtype contains invalid characters" }, { status: 400 });
    }

    const { Account } = await getTenantModels(auth.tenantId);
    const account = await Account.create({
      code,
      name,
      type,
      subtype,
      tenantId: auth.tenantId,
      isSystem: false,
      balance: 0,
    });

    return Response.json({ account }, { status: 201 });
  } catch (error) {
    if (error.code === 11000) {
      return Response.json({ error: "Account code already exists" }, { status: 409 });
    }

    return jsonError("Unable to create account", error, 500);
  }
}
