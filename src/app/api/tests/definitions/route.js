import { getTenantModels } from "@/app/lib/tenant-db";
import { requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";

function clean(value) {
  return String(value || "").trim();
}

function slug(value, fallback) {
  return (
    clean(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || fallback
  );
}

function normalizeParameters(parameters) {
  if (!Array.isArray(parameters)) return [];

  return parameters
    .map((parameter, index) => {
      const name = clean(parameter.name);
      if (!name) return null;

      const normalMin = parameter.normalMin === "" || parameter.normalMin === null ? undefined : Number(parameter.normalMin);
      const normalMax = parameter.normalMax === "" || parameter.normalMax === null ? undefined : Number(parameter.normalMax);

      return {
        key: slug(parameter.key || name, `parameter-${index + 1}`),
        name,
        unit: clean(parameter.unit),
        normalMin: Number.isFinite(normalMin) ? normalMin : undefined,
        normalMax: Number.isFinite(normalMax) ? normalMax : undefined,
        required: parameter.required !== false,
        sortOrder: index,
      };
    })
    .filter(Boolean);
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

    const { TestDefinition } = await getTenantModels(auth.tenantId);
    const tests = await TestDefinition.find(query)
      .populate("category", "name categoryId")
      .sort({ updatedAt: -1 })
      .limit(100);

    return Response.json({ tests });
  } catch (error) {
    return Response.json({ error: "Unable to load tests", details: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const auth = requireTenantSession(req, "tests.edit");
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "tests.view");
    if (moduleAuth.error) return moduleAuth.error;

    const body = await req.json();
    const name = clean(body.name);
    const category = clean(body.category);
    const parameters = normalizeParameters(body.parameters);

    if (!name) return Response.json({ error: "Test name is required" }, { status: 400 });
    if (!category) return Response.json({ error: "Category is required" }, { status: 400 });
    if (parameters.length === 0) {
      return Response.json({ error: "At least one parameter is required" }, { status: 400 });
    }

    const { TestDefinition } = await getTenantModels(auth.tenantId);
    const test = await TestDefinition.create({
      name,
      code: clean(body.code).toUpperCase() || undefined,
      category,
      sampleType: clean(body.sampleType),
      price: Number(body.price) || 0,
      parameters,
      status: body.status === "inactive" ? "inactive" : "active",
    });

    await test.populate("category", "name categoryId");

    return Response.json({ test }, { status: 201 });
  } catch (error) {
    if (error.code === 11000) {
      return Response.json({ error: "A test with this name/code already exists" }, { status: 409 });
    }

    return Response.json({ error: "Unable to create test", details: error.message }, { status: 500 });
  }
}
