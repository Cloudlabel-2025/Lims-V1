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

    const { InventoryStorageCondition } = await getTenantModels(auth.tenantId);
    const conditions = await InventoryStorageCondition.find({}).sort({ name: 1 }).lean();

    const defaults = [
      "Room Temperature (15\u201325\u00b0C)", "Refrigerated (2\u20138\u00b0C)", "Frozen (\u201320\u00b0C)",
      "Deep Freeze (\u201380\u00b0C)", "Cold Room", "Controlled Room Temperature (20\u201325\u00b0C)",
      "Inert Atmosphere", "Desiccated", "Light-Sensitive", "Ventilated Area",
      "Flammable Cabinet", "Corrosive Cabinet", "Toxic Storage", "Cryogenic", "Ambient",
    ];

    if (conditions.length === 0) {
      await InventoryStorageCondition.insertMany(defaults.map((name) => ({ name })));
      conditions.push(...defaults.map((name) => ({ name })));
    }

    return Response.json({ storageConditions: conditions });
  } catch (error) {
    return jsonError("Unable to load storage conditions", error, 500);
  }
}

export async function POST(req) {
  try {
    const auth = await requireInventory(req, "inventory.manage");
    if (auth.error) return auth.error;

    const body = await req.json();
    const name = clean(body.name);
    if (!name) return Response.json({ error: "Storage condition name is required" }, { status: 400 });

    const { InventoryStorageCondition } = await getTenantModels(auth.tenantId);
    const exists = await InventoryStorageCondition.findOne({ name: new RegExp(`^${escapeRegex(name)}$`, "i") });
    if (exists) return Response.json({ error: "Storage condition already exists" }, { status: 409 });

    const storageCondition = await InventoryStorageCondition.create({ name });
    writeAuditLog(req, auth, { action: "create", resourceType: "InventoryStorageCondition", resourceId: storageCondition._id, metadata: { name } }).catch(() => {});
    return Response.json({ storageCondition }, { status: 201 });
  } catch (error) {
    return jsonError("Unable to create storage condition", error, 500);
  }
}
