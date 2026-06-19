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
    const price = Number(body.price) || 0;
    const tests = Array.isArray(body.tests) ? body.tests : [];

    if (price > 0 && !hasPermission(auth.session, "tests.price")) {
      return Response.json({ error: "tests.price permission is required to set package price" }, { status: 403 });
    }

    if (!name) return Response.json({ error: "Package name is required" }, { status: 400 });
    if (tests.length === 0) return Response.json({ error: "At least one test must be included" }, { status: 400 });

    const { TestPackage } = await getTenantModels(auth.tenantId);
    const pkg = await TestPackage.create({
      name,
      code: clean(body.code).toUpperCase() || undefined,
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
