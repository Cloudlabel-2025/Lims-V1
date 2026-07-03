import { jsonError } from "@/app/lib/api-response";
import { getTenantModels } from "@/app/lib/tenant-db";
import { requireTenantSession } from "@/app/lib/auth";

export async function GET(req, { params }) {
  try {
    const auth = requireTenantSession(req, "samples.view");
    if (auth.error) return auth.error;

    const { id } = await params;

    const { Sample } = await getTenantModels(auth.tenantId);
    const sample = await Sample.findById(id).populate("patient", "patientId firstName lastName");
    if (!sample) return Response.json({ error: "Sample not found" }, { status: 404 });

    return Response.json({
      sampleId: sample.sampleId,
      barcode: sample.barcode,
      patientName: sample.patient
        ? `${sample.patient.firstName} ${sample.patient.lastName}`.trim()
        : null,
      patientId: sample.patient?.patientId ?? null,
      type: sample.type,
    });
  } catch (error) {
    return jsonError("Unable to fetch barcode data", error, 500);
  }
}
