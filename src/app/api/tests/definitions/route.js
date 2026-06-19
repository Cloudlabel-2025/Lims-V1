import { jsonError } from "@/app/lib/api-response";
import { getTenantModels } from "@/app/lib/tenant-db";
import { hasPermission, requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";
import mongoose from "mongoose";

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
      if (!parameter) return null;
      const name = clean(parameter.name);

      const maleMin = parameter.maleMin === "" || parameter.maleMin === null ? undefined : Number(parameter.maleMin);
      const maleMax = parameter.maleMax === "" || parameter.maleMax === null ? undefined : Number(parameter.maleMax);
      const femaleMin = parameter.femaleMin === "" || parameter.femaleMin === null ? undefined : Number(parameter.femaleMin);
      const femaleMax = parameter.femaleMax === "" || parameter.femaleMax === null ? undefined : Number(parameter.femaleMax);
      const normalMin = parameter.normalMin === "" || parameter.normalMin === null ? undefined : Number(parameter.normalMin);
      const normalMax = parameter.normalMax === "" || parameter.normalMax === null ? undefined : Number(parameter.normalMax);

      return {
        key: slug(parameter.key || name, `parameter-${index + 1}`),
        name,
        unit: clean(parameter.unit),
        maleMin: Number.isFinite(maleMin) ? maleMin : undefined,
        maleMax: Number.isFinite(maleMax) ? maleMax : undefined,
        femaleMin: Number.isFinite(femaleMin) ? femaleMin : undefined,
        femaleMax: Number.isFinite(femaleMax) ? femaleMax : undefined,
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
      .select("testId name code category sampleType price parameters status createdAt updatedAt")
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean();

    return Response.json({ tests });
  } catch (error) {
    return jsonError("Unable to load tests", error, 500);
  }
}

export async function POST(req) {
  try {
    const auth = requireTenantSession(req, "tests.create");
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "tests.view");
    if (moduleAuth.error) return moduleAuth.error;

    const body = await req.json();
    if (!hasPermission(auth.session, "tests.price") && Number(body.price || 0) !== 0) {
      return Response.json({ error: "tests.price permission is required to set test price" }, { status: 403 });
    }

    const name = clean(body.name);
    const category = clean(body.category);
    const parameters = normalizeParameters(body.parameters);

    if (!name) return Response.json({ error: "Test name is required" }, { status: 400 });
    if (!category) return Response.json({ error: "Category is required" }, { status: 400 });

    if (!mongoose.Types.ObjectId.isValid(category)) {
      return Response.json({ error: "Invalid Department selected" }, { status: 400 });
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

    console.error("[TEST_CREATE_ERROR]:", error);
    return jsonError("Unable to create test", error, 500);
  }
}
