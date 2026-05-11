import { getTenantModels } from "@/app/lib/tenant-db";
import { requireTenantSession } from "@/app/lib/auth";

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
    return Response.json({ error: "Fetch failed", details: err.message }, { status: 500 });
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

    if (body.phone && !/^\d{10}$/.test(String(body.phone))) {
      return Response.json({ error: "Mobile Number must be exactly 10 digits" }, { status: 400 });
    }

    if (body.commission !== undefined && (isNaN(body.commission) || Number(body.commission) < 0 || Number(body.commission) > 100)) {
      return Response.json({ error: "Commission must be between 0 and 100" }, { status: 400 });
    }

    const doctor = await Doctor.findByIdAndUpdate(
      id,
      { $set: body },
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
    return Response.json({ error: "Update failed", details: err.message }, { status: 500 });
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
    return Response.json({ error: "Delete failed", details: err.message }, { status: 500 });
  }
}
