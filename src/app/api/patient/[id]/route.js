import { jsonError } from "@/app/lib/api-response";
import { getTenantModels } from "@/app/lib/tenant-db";
import { requireTenantSession } from "@/app/lib/auth";

function clean(value) {
  return String(value || "").trim();
}

export async function GET(req, { params }) {
  try {
    const auth = requireTenantSession(req, "patients.view");
    if (auth.error) return auth.error;

    const { tenantId } = auth;
    const { Patient } = await getTenantModels(tenantId);
    const { id } = await params;
    const patient = await Patient.findById(id);
    if (!patient) {
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

    // Remove immutable fields if present in body
    delete body.patientId;
    delete body._id;
    delete body.createdAt;

    if (body.phone && !/^\d{10}$/.test(String(body.phone))) {
      return Response.json({ error: "Mobile Number must be exactly 10 digits" }, { status: 400 });
    }

    if (body.uhId && !/^[A-Za-z0-9]{14}$/.test(String(body.uhId))) {
      return Response.json({ error: "UH ID must be exactly 14 alphanumeric characters" }, { status: 400 });
    }
    if (body.uhId) {
      const duplicateUhId = await Patient.findOne({ uhId: String(body.uhId), _id: { $ne: id } });
      if (duplicateUhId) {
        return Response.json({ error: "UH ID already exists" }, { status: 400 });
      }
    }

    if (body.name && !clean(body.name)) {
      return Response.json({ error: "Full Name is required" }, { status: 400 });
    }
    if (body.dob) {
      const dobDate = new Date(body.dob);
      if (isNaN(dobDate.getTime())) {
        return Response.json({ error: "Invalid date of birth" }, { status: 400 });
      }
      if (dobDate.getFullYear() < 1900) {
        return Response.json({ error: "Invalid date of birth" }, { status: 400 });
      }
      if (dobDate > new Date()) {
        return Response.json({ error: "Date of birth cannot be in the future" }, { status: 400 });
      }
    }
    if (body.gender === "Other" && !body.genderIdentity) {
      return Response.json({ error: "Gender Identity is required when Gender is 'Other'" }, { status: 400 });
    }
    if (body.age !== undefined && body.age !== null && (Number(body.age) < 0 || isNaN(Number(body.age)))) {
      return Response.json({ error: "Age must be a valid number" }, { status: 400 });
    }
    if (body.address) {
      const addr = clean(body.address);
      if (!/^[A-Za-z0-9 .,/#-]+$/.test(addr)) {
        return Response.json({ error: "Only letters, numbers, spaces, and . , / # - allowed in address" }, { status: 400 });
      }
      if (/https?:\/\/|www\./i.test(addr)) {
        return Response.json({ error: "URLs not allowed in address" }, { status: 400 });
      }
    }
    if (body.barcode) {
      if (!/^[A-Za-z0-9_-]+$/.test(body.barcode)) {
        return Response.json({ error: "Barcode: only letters, numbers, hyphens, and underscores allowed" }, { status: 400 });
      }
      if (/https?:\/\/|www\./i.test(body.barcode)) {
        return Response.json({ error: "URLs not allowed in barcode" }, { status: 400 });
      }
    }
    if (body.collectionTime && new Date(body.collectionTime) > new Date()) {
      return Response.json({ error: "Collection Time cannot be in the future" }, { status: 400 });
    }
    if (body.receivedTime && new Date(body.receivedTime) > new Date()) {
      return Response.json({ error: "Received Time cannot be in the future" }, { status: 400 });
    }
    if (body.collectionTime && body.receivedTime && new Date(body.receivedTime) < new Date(body.collectionTime)) {
      return Response.json({ error: "Received Time cannot be earlier than Collection Time" }, { status: 400 });
    }
    if (body.dob && body.collectionTime && new Date(body.collectionTime) < new Date(body.dob)) {
      return Response.json({ error: "Collection time cannot be before date of birth" }, { status: 400 });
    }
    if (body.dob && body.receivedTime && new Date(body.receivedTime) < new Date(body.dob)) {
      return Response.json({ error: "Received time cannot be before date of birth" }, { status: 400 });
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
