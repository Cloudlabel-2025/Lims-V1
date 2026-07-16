import { jsonError } from "@/app/lib/api-response";
import { writeAuditLog } from "@/app/lib/audit";
import { requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";
import { getTenantModels } from "@/app/lib/tenant-db";

function clean(value) {
  return String(value || "").trim();
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

    const { InventoryItemType } = await getTenantModels(auth.tenantId);
    const types = await InventoryItemType.find({}).sort({ name: 1 }).lean();

    const defaultTypes = ["reagent", "consumable", "chemical", "control", "calibrator", "equipment", "stationery", "other"];
    if (types.length === 0) {
      await InventoryItemType.insertMany(defaultTypes.map((name) => ({ name })));
      types.push(...defaultTypes.map((name) => ({ name })));
    }

    return Response.json({ types });
  } catch (error) {
    return jsonError("Unable to load item types", error, 500);
  }
}

export async function POST(req) {
  try {
    const auth = await requireInventory(req, "inventory.manage");
    if (auth.error) return auth.error;

    const body = await req.json();
    const name = clean(body.name);
    if (!name) return Response.json({ error: "Item type name is required" }, { status: 400 });

    const { InventoryItemType } = await getTenantModels(auth.tenantId);
    const exists = await InventoryItemType.findOne({ name: new RegExp(`^${escapeRegex(name)}$`, "i") });
    if (exists) return Response.json({ error: "Item type already exists" }, { status: 409 });

    const itemType = await InventoryItemType.create({ name });
    writeAuditLog(req, auth, { action: "create", resourceType: "InventoryItemType", resourceId: itemType._id, metadata: { name } }).catch(() => {});
    return Response.json({ itemType }, { status: 201 });
  } catch (error) {
    return jsonError("Unable to create item type", error, 500);
  }
}
