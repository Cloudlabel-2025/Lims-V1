import QRCode from "qrcode";
import { requireTenantSession } from "@/app/lib/auth";
import { getTenantModels } from "@/app/lib/tenant-db";
import { createPatientAccessCredential } from "@/app/lib/patient-portal";
import { writeAuditLog } from "@/app/lib/audit";
import { jsonError } from "@/app/lib/api-response";

export async function POST(req, { params }) {
  try {
    const auth = requireTenantSession(req, "patients.register");
    if (auth.error) return auth.error;
    const { id } = await params;
    const { Patient, PatientPortalAccount } = await getTenantModels(auth.tenantId);
    const patient = await Patient.findById(id).select("name patientId dob phone").lean();
    if (!patient) return Response.json({ error: "Patient not found" }, { status: 404 });
    const access = await createPatientAccessCredential(auth.tenantId, req.url);
    await PatientPortalAccount.findOneAndUpdate(
      { patient: patient._id },
      { $set: { status: "invited", activationTokenHash: access.tokenHash, accessPinHash: access.accessPinHash, activationExpiresAt: access.expiresAt, lastAccessSlipIssuedAt: new Date() }, $inc: { credentialVersion: 1 } },
      { upsert: true, runValidators: true, setDefaultsOnInsert: false }
    );
    const qrDataUrl = await QRCode.toDataURL(access.activationUrl, { errorCorrectionLevel: "M", margin: 2, width: 320 });
    await writeAuditLog(req, auth, { action: "patient.portal_access_slip_issued", resourceType: "Patient", resourceId: patient._id, metadata: { expiresAt: access.expiresAt } });
    return Response.json({
      patient: { name: patient.name, patientId: patient.patientId, phoneLast4: String(patient.phone || "").slice(-4) },
      activationUrl: access.activationUrl,
      accessPin: access.accessPin,
      expiresAt: access.expiresAt,
      qrDataUrl,
    });
  } catch (error) {
    return jsonError("Unable to issue patient portal access slip", error, 500);
  }
}
