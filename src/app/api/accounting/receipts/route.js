import { jsonError } from "@/app/lib/api-response";
import { getTenantModels } from "@/app/lib/tenant-db";
import { requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";

export async function GET(req) {
  try {
    const auth = requireTenantSession(req, "billing.view");
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "billing");
    if (moduleAuth.error) return moduleAuth.error;

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const method = searchParams.get("method");

    const filter = { tenantId: auth.tenantId };
    if (method && ["cash", "card", "upi", "cheque", "corporate-credit"].includes(method)) {
      filter.method = method;
    }

    const { PaymentReceipt } = await getTenantModels(auth.tenantId);

    const [receipts, total] = await Promise.all([
      PaymentReceipt.find(filter)
        .sort({ receivedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("patientId", "name patientId phone")
        .populate("invoiceId", "billId totalAmount")
        .lean(),
      PaymentReceipt.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit);

    return Response.json({
      receipts,
      pagination: { page, limit, total, totalPages },
    });
  } catch (error) {
    return jsonError("Unable to fetch receipts", error, 500);
  }
}
