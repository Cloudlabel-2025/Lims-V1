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
      query.$or = [{ name: regex }, { code: regex }];
    }

    const { InventoryLocation } = await getTenantModels(auth.tenantId);
    let locations = await InventoryLocation.find(query)
      .populate("parentLocation", "name code")
      .sort({ name: 1 })
      .lean();

    if (locations.length === 0) {
      const defaults = [
        { name: "Main Store", code: "MAIN" },
        { name: "Cold Store", code: "COLD" },
        { name: "Freezer", code: "FRZR" },
        { name: "Lab Area", code: "LAB" },
        { name: "Dispensary", code: "DISP" },
      ];
      await InventoryLocation.insertMany(defaults);
      locations = await InventoryLocation.find({}).populate("parentLocation", "name code").sort({ name: 1 }).lean();
    }

    return Response.json({ locations });
  } catch (error) {
    return jsonError("Unable to load locations", error, 500);
  }
}

export async function POST(req) {
  try {
    const auth = await requireInventory(req, "inventory.manage");
    if (auth.error) return auth.error;

    const body = await req.json();
    const name = clean(body.name);
    const code = clean(body.code);

    if (!name) return Response.json({ error: "Location name is required" }, { status: 400 });
    if (name.length > 120) return Response.json({ error: "Name must not exceed 120 characters" }, { status: 400 });
    if (!isValidName(name)) return Response.json({ error: "Name contains invalid characters" }, { status: 400 });
    if (hasUrl(name)) return Response.json({ error: "URLs are not allowed in name" }, { status: 400 });

    if (!code) return Response.json({ error: "Location code is required" }, { status: 400 });
    if (code.length > 20) return Response.json({ error: "Code must not exceed 20 characters" }, { status: 400 });
    if (!/^[A-Z0-9-]+$/.test(code)) return Response.json({ error: "Code must contain only uppercase letters, numbers, and hyphens" }, { status: 400 });
    if (hasUrl(code)) return Response.json({ error: "URLs are not allowed in code" }, { status: 400 });

    const { InventoryLocation } = await getTenantModels(auth.tenantId);
    const exists = await InventoryLocation.findOne({ $or: [{ name }, { code: code.toUpperCase() }] });
    if (exists) return Response.json({ error: "A location with this name or code already exists" }, { status: 409 });

    const location = await InventoryLocation.create({
      name,
      code: code.toUpperCase(),
      description: clean(body.description) || undefined,
      parentLocation: body.parentLocation || null,
    });

    writeAuditLog(req, auth, {
      action: "create",
      resourceType: "InventoryLocation",
      resourceId: location._id,
      metadata: { name: location.name, code: location.code },
    }).catch(() => {});

    return Response.json({ location }, { status: 201 });
  } catch (error) {
    if (error.code === 11000) return Response.json({ error: "Location name or code already exists" }, { status: 409 });
    return jsonError("Unable to create location", error, 500);
  }
}
