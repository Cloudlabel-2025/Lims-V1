import { requireTenantSession } from "@/app/lib/auth";
import { getTenantModels } from "@/app/lib/tenant-db";
import { jsonError } from "@/app/lib/api-response";

export async function GET(req, { params }) {
  try {
    const auth = requireTenantSession(req);
    if (auth.error) return auth.error;
    if (!auth.session.doctorId) return Response.json({ error: "Doctor portal account required" }, { status: 403 });
    const { id } = await params;
    const { BillingRecord, TestReport, Doctor, Patient } = await getTenantModels(auth.tenantId);
    const doctor = await Doctor.findById(auth.session.doctorId).select("name").lean();
    if (!doctor) return Response.json({ error: "Doctor profile not found" }, { status: 404 });

    const patient = await Patient.findById(id).select("name patientId age gender phone email address dob refDoctorName").lean();
    if (!patient) return Response.json({ error: "Patient not found" }, { status: 404 });

    const isReferredByName = Boolean(patient.refDoctorName && patient.refDoctorName.toLowerCase() === doctor.name.toLowerCase());

    const bills = await BillingRecord.find({
      tenantId: auth.tenantId,
      referralDoctor: auth.session.doctorId,
      patient: id,
      status: { $ne: "cancelled" },
    }).populate("patient", "name patientId age gender phone email address dob").sort({ createdAt: -1 }).lean();

    if (!isReferredByName && bills.length === 0) {
      return Response.json({ error: "Referral patient not found" }, { status: 404 });
    }

    const billIds = bills.map((bill) => bill._id);
    const reports = await TestReport.find({
      status: "released",
      $or: [
        { billingRecord: { $in: billIds } },
        { patient: id },
      ],
    }).select("reportId testSnapshot results remarks releasedAt createdAt").sort({ releasedAt: -1 }).lean();

    return Response.json({ patient: bills[0]?.patient || patient, referrals: bills, reports });
  } catch (error) {
    return jsonError("Unable to load referral patient", error, 500);
  }
}
