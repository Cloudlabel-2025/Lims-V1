import { jsonError } from "@/app/lib/api-response";
import { getTenantModels } from "@/app/lib/tenant-db";
import { requireTenantSession } from "@/app/lib/auth";
import { formatDoctorValidationErrors, validateDoctorPayload } from "@/app/utils/doctor-validation";

// ── GET: Fetch single doctor by ID ──
export async function GET(req, { params }) {
  try {
    const auth = requireTenantSession(req, "doctors.view");
    if (auth.error) return auth.error;

    const { tenantId } = auth;
    const { Doctor } = await getTenantModels(tenantId);
    const { id } = await params;
    const doctor = await Doctor.findById(id);
    if (!doctor) {
      return Response.json({ error: "Doctor not found" }, { status: 404 });
    }
    return Response.json(doctor);
  } catch (err) {
    console.error("GET /api/doctor/[id] error:", err);
    return jsonError("Fetch failed", err, 500);
  }
}

// ── PUT: Update single doctor by ID ──
export async function PUT(req, { params }) {
  try {
    const auth = requireTenantSession(req, "doctors.edit");
    if (auth.error) return auth.error;

    const { tenantId } = auth;
    const { Doctor } = await getTenantModels(tenantId);
    const body = await req.json();
    const { id } = await params;

    // Remove immutable fields if present
    delete body.doctorId;
    delete body._id;
    delete body.createdAt;

    const payload = Object.fromEntries(
      Object.entries(body).map(([key, value]) => [key, typeof value === "string" ? value.trim() : value])
    );

    const validationErrors = validateDoctorPayload(payload);
    if (Object.keys(validationErrors).length > 0) {
      return Response.json({ error: formatDoctorValidationErrors(validationErrors) }, { status: 400 });
    }

    payload.email = String(payload.email).toLowerCase();
    payload.phone = String(payload.phone);
    payload.mciNumber = String(payload.mciNumber).toUpperCase();
    payload.experience = Number(payload.experience);
    payload.commission = payload.commission !== undefined ? Number(payload.commission) : 0;

    const doctor = await Doctor.findByIdAndUpdate(
      id,
      { $set: payload },
      { returnDocument: "after", runValidators: true }
    );

    if (!doctor) {
      return Response.json({ error: "Doctor not found" }, { status: 404 });
    }

    return Response.json(doctor);
  } catch (err) {
    console.error("PUT /api/doctor/[id] error:", err);
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map((e) => e.message);
      return Response.json({ error: messages.join("; ") }, { status: 400 });
    }
    return jsonError("Update failed", err, 500);
  }
}

// ── DELETE: Delete single doctor by ID ──
export async function DELETE(req, { params }) {
  try {
    const auth = requireTenantSession(req, "doctors.delete");
    if (auth.error) return auth.error;

    const { tenantId } = auth;
    const { Doctor } = await getTenantModels(tenantId);
    const { id } = await params;

    const doctor = await Doctor.findByIdAndDelete(id);
    if (!doctor) {
      return Response.json({ error: "Doctor not found" }, { status: 404 });
    }

    return Response.json({ success: true, deletedDoctor: doctor.doctorId });
  } catch (err) {
    console.error("DELETE /api/doctor/[id] error:", err);
    return jsonError("Delete failed", err, 500);
  }
}
