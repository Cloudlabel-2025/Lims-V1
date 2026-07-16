import { jsonError } from "@/app/lib/api-response";
import { writeAuditLog } from "@/app/lib/audit";
import { requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";
import { getTenantModels } from "@/app/lib/tenant-db";

function clean(value) {
  return String(value || "").trim();
}

async function requireInventory(req, permission = "inventory.view") {
  const auth = requireTenantSession(req, permission);
  if (auth.error) return { error: auth.error };
  const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "inventory.view");
  if (moduleAuth.error) return { error: moduleAuth.error };
  return auth;
}

const VALID_TRANSITIONS = {
  draft: ["submitted", "cancelled"],
  submitted: ["partially_received", "received", "cancelled"],
  partially_received: ["partially_received", "received", "cancelled"],
  received: [],
  cancelled: [],
};

export async function PATCH(req, { params }) {
  try {
    const auth = await requireInventory(req, "inventory.manage");
    if (auth.error) return auth.error;

    const { id } = await params;
    const body = await req.json();
    const { InventoryPurchaseOrder } = await getTenantModels(auth.tenantId);

    const po = await InventoryPurchaseOrder.findById(id);
    if (!po) return Response.json({ error: "Purchase order not found" }, { status: 404 });

    if (body.action) {
      const action = clean(body.action);
      const allowed = VALID_TRANSITIONS[po.status] || [];
      if (!allowed.includes(action)) {
        return Response.json({ error: `Cannot transition from "${po.status}" to "${action}"` }, { status: 400 });
      }

      if (action === "submitted") {
        po.status = "submitted";
      } else if (action === "received") {
        po.status = "received";
        po.receivedDate = new Date();
      } else if (action === "partially_received") {
        if (Array.isArray(body.receivedItems)) {
          for (const ri of body.receivedItems) {
            const poItem = po.items.id(ri.itemId);
            if (poItem) {
              const addQty = Number(ri.quantityReceived);
              if (Number.isFinite(addQty) && addQty > 0) {
                poItem.quantityReceived = (poItem.quantityReceived || 0) + addQty;
              }
            }
          }
        }
        const allReceived = po.items.every((it) => (it.quantityReceived || 0) >= it.quantityOrdered);
        po.status = allReceived ? "received" : "partially_received";
        if (allReceived) po.receivedDate = new Date();
      } else if (action === "cancelled") {
        po.status = "cancelled";
      }

      await po.save();

      writeAuditLog(req, auth, {
        action: "update",
        resourceType: "InventoryPurchaseOrder",
        resourceId: po._id,
        metadata: { poNumber: po.poNumber, action, newStatus: po.status },
      }).catch(() => {});

      return Response.json({ purchaseOrder: po });
    }

    if (body.notes !== undefined) {
      po.notes = clean(body.notes) || undefined;
      await po.save();
      return Response.json({ purchaseOrder: po });
    }

    return Response.json({ error: "No valid action provided" }, { status: 400 });
  } catch (error) {
    return jsonError("Unable to update purchase order", error, 500);
  }
}

export async function DELETE(req, { params }) {
  try {
    const auth = await requireInventory(req, "inventory.manage");
    if (auth.error) return auth.error;

    const { id } = await params;
    const { InventoryPurchaseOrder } = await getTenantModels(auth.tenantId);

    const po = await InventoryPurchaseOrder.findById(id);
    if (!po) return Response.json({ error: "Purchase order not found" }, { status: 404 });

    if (!["draft", "cancelled"].includes(po.status)) {
      return Response.json({ error: "Only draft or cancelled purchase orders can be deleted" }, { status: 400 });
    }

    await InventoryPurchaseOrder.deleteOne({ _id: id });

    writeAuditLog(req, auth, {
      action: "delete",
      resourceType: "InventoryPurchaseOrder",
      resourceId: po._id,
      metadata: { poNumber: po.poNumber },
    }).catch(() => {});

    return Response.json({ success: true });
  } catch (error) {
    return jsonError("Unable to delete purchase order", error, 500);
  }
}
