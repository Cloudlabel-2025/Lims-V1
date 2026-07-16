import mongoose from "mongoose";
import { jsonError } from "@/app/lib/api-response";
import { getTenantModels } from "@/app/lib/tenant-db";
import { requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";

function clean(value) {
  return String(value || "").trim();
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function requireInventoryAuth(req) {
  const auth = requireTenantSession(req, "accounts.manage");
  if (auth.error) return { error: auth.error };

  const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "accounts.view");
  if (moduleAuth.error) return { error: moduleAuth.error };
  return auth;
}

export async function PATCH(req, context) {
  try {
    const auth = await requireInventoryAuth(req);
    if (auth.error) return auth.error;

    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return Response.json({ error: "Invalid category id" }, { status: 400 });
    }

    const body = await req.json();
    const name = clean(body.name);
    if (!name) return Response.json({ error: "Category name is required" }, { status: 400 });

    const { ExpenseCategory } = await getTenantModels(auth.tenantId);
    const category = await ExpenseCategory.findById(id);
    if (!category) return Response.json({ error: "Category not found" }, { status: 404 });

    const duplicate = await ExpenseCategory.findOne({ name: new RegExp(`^${escapeRegex(name)}$`, "i"), _id: { $ne: id } });
    if (duplicate) return Response.json({ error: "Category already exists" }, { status: 409 });

    category.name = name;
    await category.save();
    return Response.json({ category });
  } catch (error) {
    return jsonError("Unable to update category", error, 500);
  }
}

export async function DELETE(req, context) {
  try {
    const auth = await requireInventoryAuth(req);
    if (auth.error) return auth.error;

    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return Response.json({ error: "Invalid category id" }, { status: 400 });
    }

    const { ExpenseCategory, ExpenseEntry } = await getTenantModels(auth.tenantId);
    const category = await ExpenseCategory.findById(id);
    if (!category) return Response.json({ error: "Category not found" }, { status: 404 });

    const inUse = await ExpenseEntry.countDocuments({ category: category.name });
    if (inUse > 0) {
      return Response.json({ error: `Cannot delete "${category.name}" - it is used by ${inUse} expense(s)` }, { status: 400 });
    }

    await ExpenseCategory.findByIdAndDelete(id);
    return Response.json({ message: "Category deleted" });
  } catch (error) {
    return jsonError("Unable to delete category", error, 500);
  }
}