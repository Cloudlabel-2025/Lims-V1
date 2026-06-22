import { jsonError } from "@/app/lib/api-response";
import { getTenantModels } from "@/app/lib/tenant-db";
import { requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";

function clean(value) {
  return String(value || "").trim();
}

export async function GET(req, { params }) {
  try {
    const auth = requireTenantSession(req, "tests.view");
    if (auth.error) return auth.error;

    const { id } = await params;
    const { TestCategory } = await getTenantModels(auth.tenantId);
    const category = await TestCategory.findById(id)
      .select("categoryId name description status createdAt updatedAt");

    if (!category) return Response.json({ error: "Category not found" }, { status: 404 });

    return Response.json({ category });
  } catch (error) {
    return jsonError("Unable to fetch category", error, 500);
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
    const name = clean(body.name);

    if (!name) {
      return Response.json({ error: "Category name is required" }, { status: 400 });
    }

    if (!/^[A-Za-z][A-Za-z0-9 .&'\/,-]*$/.test(name)) {
      return Response.json({ error: "Category name contains invalid characters" }, { status: 400 });
    }

    if (/https?:\/\/|www\./i.test(name)) {
      return Response.json({ error: "Category name cannot contain a URL" }, { status: 400 });
    }

    const { TestCategory } = await getTenantModels(auth.tenantId);
    const category = await TestCategory.findByIdAndUpdate(
      id,
      {
        $set: {
          name,
          description: clean(body.description),
          status: body.status === "inactive" ? "inactive" : "active",
        },
      },
      { returnDocument: "after", runValidators: true }
    );

    if (!category) return Response.json({ error: "Category not found" }, { status: 404 });

    return Response.json({ category });
  } catch (error) {
    if (error.code === 11000) {
      return Response.json({ error: "Category already exists" }, { status: 409 });
    }

    return jsonError("Unable to update category", error, 500);
  }
}

export async function DELETE(req, { params }) {
  try {
    const auth = requireTenantSession(req, "tests.delete");
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "tests.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { id } = await params;
    const { TestCategory } = await getTenantModels(auth.tenantId);
    const category = await TestCategory.findByIdAndUpdate(
      id,
      { $set: { status: "inactive" } },
      { returnDocument: "after" }
    );

    if (!category) return Response.json({ error: "Category not found" }, { status: 404 });

    return Response.json({ category });
  } catch (error) {
    return jsonError("Unable to disable category", error, 500);
  }
}
