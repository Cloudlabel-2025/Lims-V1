import { requireTenantSession } from "@/app/lib/auth";
import { getTenantModels } from "@/app/lib/tenant-db";
import { jsonError } from "@/app/lib/api-response";

export async function GET(req) {
  try {
    const auth = requireTenantSession(req, "billing.view");
    if (auth.error) return auth.error;

    const { searchParams } = new URL(req.url);
    const patientId = searchParams.get("patientId");
    const status = searchParams.get("status");

    const query = { tenantId: auth.tenantId };
    if (patientId) query.patient = patientId;
    if (status) query.status = status;

    const { TestRequest } = await getTenantModels(auth.tenantId);
    const requests = await TestRequest.find(query)
      .populate("doctor", "name doctorId speciality clinicName phone")
      .populate("patient", "name patientId phone age gender address email")
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    return Response.json({ requests });
  } catch (error) {
    return jsonError("Unable to fetch doctor test requests", error, 500);
  }
}

export async function PATCH(req) {
  try {
    const auth = requireTenantSession(req, "billing.create");
    if (auth.error) return auth.error;

    const { requestId, status, billingRecordId } = await req.json();
    if (!requestId || !status) {
      return Response.json({ error: "requestId and status are required" }, { status: 400 });
    }

    const { TestRequest } = await getTenantModels(auth.tenantId);
    const update = { status };
    if (billingRecordId) {
      update.billingRecord = billingRecordId;
    }

    const updated = await TestRequest.findByIdAndUpdate(requestId, { $set: update }, { new: true });
    if (!updated) {
      return Response.json({ error: "Test request not found" }, { status: 404 });
    }

    return Response.json({ message: `Test request updated to ${status}`, testRequest: updated });
  } catch (error) {
    return jsonError("Unable to update test request", error, 500);
  }
}
