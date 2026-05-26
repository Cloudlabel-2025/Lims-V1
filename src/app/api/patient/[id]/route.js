import { jsonError } from "@/app/lib/api-response";
import { getTenantModels } from "@/app/lib/tenant-db";
import { requireTenantSession } from "@/app/lib/auth";

export async function GET(req, { params }) {
  try {
    const auth = requireTenantSession(req, "patients.view");
    if (auth.error) return auth.error;

    const { tenantId } = auth;
    const { Patient } = await getTenantModels(tenantId);
    const { id } = await params;
    console.log("Backend API: GET single patient with ID:", id);
    const patient = await Patient.findById(id);
    if (!patient) {
      console.log("Backend API: Patient not found for ID:", id);
      return Response.json({ error: "Patient not found" }, { status: 404 });
    }
    return Response.json(patient);
  } catch (err) {
    return jsonError("Fetch failed", err, 500);
  }
}

export async function PUT(req, { params }) {
  try {
    const auth = requireTenantSession(req, "patients.edit");
    if (auth.error) return auth.error;

    const { tenantId } = auth;
    const { Patient } = await getTenantModels(tenantId);
    const body = await req.json();
    const { id } = await params;
    console.log("Backend API: PUT single patient update for ID:", id);

    // Remove immutable fields if present in body
    delete body.patientId;
    delete body._id;
    delete body.createdAt;

    if (body.phone && !/^\d{10}$/.test(String(body.phone))) {
      return Response.json({ error: "Mobile Number must be exactly 10 digits" }, { status: 400 });
    }

    if (body.uhId && !/^\d{14}$/.test(String(body.uhId))) {
      return Response.json({ error: "UH ID must be exactly 14 digits" }, { status: 400 });
    }

    const patient = await Patient.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true, runValidators: true }
    );

    if (!patient) {
      return Response.json({ error: "Patient not found" }, { status: 404 });
    }

    return Response.json(patient);
  } catch (err) {
    console.error("PUT /api/patient/[id] error:", err);
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map((e) => e.message);
      return Response.json({ error: messages.join("; ") }, { status: 400 });
    }
    return jsonError("Update failed", err, 500);
  }
}

// ── DELETE: Delete single patient by ID ──
export async function DELETE(req, { params }) {
  try {
    const auth = requireTenantSession(req, "patients.delete");
    if (auth.error) return auth.error;

    const { tenantId } = auth;
    const { Patient } = await getTenantModels(tenantId);
    const { id } = await params;

    const patient = await Patient.findByIdAndDelete(id);
    if (!patient) {
      return Response.json({ error: "Patient not found" }, { status: 404 });
    }

    return Response.json({ success: true, deletedPatient: patient.patientId });
  } catch (err) {
    console.error("DELETE /api/patient/[id] error:", err);
    return jsonError("Delete failed", err, 500);
  }
}
