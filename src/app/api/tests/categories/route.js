import { jsonError } from "@/app/lib/api-response";
import { getTenantModels } from "@/app/lib/tenant-db";
import { requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";

function clean(value) {
  return String(value || "").trim();
}

export async function GET(req) {
  try {
    const auth = requireTenantSession(req, "tests.view");
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "tests.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { TestCategory } = await getTenantModels(auth.tenantId);
    const categories = await TestCategory.find({})
      .select("categoryId name description status createdAt updatedAt")
      .sort({ name: 1 })
      .lean();

    return Response.json({ categories });
  } catch (error) {
    return jsonError("Unable to load categories", error, 500);
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

    if (!name) {
      return Response.json({ error: "Category name is required" }, { status: 400 });
    }

    const { TestCategory } = await getTenantModels(auth.tenantId);
    const category = await TestCategory.create({
      name,
      description: clean(body.description),
      status: body.status === "inactive" ? "inactive" : "active",
    });

    return Response.json({ category }, { status: 201 });
  } catch (error) {
    if (error.code === 11000) {
      return Response.json({ error: "Category already exists" }, { status: 409 });
    }

    return jsonError("Unable to create category", error, 500);
  }
}
