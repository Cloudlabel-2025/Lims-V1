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

export async function GET(req, { params }) {
  try {
    const auth = requireTenantSession(req, "tests.view");
    if (auth.error) return auth.error;

    const { id } = await params;
    const { TestDefinition } = await getTenantModels(auth.tenantId);
    const test = await TestDefinition.findById(id).populate("category", "name categoryId");

    if (!test) return Response.json({ error: "Test not found" }, { status: 404 });

    return Response.json({ test });
  } catch (error) {
    return Response.json({ error: "Unable to fetch test", details: error.message }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    const auth = requireTenantSession(req, "tests.edit");
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "tests.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { id } = await params;
    const body = await req.json();
    const parameters = normalizeParameters(body.parameters);

    if (!clean(body.name)) return Response.json({ error: "Test name is required" }, { status: 400 });
    if (!clean(body.category)) return Response.json({ error: "Category is required" }, { status: 400 });
    if (parameters.length === 0) {
      return Response.json({ error: "At least one parameter is required" }, { status: 400 });
    }

    const { TestDefinition } = await getTenantModels(auth.tenantId);
    const test = await TestDefinition.findByIdAndUpdate(
      id,
      {
        $set: {
          name: clean(body.name),
          code: clean(body.code).toUpperCase() || undefined,
          category: clean(body.category),
          sampleType: clean(body.sampleType),
          price: Number(body.price) || 0,
          parameters,
          status: body.status === "inactive" ? "inactive" : "active",
        },
      },
      { returnDocument: "after", runValidators: true }
    ).populate("category", "name categoryId");

    if (!test) return Response.json({ error: "Test not found" }, { status: 404 });

    return Response.json({ test });
  } catch (error) {
    if (error.code === 11000) {
      return Response.json({ error: "A test with this name/code already exists" }, { status: 409 });
    }

    return Response.json({ error: "Unable to update test", details: error.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const auth = requireTenantSession(req, "tests.delete");
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "tests.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { id } = await params;
    const { TestDefinition } = await getTenantModels(auth.tenantId);
    const test = await TestDefinition.findByIdAndUpdate(
      id,
      { $set: { status: "inactive" } },
      { returnDocument: "after" }
    );

    if (!test) return Response.json({ error: "Test not found" }, { status: 404 });

    return Response.json({ test });
  } catch (error) {
    return Response.json({ error: "Unable to disable test", details: error.message }, { status: 500 });
  }
}
