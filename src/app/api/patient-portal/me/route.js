import { requirePatientSession } from "@/app/lib/patient-session";
import { getTenantModels } from "@/app/lib/tenant-db";
import { jsonError } from "@/app/lib/api-response";

export async function GET(req) {
  try {
    const auth = await requirePatientSession(req);
    if (auth.error) return auth.error;
    const { session } = auth;
    const { Patient, BillingRecord, TestReport, PaymentReceipt, AuditLog } = await getTenantModels(session.tenantId);
    const patient = await Patient.findById(session.patientId).select("name patientId dob age gender phone address").lean();
    if (!patient) return Response.json({ error: "Patient not found" }, { status: 404 });
    const bills = await BillingRecord.find({ tenantId: session.tenantId, patient: patient._id })
      .select("billId items priority status totalAmount subtotalAmount discountAmount taxAmount paymentBreakdown billingStatus firstPaymentDate lastPaymentDate createdAt")
      .sort({ createdAt: -1 }).lean();
    const billIds = bills.map((bill) => bill._id);
    const [reports, receipts] = await Promise.all([
      TestReport.find({ patient: patient._id, billingRecord: { $in: billIds }, status: "released" })
        .select("reportId billingRecord testSnapshot results remarks status releasedAt createdAt")
        .sort({ releasedAt: -1 }).lean(),
      PaymentReceipt.find({ tenantId: session.tenantId, patientId: patient._id, invoiceId: { $in: billIds } })
        .select("invoiceId amount method receivedAt isRefunded").sort({ receivedAt: -1 }).lean(),
    ]);
    await AuditLog.create({
      action: "patient.portal_viewed",
      tenantId: session.tenantId,
      resourceType: "Patient",
      resourceId: patient._id,
      userRole: "Patient",
      metadata: { releasedReports: reports.length, bills: bills.length },
      ipAddress: req.headers.get("x-forwarded-for") || "",
    }).catch(() => {});
    return Response.json({
      patient,
      reports,
      bills: bills.map((bill) => ({
        _id: bill._id, billId: bill.billId, tests: (bill.items || []).map((item) => item.testSnapshot?.name).filter(Boolean), priority: bill.priority,
        status: bill.status, totalAmount: bill.totalAmount, subtotalAmount: bill.subtotalAmount, discountAmount: bill.discountAmount,
        taxAmount: bill.taxAmount, paymentBreakdown: bill.paymentBreakdown, billingStatus: bill.billingStatus, createdAt: bill.createdAt,
        paidAmount: receipts.filter((r) => String(r.invoiceId) === String(bill._id) && !r.isRefunded).reduce((sum, r) => sum + Number(r.amount || 0), 0),
      })),
      receipts: receipts.map((receipt) => ({ _id: receipt._id, invoiceId: receipt.invoiceId, amount: receipt.amount, method: receipt.method, receivedAt: receipt.receivedAt, isRefunded: receipt.isRefunded })),
    }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    return jsonError("Unable to load patient portal", error, 500);
  }
}
