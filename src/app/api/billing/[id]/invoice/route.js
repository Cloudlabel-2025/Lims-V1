import { jsonError } from "@/app/lib/api-response";
import { getTenantModels } from "@/app/lib/tenant-db";
import { requireTenantSession } from "@/app/lib/auth";

export async function GET(req, { params }) {
  try {
    const auth = requireTenantSession(req, "billing.view");
    if (auth.error) return auth.error;

    const { id } = await params;

    const { BillingRecord, Patient, Doctor } = await getTenantModels(auth.tenantId);
    const record = await BillingRecord.findById(id)
      .populate("patient", "firstName lastName patientId address phone email")
      .populate("doctor", "firstName lastName doctorId")
      .populate("items.test", "name price")
      .populate("items.package", "name price");
    if (!record) return Response.json({ error: "Billing record not found" }, { status: 404 });

    return Response.json({
      invoiceNumber: `INV-${record.receiptNumber ?? record._id}`,
      issuedAt: record.createdAt,
      patient: record.patient
        ? {
            name: `${record.patient.firstName} ${record.patient.lastName}`.trim(),
            patientId: record.patient.patientId,
            address: record.patient.address,
            phone: record.patient.phone,
            email: record.patient.email,
          }
        : null,
      doctor: record.doctor
        ? { name: `${record.doctor.firstName} ${record.doctor.lastName}`.trim(), doctorId: record.doctor.doctorId }
        : null,
      items: (record.items ?? []).map((item) => ({
        name: item.test?.name ?? item.package?.name ?? item.customItem ?? "Unknown",
        price: item.price,
      })),
      subtotal: record.items?.reduce((s, i) => s + (i.price ?? 0), 0) ?? 0,
      discount: record.discount ?? 0,
      totalAmount: record.totalAmount,
      totalPaid: record.totalPaid,
      dueAmount: record.dueAmount,
      status: record.status,
      paymentMethod: record.paymentMethod,
      receivedAmount: record.receivedAmount,
    });
  } catch (error) {
    return jsonError("Unable to fetch invoice data", error, 500);
  }
}
