import { jsonError } from "@/app/lib/api-response";
import { getTenantModels } from "@/app/lib/tenant-db";
import { requireTenantSession } from "@/app/lib/auth";
import { formatDoctorValidationErrors, validateDoctorPayload } from "@/app/utils/doctor-validation";

export async function GET(req) {
  try {
    const auth = requireTenantSession(req, "doctors.view");
    if (auth.error) return auth.error;

    if (!auth.session.doctorId) {
      return Response.json({ error: "No doctor profile linked to this account" }, { status: 404 });
    }

    const { tenantId } = auth;
    const { Doctor } = await getTenantModels(tenantId);
    const doctor = await Doctor.findById(auth.session.doctorId);

    if (!doctor) {
      return Response.json({ error: "Doctor not found" }, { status: 404 });
    }

    return Response.json(doctor);
  } catch (err) {
    return jsonError("Failed to load profile", err, 500);
  }
}

export async function PUT(req) {
  try {
    const auth = requireTenantSession(req, "doctors.edit");
    if (auth.error) return auth.error;

    if (!auth.session.doctorId) {
      return Response.json({ error: "No doctor profile linked to this account" }, { status: 404 });
    }

    const { tenantId } = auth;
    const { Doctor } = await getTenantModels(tenantId);
    const body = await req.json();

    const allowedFields = ["phone", "email", "clinicName", "location", "clinicAddress", "degree", "speciality", "experience"];
    const payload = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        payload[field] = typeof body[field] === "string" ? String(body[field]).trim() : body[field];
      }
    }

    const validationErrors = validateDoctorPayload(payload, { partial: true });
    if (Object.keys(validationErrors).length > 0) {
      return Response.json({ error: formatDoctorValidationErrors(validationErrors) }, { status: 400 });
    }

    if (payload.email) payload.email = String(payload.email).toLowerCase();
    if (payload.phone) payload.phone = String(payload.phone);
    if (payload.experience !== undefined) payload.experience = Number(payload.experience);

    const doctor = await Doctor.findByIdAndUpdate(
      auth.session.doctorId,
      { $set: payload },
      { returnDocument: "after", runValidators: true }
    );

    if (!doctor) {
      return Response.json({ error: "Doctor not found" }, { status: 404 });
    }

    return Response.json(doctor);
  } catch (err) {
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map((e) => e.message);
      return Response.json({ error: messages.join("; ") }, { status: 400 });
    }
    return jsonError("Update failed", err, 500);
  }
}
