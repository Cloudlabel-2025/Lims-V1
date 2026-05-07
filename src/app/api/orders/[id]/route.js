import { getTenantModels } from "@/app/lib/tenant-db";
import { requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";

export async function GET(req, { params }) {
  try {
    const auth = requireTenantSession(req, "orders.view");
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "orders.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { id } = await params;
    const { LabOrder, Sample } = await getTenantModels(auth.tenantId);
    const [order, samples] = await Promise.all([
      LabOrder.findById(id).populate("patient", "name patientId age gender phone"),
      Sample.find({ order: id }).populate("patient", "name patientId"),
    ]);

    if (!order) return Response.json({ error: "Order not found" }, { status: 404 });

    return Response.json({ order, samples });
  } catch (error) {
    return Response.json({ error: "Unable to load order", details: error.message }, { status: 500 });
  }
}
