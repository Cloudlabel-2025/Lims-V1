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

export async function GET(req) {
  try {
    const auth = await requireInventory(req);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(req.url);
    const search = clean(searchParams.get("search"));
    const status = clean(searchParams.get("status"));
    const query = {};
    if (status && status !== "all") query.status = status;
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      query.$or = [{ name: regex }, { code: regex }, { contactPerson: regex }];
    }

    const { InventorySupplier } = await getTenantModels(auth.tenantId);
    const suppliers = await InventorySupplier.find(query).populate("items", "name itemCode").sort({ name: 1 }).lean();

    return Response.json({ suppliers });
  } catch (error) {
    return jsonError("Unable to load suppliers", error, 500);
  }
}

export async function POST(req) {
  try {
    const auth = await requireInventory(req, "inventory.manage");
    if (auth.error) return auth.error;

    const body = await req.json();
    const name = clean(body.name);
    const code = clean(body.code);

    if (!name) return Response.json({ error: "Supplier name is required" }, { status: 400 });
    if (name.length > 120) return Response.json({ error: "Name must not exceed 120 characters" }, { status: 400 });
    if (!isValidName(name)) return Response.json({ error: "Name contains invalid characters" }, { status: 400 });
    if (hasUrl(name)) return Response.json({ error: "URLs are not allowed in name" }, { status: 400 });

    if (!code) return Response.json({ error: "Supplier code is required" }, { status: 400 });
    if (code.length > 20) return Response.json({ error: "Code must not exceed 20 characters" }, { status: 400 });
    if (!/^[A-Z0-9-]+$/.test(code)) return Response.json({ error: "Code must contain only uppercase letters, numbers, and hyphens" }, { status: 400 });
    if (hasUrl(code)) return Response.json({ error: "URLs are not allowed in code" }, { status: 400 });

    const contactPerson = clean(body.contactPerson);
    if (contactPerson && !isValidName(contactPerson)) return Response.json({ error: "Contact person contains invalid characters" }, { status: 400 });
    if (hasUrl(contactPerson)) return Response.json({ error: "URLs are not allowed in contact person" }, { status: 400 });

    const email = clean(body.email);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: "Invalid email format" }, { status: 400 });

    const phone = clean(body.phone);
    if (phone && !/^[0-9+\-() ]+$/.test(phone)) return Response.json({ error: "Phone contains invalid characters" }, { status: 400 });

    const leadTimeDays = Number(body.leadTimeDays);
    if (body.leadTimeDays !== undefined && body.leadTimeDays !== "" && (!Number.isFinite(leadTimeDays) || leadTimeDays < 0)) {
      return Response.json({ error: "Lead time must be a non-negative number" }, { status: 400 });
    }

    const rating = Number(body.rating);
    if (body.rating !== undefined && body.rating !== "" && (!Number.isFinite(rating) || rating < 1 || rating > 5)) {
      return Response.json({ error: "Rating must be between 1 and 5" }, { status: 400 });
    }

    const manufacturer = clean(body.manufacturer);

    const { InventorySupplier } = await getTenantModels(auth.tenantId);
    const exists = await InventorySupplier.findOne({ code: code.toUpperCase() });
    if (exists) return Response.json({ error: "A supplier with this code already exists" }, { status: 409 });

    const supplier = await InventorySupplier.create({
      name,
      code: code.toUpperCase(),
      contactPerson: contactPerson || undefined,
      email: email || undefined,
      phone: phone || undefined,
      address: clean(body.address) || undefined,
      leadTimeDays: Number.isFinite(leadTimeDays) ? leadTimeDays : 7,
      rating: Number.isFinite(rating) ? rating : 3,
      notes: clean(body.notes) || undefined,
      manufacturer: manufacturer || undefined,
      items: Array.isArray(body.items) ? body.items : undefined,
    });

    writeAuditLog(req, auth, {
      action: "create",
      resourceType: "InventorySupplier",
      resourceId: supplier._id,
      metadata: { name: supplier.name, code: supplier.code },
    }).catch(() => {});

    return Response.json({ supplier }, { status: 201 });
  } catch (error) {
    if (error.code === 11000) return Response.json({ error: "Supplier code already exists" }, { status: 409 });
    return jsonError("Unable to create supplier", error, 500);
  }
}
