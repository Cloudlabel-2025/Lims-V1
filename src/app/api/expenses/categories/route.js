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

export async function GET(req) {
  try {
    const auth = requireTenantSession(req, "accounts.view");
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "accounts.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { ExpenseCategory } = await getTenantModels(auth.tenantId);
    const categories = await ExpenseCategory.find({}).select("name").sort({ name: 1 }).lean();

    const defaultCategories = ["reagent", "staff", "equipment", "overhead"];
    if (categories.length === 0) {
      const inserted = await ExpenseCategory.insertMany(defaultCategories.map((name) => ({ name })));
      return Response.json({ categories: inserted.map((c) => ({ _id: c._id, name: c.name })) });
    }

    return Response.json({ categories: categories.map((c) => ({ _id: c._id, name: c.name })) });
  } catch (error) {
    return jsonError("Unable to load expense categories", error, 500);
  }
}

export async function POST(req) {
  try {
    const auth = await requireInventoryAuth(req);
    if (auth.error) return auth.error;

    const body = await req.json();
    const name = clean(body.name);
    if (!name) return Response.json({ error: "Category name is required" }, { status: 400 });

    const { ExpenseCategory } = await getTenantModels(auth.tenantId);

    const duplicate = await ExpenseCategory.findOne({ name: new RegExp(`^${escapeRegex(name)}$`, "i") });
    if (duplicate) return Response.json({ error: "Category already exists" }, { status: 409 });

    const category = await ExpenseCategory.create({ name });
    return Response.json({ category }, { status: 201 });
  } catch (error) {
    return jsonError("Unable to create expense category", error, 500);
  }
}