import mongoose from "mongoose";
import { jsonError } from "@/app/lib/api-response";
import { requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";
import { getTenantModels } from "@/app/lib/tenant-db";

function clean(value) { return String(value || "").trim(); }
function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

async function requireInventory(req, permission = "inventory.manage") {
  const auth = requireTenantSession(req, permission);
  if (auth.error) return { error: auth.error };
  const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "inventory.view");
  if (moduleAuth.error) return { error: moduleAuth.error };
  return auth;
}

export async function PATCH(req, context) {
  try {
    const auth = await requireInventory(req);
    if (auth.error) return auth.error;
    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return Response.json({ error: "Invalid UOM id" }, { status: 400 });
    }
    const body = await req.json();
    const name = clean(body.name);
    if (!name) return Response.json({ error: "UOM name is required" }, { status: 400 });
    const symbol = clean(body.symbol);
    if (!symbol) return Response.json({ error: "UOM symbol is required" }, { status: 400 });
    const conv = body.conversionToBase;
    if (conv === undefined || conv === null || conv === "") {
      return Response.json({ error: "Conversion to base is required" }, { status: 400 });
    }
    if (/[eE]/.test(String(conv))) {
      return Response.json({ error: "Exponential notation is not allowed in conversion factor" }, { status: 400 });
    }
    if (Number(conv) <= 0) {
      return Response.json({ error: "Conversion factor must be greater than 0" }, { status: 400 });
    }
    const baseSymbol = clean(body.baseSymbol);
    if (!baseSymbol) return Response.json({ error: "Base symbol is required" }, { status: 400 });

    const { InventoryUom } = await getTenantModels(auth.tenantId);
    const uom = await InventoryUom.findById(id);
    if (!uom) return Response.json({ error: "UOM not found" }, { status: 404 });

    const duplicate = await InventoryUom.findOne({
      symbol: new RegExp(`^${escapeRegex(symbol)}$`, "i"),
      _id: { $ne: id },
    });
    if (duplicate) return Response.json({ error: "UOM symbol already exists" }, { status: 409 });

    uom.name = name;
    uom.symbol = symbol;
    uom.type = clean(body.type) || "count";
    uom.conversionToBase = Number(conv);
    uom.baseSymbol = baseSymbol;
    if (body.status) uom.status = body.status;
    await uom.save();
    return Response.json({ uom });
  } catch (error) {
    return jsonError("Unable to update UOM", error, 500);
  }
}

export async function DELETE(req, context) {
  try {
    const auth = await requireInventory(req);
    if (auth.error) return auth.error;
    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return Response.json({ error: "Invalid UOM id" }, { status: 400 });
    }
    const { InventoryUom, InventoryItem } = await getTenantModels(auth.tenantId);
    const uom = await InventoryUom.findById(id);
    if (!uom) return Response.json({ error: "UOM not found" }, { status: 404 });

    const inUse = await InventoryItem.countDocuments({
      $or: [{ baseUom: id }, { purchaseUom: id }],
    });
    if (inUse > 0) {
      return Response.json({
        error: `Cannot delete "${uom.symbol}" - it is used by ${inUse} item(s) as base or purchase UOM`,
      }, { status: 400 });
    }

    await InventoryUom.findByIdAndDelete(id);
    return Response.json({ message: "UOM deleted" });
  } catch (error) {
    return jsonError("Unable to delete UOM", error, 500);
  }
}