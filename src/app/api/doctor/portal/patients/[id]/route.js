import { requireTenantSession } from "@/app/lib/auth";
import { getTenantModels } from "@/app/lib/tenant-db";
import { jsonError } from "@/app/lib/api-response";

export async function GET(req, { params }) {
  try {
    const auth = requireTenantSession(req, "patients.view");
    if (auth.error) return auth.error;
    if (!auth.session.doctorId) return Response.json({ error: "Doctor portal account required" }, { status: 403 });
    const { id } = await params;
    const { BillingRecord, TestReport } = await getTenantModels(auth.tenantId);
    const bills = await BillingRecord.find({
      tenantId: auth.tenantId,
      referralDoctor: auth.session.doctorId,
      patient: id,
      status: { $ne: "cancelled" },
    }).populate("patient", "name patientId age gender phone email address dob").sort({ createdAt: -1 }).lean();
    if (!bills.length) return Response.json({ error: "Referral patient not found" }, { status: 404 });
    const reports = await TestReport.find({
      billingRecord: { $in: bills.map((bill) => bill._id) },
      status: "released",
    }).select("reportId testSnapshot results remarks releasedAt createdAt").sort({ releasedAt: -1 }).lean();
    return Response.json({ patient: bills[0].patient, referrals: bills, reports });
  } catch (error) {
    return jsonError("Unable to load referral patient", error, 500);
  }
}
