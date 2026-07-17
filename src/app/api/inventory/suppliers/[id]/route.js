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
    const { InventorySupplier, InventoryItem } = await getTenantModels(auth.tenantId);

    const supplier = await InventorySupplier.findById(id);
    if (!supplier) return Response.json({ error: "Supplier not found" }, { status: 404 });

    const updates = {};

    if (body.name !== undefined) {
      const name = clean(body.name);
      if (!name) return Response.json({ error: "Supplier name is required" }, { status: 400 });
      if (name.length > 120) return Response.json({ error: "Name must not exceed 120 characters" }, { status: 400 });
      if (!isValidName(name)) return Response.json({ error: "Name contains invalid characters" }, { status: 400 });
      if (hasUrl(name)) return Response.json({ error: "URLs are not allowed in name" }, { status: 400 });
      updates.name = name;
    }

    if (body.code !== undefined) {
      const code = clean(body.code).toUpperCase();
      if (!code) return Response.json({ error: "Supplier code is required" }, { status: 400 });
      if (code.length > 20) return Response.json({ error: "Code must not exceed 20 characters" }, { status: 400 });
      if (!/^[A-Z0-9-]+$/.test(code)) return Response.json({ error: "Code must contain only uppercase letters, numbers, and hyphens" }, { status: 400 });
      if (code !== supplier.code) {
        const exists = await InventorySupplier.findOne({ code });
        if (exists) return Response.json({ error: "A supplier with this code already exists" }, { status: 409 });
      }
      updates.code = code;
    }

    if (body.contactPerson !== undefined) {
      const cp = clean(body.contactPerson);
      if (cp && !isValidName(cp)) return Response.json({ error: "Contact person contains invalid characters" }, { status: 400 });
      if (hasUrl(cp)) return Response.json({ error: "URLs are not allowed in contact person" }, { status: 400 });
      updates.contactPerson = cp || undefined;
    }

    if (body.email !== undefined) {
      const email = clean(body.email);
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: "Invalid email format" }, { status: 400 });
      updates.email = email || undefined;
    }

    if (body.phone !== undefined) {
      const phone = clean(body.phone);
      if (phone && !/^[0-9+\-() ]+$/.test(phone)) return Response.json({ error: "Phone contains invalid characters" }, { status: 400 });
      updates.phone = phone || undefined;
    }

    if (body.address !== undefined) updates.address = clean(body.address) || undefined;

    if (body.leadTimeDays !== undefined) {
      const ltd = Number(body.leadTimeDays);
      if (body.leadTimeDays !== "" && (!Number.isFinite(ltd) || ltd < 0)) return Response.json({ error: "Lead time must be a non-negative number" }, { status: 400 });
      updates.leadTimeDays = Number.isFinite(ltd) ? ltd : 7;
    }

    if (body.rating !== undefined) {
      const r = Number(body.rating);
      if (body.rating !== "" && (!Number.isFinite(r) || r < 1 || r > 5)) return Response.json({ error: "Rating must be between 1 and 5" }, { status: 400 });
      updates.rating = Number.isFinite(r) ? r : 3;
    }

    if (body.notes !== undefined) updates.notes = clean(body.notes) || undefined;
    if (body.manufacturer !== undefined) updates.manufacturer = clean(body.manufacturer) || undefined;
    if (body.items !== undefined) updates.items = Array.isArray(body.items) ? body.items : [];
    if (body.status !== undefined) {
      if (!["active", "inactive"].includes(body.status)) return Response.json({ error: "Invalid status" }, { status: 400 });
      updates.status = body.status;
    }

    Object.assign(supplier, updates);
    await supplier.save();

    writeAuditLog(req, auth, {
      action: "update",
      resourceType: "InventorySupplier",
      resourceId: supplier._id,
      metadata: { name: supplier.name, code: supplier.code, changes: Object.keys(updates) },
    }).catch(() => {});

    return Response.json({ supplier });
  } catch (error) {
    if (error.code === 11000) return Response.json({ error: "Supplier code already exists" }, { status: 409 });
    return jsonError("Unable to update supplier", error, 500);
  }
}

export async function DELETE(req, { params }) {
  try {
    const auth = await requireInventory(req, "inventory.manage");
    if (auth.error) return auth.error;

    const { id } = await params;
    const { InventorySupplier, InventoryItem } = await getTenantModels(auth.tenantId);

    const supplier = await InventorySupplier.findById(id);
    if (!supplier) return Response.json({ error: "Supplier not found" }, { status: 404 });

    const referencedByItem = await InventoryItem.findOne({ preferredSupplierRef: id, status: "active" }).lean();
    if (referencedByItem) {
      return Response.json({ error: `Cannot deactivate — supplier is referenced by active item "${referencedByItem.name}"` }, { status: 400 });
    }

    supplier.status = "inactive";
    await supplier.save();

    writeAuditLog(req, auth, {
      action: "delete",
      resourceType: "InventorySupplier",
      resourceId: supplier._id,
      metadata: { name: supplier.name, code: supplier.code },
    }).catch(() => {});

    return Response.json({ success: true });
  } catch (error) {
    return jsonError("Unable to delete supplier", error, 500);
  }
}
