import QRCode from "qrcode";
import { requireTenantSession } from "@/app/lib/auth";
import { getTenantModels } from "@/app/lib/tenant-db";
import { createPatientAccessCredential, buildWhatsAppShareUrl } from "@/app/lib/patient-portal";
import { writeAuditLog } from "@/app/lib/audit";
import { jsonError } from "@/app/lib/api-response";

import { getLabSubscriptionEntitlements } from "@/app/lib/subscription-service";
import { hasPatientPortalEntitlement } from "@/app/lib/portal-policy";

export async function POST(req, { params }) {
  try {
    const auth = requireTenantSession(req, "patients.register");
    if (auth.error) return auth.error;
    const { id } = await params;

    const subscription = await getLabSubscriptionEntitlements(auth.tenantId);
    if (!hasPatientPortalEntitlement(subscription)) {
      return Response.json({
        error: "Patient Portal access is not included in your active subscription package. Contact support to enable patient portal access.",
      }, { status: 403 });
    }
    const { Patient, PatientPortalAccount } = await getTenantModels(auth.tenantId);
    const patient = await Patient.findById(id).select("name patientId dob phone").lean();
    if (!patient) return Response.json({ error: "Patient not found" }, { status: 404 });
    const access = await createPatientAccessCredential(auth.tenantId, req.url);
    await PatientPortalAccount.findOneAndUpdate(
      { patient: patient._id },
      { $set: { status: "active", lastAccessSlipIssuedAt: new Date() }, $inc: { credentialVersion: 1 } },
      { upsert: true, runValidators: true, setDefaultsOnInsert: false }
    );
    const qrDataUrl = await QRCode.toDataURL(access.portalUrl, { errorCorrectionLevel: "M", margin: 2, width: 320 });
    const whatsAppShareUrl = buildWhatsAppShareUrl(auth.tenantId, req.url, patient.name, patient.phone, access.portalUrl);
    await writeAuditLog(req, auth, { action: "patient.portal_access_slip_issued", resourceType: "Patient", resourceId: patient._id, metadata: { expiresAt: access.expiresAt } });
    return Response.json({
      patient: { name: patient.name, patientId: patient.patientId, phone: patient.phone, phoneLast4: String(patient.phone || "").slice(-4) },
      activationUrl: access.portalUrl,
      whatsAppShareUrl,
      expiresAt: access.expiresAt,
      qrDataUrl,
    });
  } catch (error) {
    return jsonError("Unable to issue patient portal access slip", error, 500);
  }
}
