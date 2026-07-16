import { jsonError } from "@/app/lib/api-response";
import { writeAuditLog } from "@/app/lib/audit";
import { requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";
import { getTenantModels } from "@/app/lib/tenant-db";

function clean(value) {
  return String(value || "").trim();
}

function hasUrl(value) {
  return /https?:\/\//.test(value);
}

function isValidName(value) {
  return /^[A-Za-z0-9 .&'\/,()@_-]*$/.test(value);
}

async function requireInventory(req, permission = "inventory.view") {
  const auth = requireTenantSession(req, permission);
  if (auth.error) return { error: auth.error };
  const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "inventory.view");
  if (moduleAuth.error) return { error: moduleAuth.error };
  return auth;
}

export async function PATCH(req, { params }) {
  try {
    const auth = await requireInventory(req, "inventory.manage");
    if (auth.error) return auth.error;

    const { id } = await params;
    const body = await req.json();
    const { InventoryLocation } = await getTenantModels(auth.tenantId);

    const location = await InventoryLocation.findById(id);
    if (!location) return Response.json({ error: "Location not found" }, { status: 404 });

    const updates = {};

    if (body.name !== undefined) {
      const name = clean(body.name);
      if (!name) return Response.json({ error: "Location name is required" }, { status: 400 });
      if (name.length > 120) return Response.json({ error: "Name must not exceed 120 characters" }, { status: 400 });
      if (!isValidName(name)) return Response.json({ error: "Name contains invalid characters" }, { status: 400 });
      if (hasUrl(name)) return Response.json({ error: "URLs are not allowed in name" }, { status: 400 });
      if (name !== location.name) {
        const exists = await InventoryLocation.findOne({ name });
        if (exists) return Response.json({ error: "A location with this name already exists" }, { status: 409 });
      }
      updates.name = name;
    }

    if (body.code !== undefined) {
      const code = clean(body.code).toUpperCase();
      if (!code) return Response.json({ error: "Location code is required" }, { status: 400 });
      if (code.length > 20) return Response.json({ error: "Code must not exceed 20 characters" }, { status: 400 });
      if (!/^[A-Z0-9-]+$/.test(code)) return Response.json({ error: "Code must contain only uppercase letters, numbers, and hyphens" }, { status: 400 });
      if (code !== location.code) {
        const exists = await InventoryLocation.findOne({ code });
        if (exists) return Response.json({ error: "A location with this code already exists" }, { status: 409 });
      }
      updates.code = code;
    }

    if (body.description !== undefined) updates.description = clean(body.description) || undefined;
    if (body.parentLocation !== undefined) updates.parentLocation = body.parentLocation || null;
    if (body.status !== undefined) {
      if (!["active", "inactive"].includes(body.status)) return Response.json({ error: "Invalid status" }, { status: 400 });
      updates.status = body.status;
    }

    Object.assign(location, updates);
    await location.save();

    writeAuditLog(req, auth, {
      action: "update",
      resourceType: "InventoryLocation",
      resourceId: location._id,
      metadata: { name: location.name, code: location.code },
    }).catch(() => {});

    return Response.json({ location });
  } catch (error) {
    if (error.code === 11000) return Response.json({ error: "Location name or code already exists" }, { status: 409 });
    return jsonError("Unable to update location", error, 500);
  }
}

export async function DELETE(req, { params }) {
  try {
    const auth = await requireInventory(req, "inventory.manage");
    if (auth.error) return auth.error;

    const { id } = await params;
    const { InventoryLocation, InventoryItem } = await getTenantModels(auth.tenantId);

    const location = await InventoryLocation.findById(id);
    if (!location) return Response.json({ error: "Location not found" }, { status: 404 });

    const usedInItems = await InventoryItem.countDocuments({
      $or: [{ defaultLocation: location.name }, { "batches.location": location.name }],
    });
    if (usedInItems > 0) {
      return Response.json({ error: `Cannot delete — location is used by ${usedInItems} item(s)` }, { status: 400 });
    }

    const usedInChildren = await InventoryLocation.countDocuments({ parentLocation: id });
    if (usedInChildren > 0) {
      return Response.json({ error: `Cannot delete — location has ${usedInChildren} child location(s)` }, { status: 400 });
    }

    await InventoryLocation.deleteOne({ _id: id });

    writeAuditLog(req, auth, {
      action: "delete",
      resourceType: "InventoryLocation",
      resourceId: location._id,
      metadata: { name: location.name, code: location.code },
    }).catch(() => {});

    return Response.json({ success: true });
  } catch (error) {
    return jsonError("Unable to delete location", error, 500);
  }
}
