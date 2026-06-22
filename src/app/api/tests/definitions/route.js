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

function isExponentialNotation(value) {
  if (typeof value === "string" && /[eE]/.test(value)) return true;
  return false;
}

function normalizeParameters(parameters, errors) {
  if (!Array.isArray(parameters)) return [];

  return parameters
    .map((parameter, index) => {
      if (!parameter) return null;
      const name = clean(parameter.name);

      if (!name) {
        errors.push(`Parameter ${index + 1} name is required`);
        return null;
      }

      if (!/^[A-Za-z][A-Za-z0-9 .&'\/,-]*$/.test(name)) {
        errors.push(`Parameter ${index + 1} name contains invalid characters`);
        return null;
      }

      if (/https?:\/\/|www\./i.test(name)) {
        errors.push(`Parameter ${index + 1} name cannot contain a URL`);
        return null;
      }

      const unit = clean(parameter.unit);
      if (!unit) {
        errors.push(`Parameter ${index + 1} unit is required`);
        return null;
      }

      if (!/^[0-9]+(\.[0-9]+)?$/.test(unit)) {
        errors.push(`Parameter ${index + 1} unit should be only measured in numerals`);
        return null;
      }

      if (/https?:\/\/|www\./i.test(unit)) {
        errors.push(`Parameter ${index + 1} unit cannot contain a URL`);
        return null;
      }

      const maleMin = parameter.maleMin === "" || parameter.maleMin === null ? undefined : Number(parameter.maleMin);
      const maleMax = parameter.maleMax === "" || parameter.maleMax === null ? undefined : Number(parameter.maleMax);
      const femaleMin = parameter.femaleMin === "" || parameter.femaleMin === null ? undefined : Number(parameter.femaleMin);
      const femaleMax = parameter.femaleMax === "" || parameter.femaleMax === null ? undefined : Number(parameter.femaleMax);
      const normalMin = parameter.normalMin === "" || parameter.normalMin === null ? undefined : Number(parameter.normalMin);
      const normalMax = parameter.normalMax === "" || parameter.normalMax === null ? undefined : Number(parameter.normalMax);

      if (isExponentialNotation(parameter.maleMin) || isExponentialNotation(parameter.maleMax) ||
          isExponentialNotation(parameter.femaleMin) || isExponentialNotation(parameter.femaleMax) ||
          isExponentialNotation(parameter.normalMin) || isExponentialNotation(parameter.normalMax)) {
        errors.push(`Parameter ${index + 1} range contains an invalid value`);
        return null;
      }

      return {
        key: slug(parameter.key || name, `parameter-${index + 1}`),
        name,
        unit,
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

function validateField(value, pattern, fieldName, errors) {
  if (!value) {
    errors.push(`${fieldName} is required`);
    return false;
  }
  if (pattern && !pattern.test(value)) {
    errors.push(`${fieldName} contains invalid characters`);
    return false;
  }
  if (/https?:\/\/|www\./i.test(value)) {
    errors.push(`${fieldName} cannot contain a URL`);
    return false;
  }
  return true;
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

    const errors = [];

    const name = clean(body.name);
    if (!validateField(name, /^[A-Za-z][A-Za-z0-9 .&'\/,-]*$/, "Test name", errors)) {
      return Response.json({ error: errors[0] }, { status: 400 });
    }

    const category = clean(body.category);
    if (!category) {
      return Response.json({ error: "Category is required" }, { status: 400 });
    }

    if (!mongoose.Types.ObjectId.isValid(category)) {
      return Response.json({ error: "Invalid Department selected" }, { status: 400 });
    }

    const code = clean(body.code);
    if (!validateField(code, /^[A-Za-z0-9_-]+$/, "Code", errors)) {
      return Response.json({ error: errors[0] }, { status: 400 });
    }

    const sampleType = clean(body.sampleType);
    if (!validateField(sampleType, /^[A-Za-z][A-Za-z0-9 .&'\/,-]*$/, "Sample type", errors)) {
      return Response.json({ error: errors[0] }, { status: 400 });
    }

    const price = body.price === "" || body.price === null || body.price === undefined ? undefined : Number(body.price);
    if (price === undefined || isNaN(price)) {
      return Response.json({ error: "Price is required" }, { status: 400 });
    }
    if (price > 999999999) {
      return Response.json({ error: "Price contains an invalid value" }, { status: 400 });
    }

    const paramErrors = [];
    const parameters = normalizeParameters(body.parameters, paramErrors);
    if (paramErrors.length > 0) {
      return Response.json({ error: paramErrors[0] }, { status: 400 });
    }

    const { TestDefinition } = await getTenantModels(auth.tenantId);
    const test = await TestDefinition.create({
      name,
      code: code.toUpperCase() || undefined,
      category,
      sampleType,
      price,
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
