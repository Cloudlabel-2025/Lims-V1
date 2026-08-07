import { jsonError } from "@/app/lib/api-response";
import { getTenantModels } from "@/app/lib/tenant-db";
import { requireTenantSession } from "@/app/lib/auth";
import { normalizeDob } from "@/app/lib/patient-portal";

function clean(value) {
  return String(value || "").trim();
}

export async function GET(req, { params }) {
  try {
    const auth = requireTenantSession(req, "patients.view");
    if (auth.error) return auth.error;

    const { tenantId } = auth;
    const { Patient, Doctor, BillingRecord } = await getTenantModels(tenantId);
    const { id } = await params;
    const patient = await Patient.findById(id);
    if (!patient) {
      return Response.json({ error: "Patient not found" }, { status: 404 });
    }

    if (auth.session.doctorId) {
      const doctor = await Doctor.findById(auth.session.doctorId).select("name").lean();
      const isDirectDocPatient = String(patient.refDoctor) === String(auth.session.doctorId) || (doctor?.name && patient.refDoctorName === doctor.name);
      const ownsReferral = isDirectDocPatient || await BillingRecord.exists({
        tenantId,
        referralDoctor: auth.session.doctorId,
        patient: id,
        status: { $ne: "cancelled" },
      });
      if (!ownsReferral) return Response.json({ error: "Patient not found" }, { status: 404 });
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

    const existingPatient = await Patient.findById(id).lean();
    if (!existingPatient) {
      return Response.json({ error: "Patient not found" }, { status: 404 });
    }

    // Remove immutable fields if present in body
    delete body.patientId;
    delete body._id;
    delete body.createdAt;

    if (body.phone && !/^\d{10}$/.test(String(body.phone))) {
      return Response.json({ error: "Mobile Number must be exactly 10 digits" }, { status: 400 });
    }

    const targetPhone = body.phone !== undefined ? body.phone : existingPatient.phone;
    const targetDob = body.dob !== undefined ? body.dob : existingPatient.dob;

    if (body.phone !== undefined || body.dob !== undefined) {
      const cleanPhone = String(targetPhone).replace(/\D/g, "");
      const existingPatientsSharingPhone = await Patient.find({
        _id: { $ne: id },
        $or: [
          { phone: cleanPhone },
          { phone: `+91${cleanPhone}` },
          { phone: `91${cleanPhone}` },
        ],
      }).lean();

      if (existingPatientsSharingPhone.length >= 2) {
        return Response.json({
          error: "Maximum of 2 patients can share the same mobile number. Registering a third patient is not allowed."
        }, { status: 400 });
      }

      const targetDobNormalized = normalizeDob(targetDob);
      const dobMatch = existingPatientsSharingPhone.find(p => normalizeDob(p.dob) === targetDobNormalized);
      if (dobMatch) {
        return Response.json({
          error: "A patient with this mobile number and date of birth is already registered."
        }, { status: 400 });
      }
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
      const minDob = new Date();
      minDob.setFullYear(minDob.getFullYear() - 150);
      if (isNaN(dobDate.getTime())) {
        return Response.json({ error: "Invalid date of birth" }, { status: 400 });
      }
      if (dobDate < minDob) {
        return Response.json({ error: "Age must be between 0 and 150 years" }, { status: 400 });
      }
      if (dobDate > new Date()) {
        return Response.json({ error: "Date of birth cannot be in the future" }, { status: 400 });
      }
    }
    if (body.gender === "Other" && !body.genderIdentity) {
      return Response.json({ error: "Gender Identity is required when Gender is 'Other'" }, { status: 400 });
    }
    if (body.age !== undefined && body.age !== null && (Number(body.age) < 0 || Number(body.age) > 150 || isNaN(Number(body.age)))) {
      return Response.json({ error: "Age must be between 0 and 150" }, { status: 400 });
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

import { getLabSubscriptionEntitlements } from "@/app/lib/subscription-service";
import { getDeleteRestrictionReason } from "@/app/lib/deletion-policy";

// ── DELETE: Delete single patient by ID ──
export async function DELETE(req, { params }) {
  try {
    const auth = requireTenantSession(req, "patients.delete");
    if (auth.error) return auth.error;

    const { tenantId } = auth;
    const { Patient } = await getTenantModels(tenantId);
    const { id } = await params;

    const patient = await Patient.findById(id);
    if (!patient) {
      return Response.json({ error: "Patient not found" }, { status: 404 });
    }

    const subscription = await getLabSubscriptionEntitlements(tenantId);
    const restrictionReason = getDeleteRestrictionReason(patient, subscription, "patients");
    if (restrictionReason) {
      return Response.json({ error: "Deletion window expired", details: restrictionReason }, { status: 403 });
    }

    await Patient.findByIdAndDelete(id);

    return Response.json({ success: true, deletedPatient: patient.patientId });
  } catch (err) {
    console.error("DELETE /api/patient/[id] error:", err);
    return jsonError("Delete failed", err, 500);
  }
}
