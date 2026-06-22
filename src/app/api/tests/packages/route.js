import { jsonError } from "@/app/lib/api-response";
import { getTenantModels } from "@/app/lib/tenant-db";
import { hasPermission, requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";

function clean(value) {
  return String(value || "").trim();
}

export async function GET(req) {
  try {
    const auth = requireTenantSession(req, "tests.view");
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "tests.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { searchParams } = new URL(req.url);
    const search = clean(searchParams.get("search"));
    const status = searchParams.get("status");
    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { code: { $regex: search, $options: "i" } },
      ];
    }

    if (status && status !== "all") {
      query.status = status;
    }

    const { TestPackage } = await getTenantModels(auth.tenantId);
    const packages = await TestPackage.find(query)
      .populate("tests", "name code price")
      .select("packageId name code description price tests status createdAt updatedAt")
      .sort({ name: 1 })
      .limit(50)
      .lean();

    return Response.json({ packages });
  } catch (error) {
    return jsonError("Unable to load packages", error, 500);
  }
}

export async function POST(req) {
  try {
    const auth = requireTenantSession(req, "tests.create");
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "tests.view");
    if (moduleAuth.error) return moduleAuth.error;

    const body = await req.json();
    const name = clean(body.name);
    const tests = Array.isArray(body.tests) ? body.tests : [];

    if (!name) return Response.json({ error: "Package name is required" }, { status: 400 });

    if (!/^[A-Za-z][A-Za-z0-9 .&'\/,-]*$/.test(name)) {
      return Response.json({ error: "Package name contains invalid characters" }, { status: 400 });
    }

    if (/https?:\/\/|www\./i.test(name)) {
      return Response.json({ error: "Package name cannot contain a URL" }, { status: 400 });
    }

    const code = clean(body.code);
    if (!code) return Response.json({ error: "Code is required" }, { status: 400 });

    if (!/^[A-Za-z0-9_-]+$/.test(code)) {
      return Response.json({ error: "Code contains invalid characters" }, { status: 400 });
    }

    if (/https?:\/\/|www\./i.test(code)) {
      return Response.json({ error: "Code cannot contain a URL" }, { status: 400 });
    }

    const price = body.price === "" || body.price === null || body.price === undefined ? undefined : Number(body.price);
    if (price === undefined || isNaN(price)) {
      return Response.json({ error: "Package price is required" }, { status: 400 });
    }
    if (price > 999999999) {
      return Response.json({ error: "Package price contains an invalid value" }, { status: 400 });
    }

    if (price > 0 && !hasPermission(auth.session, "tests.price")) {
      return Response.json({ error: "tests.price permission is required to set package price" }, { status: 403 });
    }

    if (tests.length === 0) return Response.json({ error: "At least one test must be included" }, { status: 400 });

    const { TestPackage } = await getTenantModels(auth.tenantId);
    const pkg = await TestPackage.create({
      name,
      code: code.toUpperCase() || undefined,
      description: clean(body.description),
      price,
      tests,
      status: body.status === "inactive" ? "inactive" : "active",
    });

    await pkg.populate("tests", "name code price");

    return Response.json({ package: pkg }, { status: 201 });
  } catch (error) {
    if (error.code === 11000) {
      return Response.json({ error: "A package with this name/code already exists" }, { status: 409 });
    }

    return jsonError("Unable to create package", error, 500);
  }
}
