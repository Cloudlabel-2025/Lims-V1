import { jsonError } from "@/app/lib/api-response";
import { getTenantModels } from "@/app/lib/tenant-db";
import { hasPermission, requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";

function clean(value) {
  return String(value || "").trim();
}

export async function GET(req, { params }) {
  try {
    const auth = requireTenantSession(req, "tests.view");
    if (auth.error) return auth.error;

    const { id } = await params;
    const { TestPackage } = await getTenantModels(auth.tenantId);
    const pkg = await TestPackage.findById(id)
      .populate("tests", "name code price")
      .select("packageId name code description price tests status createdAt updatedAt");

    if (!pkg) return Response.json({ error: "Package not found" }, { status: 404 });

    return Response.json({ package: pkg });
  } catch (error) {
    return jsonError("Unable to fetch package", error, 500);
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

    if (tests.length === 0) return Response.json({ error: "At least one test must be included" }, { status: 400 });

    const { TestPackage } = await getTenantModels(auth.tenantId);
    const existing = await TestPackage.findById(id);
    if (!existing) return Response.json({ error: "Package not found" }, { status: 404 });

    const rawPrice = body.price === "" || body.price === null || body.price === undefined ? undefined : Number(body.price);
    if (rawPrice === undefined || isNaN(rawPrice)) {
      return Response.json({ error: "Package price is required" }, { status: 400 });
    }
    if (rawPrice > 999999999) {
      return Response.json({ error: "Package price contains an invalid value" }, { status: 400 });
    }

    const nextPrice = rawPrice;
    if (nextPrice !== existing.price && !hasPermission(auth.session, "tests.price")) {
      return Response.json({ error: "tests.price permission is required to change package price" }, { status: 403 });
    }

    const pkg = await TestPackage.findByIdAndUpdate(
      id,
      {
        $set: {
          name,
          code: code.toUpperCase() || undefined,
          description: clean(body.description),
          price: nextPrice,
          tests,
          status: body.status === "inactive" ? "inactive" : "active",
        },
      },
      { returnDocument: "after", runValidators: true }
    ).populate("tests", "name code price");

    if (!pkg) return Response.json({ error: "Package not found" }, { status: 404 });

    return Response.json({ package: pkg });
  } catch (error) {
    if (error.code === 11000) {
      return Response.json({ error: "A package with this name/code already exists" }, { status: 409 });
    }

    return jsonError("Unable to update package", error, 500);
  }
}

export async function DELETE(req, { params }) {
  try {
    const auth = requireTenantSession(req, "tests.delete");
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "tests.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { id } = await params;
    const { TestPackage } = await getTenantModels(auth.tenantId);
    const pkg = await TestPackage.findByIdAndUpdate(
      id,
      { $set: { status: "inactive" } },
      { returnDocument: "after" }
    );

    if (!pkg) return Response.json({ error: "Package not found" }, { status: 404 });

    return Response.json({ package: pkg });
  } catch (error) {
    return jsonError("Unable to disable package", error, 500);
  }
}
