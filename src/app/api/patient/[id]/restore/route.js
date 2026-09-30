import { jsonError } from "@/app/lib/api-response";
import { getTenantModels } from "@/app/lib/tenant-db";
import { requireTenantSession } from "@/app/lib/auth";
import { writeAuditLog } from "@/app/lib/audit";

export async function POST(req, { params }) {
  try {
    const auth = requireTenantSession(req, "patients.edit");
    if (auth.error) return auth.error;

    const { tenantId } = auth;
    const { Patient } = await getTenantModels(tenantId);
    const { id } = await params;

    const patient = await Patient.findById(id);
    if (!patient) {
      return Response.json({ error: "Patient not found" }, { status: 404 });
    }

    patient.isDeleted = false;
    patient.deletedAt = null;
    patient.deletedBy = null;
    patient.status = "active";
    await patient.save();

    await writeAuditLog(req, auth, {
      action: "patients.restored",
      resourceType: "Patient",
      resourceId: patient._id,
      metadata: {
        patientId: patient.patientId,
        actor: auth.session.email || auth.session.userId || "System",
        timestamp: new Date().toISOString(),
      },
    });

    return Response.json({ success: true, patient });
  } catch (err) {
    console.error("POST /api/patient/[id]/restore error:", err);
    return jsonError("Restore failed", err, 500);
  }
}
