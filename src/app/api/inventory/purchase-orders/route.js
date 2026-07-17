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
      query.$or = [{ poNumber: regex }, { notes: regex }];
    }

    const { InventoryPurchaseOrder } = await getTenantModels(auth.tenantId);
    const purchaseOrders = await InventoryPurchaseOrder.find(query)
      .populate("supplier", "name code")
      .populate("items.item", "name itemCode")
      .sort({ createdAt: -1 })
      .lean();

    return Response.json({ purchaseOrders });
  } catch (error) {
    return jsonError("Unable to load purchase orders", error, 500);
  }
}

export async function POST(req) {
  try {
    const auth = await requireInventory(req, "inventory.manage");
    if (auth.error) return auth.error;

    const body = await req.json();
    const poNumber = clean(body.poNumber);
    if (!poNumber) return Response.json({ error: "PO number is required" }, { status: 400 });
    if (poNumber.length > 30) return Response.json({ error: "PO number must not exceed 30 characters" }, { status: 400 });
    if (!/^[A-Z0-9-]+$/.test(poNumber)) return Response.json({ error: "PO number must contain only uppercase letters, numbers, and hyphens" }, { status: 400 });
    if (hasUrl(poNumber)) return Response.json({ error: "URLs are not allowed in PO number" }, { status: 400 });

    if (!body.supplier) return Response.json({ error: "Supplier is required" }, { status: 400 });

    if (!Array.isArray(body.items) || body.items.length === 0) {
      return Response.json({ error: "At least one item is required" }, { status: 400 });
    }

    const { InventoryPurchaseOrder, InventorySupplier, InventoryMovement } = await getTenantModels(auth.tenantId);

    const supplierExists = await InventorySupplier.findById(body.supplier).lean();
    if (!supplierExists || supplierExists.status !== "active") {
      return Response.json({ error: "Supplier not found or inactive" }, { status: 400 });
    }

    const exists = await InventoryPurchaseOrder.findOne({ poNumber: poNumber.toUpperCase() });
    if (exists) return Response.json({ error: "A purchase order with this number already exists" }, { status: 409 });

    let totalAmount = 0;
    const items = body.items.map((it) => {
      const qty = Number(it.quantityOrdered);
      const cost = Number(it.unitCost);
      const lineTotal = (Number.isFinite(qty) ? qty : 0) * (Number.isFinite(cost) ? cost : 0);
      totalAmount += lineTotal;
      return {
        item: it.item,
        quantityOrdered: Number.isFinite(qty) ? qty : 0,
        quantityReceived: 0,
        unitCost: Number.isFinite(cost) ? cost : 0,
        notes: clean(it.notes) || undefined,
      };
    });

    const orderDate = body.orderDate ? new Date(body.orderDate) : new Date();
    const expectedDeliveryDate = body.expectedDeliveryDate ? new Date(body.expectedDeliveryDate) : undefined;

    const purchaseOrder = await InventoryPurchaseOrder.create({
      poNumber: poNumber.toUpperCase(),
      supplier: body.supplier,
      items,
      orderDate,
      expectedDeliveryDate,
      totalAmount,
      notes: clean(body.notes) || undefined,
      createdBy: auth.user?.name || auth.user?.email,
    });

    writeAuditLog(req, auth, {
      action: "create",
      resourceType: "InventoryPurchaseOrder",
      resourceId: purchaseOrder._id,
      metadata: { poNumber: purchaseOrder.poNumber, totalAmount },
    }).catch(() => {});

    for (const lineItem of items) {
      if (!lineItem.item || !Number.isFinite(lineItem.quantityOrdered) || lineItem.quantityOrdered <= 0) continue;
      const existingMovement = await InventoryMovement.findOne({ referenceNo: poNumber.toUpperCase(), item: lineItem.item, movementType: "purchase" }).lean();
      if (existingMovement) continue;
      await InventoryMovement.create({
        item: lineItem.item,
        movementType: "purchase",
        quantityBase: lineItem.quantityOrdered,
        balanceAfterBase: 0,
        reason: clean(body.notes) || "Purchase order",
        referenceNo: poNumber.toUpperCase(),
        performedBy: auth.user?.name || auth.user?.email,
        movementDate: orderDate,
      }).catch(() => {});
    }

    return Response.json({ purchaseOrder }, { status: 201 });
  } catch (error) {
    if (error.code === 11000) return Response.json({ error: "PO number already exists" }, { status: 409 });
    return jsonError("Unable to create purchase order", error, 500);
  }
}
