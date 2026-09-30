import { jsonError } from "@/app/lib/api-response";
import { getTenantModels } from "@/app/lib/tenant-db";
import { hasPermission, requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";
import { formatDoctorValidationErrors, validateDoctorPayload } from "@/app/utils/doctor-validation";
import { escapeRegex } from "@/app/lib/string-utils";
import { writeAuditLog } from "@/app/lib/audit";
import { getLabSubscriptionEntitlements } from "@/app/lib/subscription-service";
import { getDeleteRestrictionReason } from "@/app/lib/deletion-policy";

// ── GET: Fetch single doctor by ID ──
export async function GET(req, { params }) {
  try {
    const auth = requireTenantSession(req, "doctors.view");
    if (auth.error) return auth.error;

    const { tenantId } = auth;
    const moduleAuth = await requireEnabledTenantModule(tenantId, "doctors.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { Doctor } = await getTenantModels(tenantId);
    const { id } = await params;
    const canViewFinancials = hasPermission(auth.session, "accounts.view");
    const doctor = await Doctor.findById(id)
      .select(canViewFinancials ? null : "-pendingPayout");
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
    const { Doctor, User } = await getTenantModels(tenantId);
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

    if (!payload.genderIdentity) delete payload.genderIdentity;

    payload.email = String(payload.email).toLowerCase();
    payload.phone = String(payload.phone);
    const mciValue = String(payload.mciNumber ?? "").trim();
    const hasMci = Boolean(mciValue);
    if (hasMci) payload.mciNumber = mciValue.toUpperCase();
    else delete payload.mciNumber;
    payload.experience = Number(payload.experience);
    payload.commission = payload.commission !== undefined ? Number(payload.commission) : 0;

    const existingDoctor = await Doctor.findById(id).lean();
    if (!existingDoctor) {
      return Response.json({ error: "Doctor not found" }, { status: 404 });
    }

    if (payload.email) {
      const emailRegex = new RegExp("^" + escapeRegex(payload.email) + "$", "i");
      const duplicateEmail = await Doctor.findOne({ _id: { $ne: id }, email: emailRegex });
      if (duplicateEmail) {
        return Response.json({ error: `Doctor with email "${payload.email}" already exists` }, { status: 409 });
      }
    }
    if (payload.phone) {
      const duplicatePhone = await Doctor.findOne({ _id: { $ne: id }, phone: payload.phone });
      if (duplicatePhone) {
        return Response.json({ error: `Doctor with phone "${payload.phone}" already exists` }, { status: 409 });
      }
    }
    if (hasMci) {
      const duplicateMci = await Doctor.findOne({ _id: { $ne: id }, mciNumber: payload.mciNumber });
      if (duplicateMci) {
        return Response.json({ error: `Doctor with MCI "${payload.mciNumber}" already exists` }, { status: 409 });
      }
    }

    const updateOp = hasMci
      ? { $set: payload }
      : { $set: payload, $unset: { mciNumber: "" } };

    const doctor = await Doctor.findByIdAndUpdate(
      id,
      updateOp,
      { returnDocument: "after", runValidators: true }
    );

    if (!doctor) {
      return Response.json({ error: "Doctor not found" }, { status: 404 });
    }

    // Sync updated email to linked User portal account if present
    if (payload.email) {
      await User.findOneAndUpdate(
        { doctorId: doctor._id },
        { $set: { email: payload.email } }
      ).catch(() => {});
    }

    await writeAuditLog(req, auth, {
      action: "doctors.updated",
      resourceType: "Doctor",
      resourceId: doctor._id,
      metadata: {
        doctorId: doctor.doctorId,
        doctorName: doctor.name,
        actor: auth.session.email || auth.session.userId,
        timestamp: new Date().toISOString(),
      },
    });

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

// ── DELETE: Delete single doctor by ID with referral protection and audit ──
export async function DELETE(req, { params }) {
  try {
    const auth = requireTenantSession(req, "doctors.delete");
    if (auth.error) return auth.error;

    const { tenantId } = auth;
    const { Doctor, Patient, BillingRecord } = await getTenantModels(tenantId);
    const { id } = await params;

    const doctor = await Doctor.findById(id);
    if (!doctor) {
      return Response.json({ error: "Doctor not found" }, { status: 404 });
    }

    const subscription = await getLabSubscriptionEntitlements(tenantId);
    const restrictionReason = getDeleteRestrictionReason(doctor, subscription, "doctors");
    if (restrictionReason) {
      return Response.json({ error: "Deletion window expired", details: restrictionReason }, { status: 403 });
    }

    const hasReferrals = await BillingRecord.exists({ referralDoctor: doctor._id })
      || (doctor.name && await Patient.exists({ refDoctorName: doctor.name }))
      || await Patient.exists({ refDoctor: doctor._id });

    if (hasReferrals) {
      doctor.status = "Archived";
      doctor.isDeleted = true;
      doctor.deletedAt = new Date();
      doctor.deletedBy = auth.session.email || auth.session.userId;
      await doctor.save();

      await writeAuditLog(req, auth, {
        action: "doctors.archived",
        resourceType: "Doctor",
        resourceId: doctor._id,
        metadata: {
          doctorId: doctor.doctorId,
          doctorName: doctor.name,
          reason: "Doctor has existing referral records; safely archived to protect referral history.",
          actor: auth.session.email || auth.session.userId,
          timestamp: new Date().toISOString(),
        },
      });

      return Response.json({
        success: true,
        archived: true,
        message: "Doctor has existing patient referrals and was safely archived rather than permanently deleted.",
        deletedDoctor: doctor.doctorId,
      });
    }

    doctor.status = "Archived";
    doctor.isDeleted = true;
    doctor.deletedAt = new Date();
    doctor.deletedBy = auth.session.email || auth.session.userId;
    await doctor.save();

    await writeAuditLog(req, auth, {
      action: "doctors.deleted",
      resourceType: "Doctor",
      resourceId: doctor._id,
      metadata: {
        doctorId: doctor.doctorId,
        doctorName: doctor.name,
        actor: auth.session.email || auth.session.userId,
        timestamp: new Date().toISOString(),
      },
    });

    return Response.json({ success: true, deletedDoctor: doctor.doctorId });
  } catch (err) {
    console.error("DELETE /api/doctor/[id] error:", err);
    return jsonError("Delete failed", err, 500);
  }
}
