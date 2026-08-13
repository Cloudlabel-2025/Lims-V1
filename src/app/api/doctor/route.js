import { jsonError } from "@/app/lib/api-response";
import { escapeRegex } from "@/app/lib/string-utils";
import { getTenantModels } from "@/app/lib/tenant-db";
import { hasPermission, requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";
import { formatDoctorValidationErrors, validateDoctorPayload } from "@/app/utils/doctor-validation";
import { createDoctorInvitation, splitDoctorName } from "@/app/lib/doctor-invitation";
import { writeAuditLog } from "@/app/lib/audit";

function clean(value) {
  return String(value || "").trim();
}

import { getLabSubscriptionEntitlements } from "@/app/lib/subscription-service";
import { hasDoctorPortalEntitlement } from "@/app/lib/portal-policy";
import connectMasterDB from "@/app/lib/master-db";
import { getSubscriptionPackageModel } from "@/app/models/master/SubscriptionPackage";
import { getDeleteRestrictionReason } from "@/app/lib/deletion-policy";

// ── POST: Create a new Doctor ──
export async function POST(req) {
  try {
    const auth = requireTenantSession(req, "doctors.register");
    if (auth.error) return auth.error;

    const { tenantId } = auth;
    const moduleAuth = await requireEnabledTenantModule(tenantId, "doctors.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { connection, Doctor, User, Role } = await getTenantModels(tenantId);
    const body = await req.json();
    const payload = Object.fromEntries(
      Object.entries(body).map(([key, value]) => [key, typeof value === "string" ? value.trim() : value])
    );

    const validationErrors = validateDoctorPayload(payload);

    if (Object.keys(validationErrors).length > 0) {
      return Response.json(
        { error: formatDoctorValidationErrors(validationErrors) },
        { status: 400 }
      );
    }

    if (!payload.genderIdentity) delete payload.genderIdentity;

    const { mciNumber, phone } = payload;
    const mciValue = String(mciNumber ?? "").trim();
    const email = String(payload.email).toLowerCase();

    // --- Duplicate Checks ---
    const [existingMCI, existingPhone, existingDoctorEmail, existingUser] = await Promise.all([
      mciValue ? Doctor.findOne({ mciNumber: mciValue.toUpperCase() }) : Promise.resolve(null),
      Doctor.findOne({ phone: String(phone) }),
      Doctor.findOne({ email }),
      User.findOne({ email }).select("_id doctorId status"),
    ]);

    const conflicts = [];
    if (existingMCI) {
      conflicts.push(`MCI Number "${mciNumber}" (belongs to ${existingMCI.name})`);
    }
    if (existingPhone) {
      conflicts.push(`Mobile Number "${phone}" (belongs to ${existingPhone.name})`);
    }
    if (existingDoctorEmail) conflicts.push(`Email "${email}" (belongs to ${existingDoctorEmail.name})`);
    if (existingUser) conflicts.push(`Email "${email}" is already used by a portal account`);

    if (conflicts.length > 0) {
      return Response.json(
        { error: `Duplicate records found: ${conflicts.join(" and ")}.` },
        { status: 409 }
      );
    }

    const subscription = await getLabSubscriptionEntitlements(tenantId);
    const allowDoctorPortal = hasDoctorPortalEntitlement(subscription);

    let doctor;
    let portalUser = null;
    let invitationSent = false;
    let invitationError = "";

    if (allowDoctorPortal) {
      const doctorRole = await Role.findOne({ name: "Doctor Regular", status: "active" })
        || await Role.findOne({ name: "Doctor", status: "active" })
        || await Role.findOne({ status: "active" });
      if (doctorRole) {
        const limit = subscription.entitlements?.quotas?.staffUsers ?? null;
        if (limit !== null) {
          const activeCount = await User.countDocuments({ status: "active" });
          if (activeCount >= limit) {
            const masterConnection = await connectMasterDB();
            const SubscriptionPackage = getSubscriptionPackageModel(masterConnection);
            const pkg = await SubscriptionPackage.findOne({ key: subscription.packageKey }).lean();
            const version = pkg?.versions?.find((item) => item.version === pkg.activeVersion) || pkg?.versions?.at(-1);
            const addons = version?.addons || {
              staffUsers: { units: 1, priceMinor: 20000 }
            };
            const currency = version?.pricing?.currency || "INR";
            return Response.json(
              { 
                error: `Active staff account limit exceeded (${limit}). Cannot register portal account for doctor. Please upgrade your subscription package.`,
                addon: {
                  quotaKey: "staffUsers",
                  units: addons.staffUsers?.units ?? 1,
                  priceMinor: addons.staffUsers?.priceMinor ?? 20000,
                  currency
                }
              },
              { status: 403 }
            );
          }
        }

        const invitation = createDoctorInvitation();
        const { firstName, lastName } = splitDoctorName(payload.name);

        await connection.transaction(async (session) => {
          [doctor] = await Doctor.create([{
            ...payload,
            email,
            phone: String(phone),
            mciNumber: mciValue ? mciValue.toUpperCase() : undefined,
            experience: Number(payload.experience),
            commission: payload.commission !== undefined ? Number(payload.commission) : 0,
          }], { session });

          [portalUser] = await User.create([{
            firstName,
            lastName,
            email,
            role: doctorRole._id,
            status: "invited",
            doctorId: doctor._id,
            createdBy: auth.session.userId,
            passwordResetTokenHash: invitation.otpHash,
            passwordResetExpiresAt: invitation.expiresAt,
          }], { session });
        });

        // Do not automatically send portal activation email.
        // The lab will send the access portal invitation link manually.
        invitationSent = false;
        invitationError = "";
      } else {
        doctor = await Doctor.create({
          ...payload,
          email,
          phone: String(phone),
          mciNumber: mciValue ? mciValue.toUpperCase() : undefined,
          experience: Number(payload.experience),
          commission: payload.commission !== undefined ? Number(payload.commission) : 0,
        });
      }
    } else {
      doctor = await Doctor.create({
        ...payload,
        email,
        phone: String(phone),
        mciNumber: mciValue ? mciValue.toUpperCase() : undefined,
        experience: Number(payload.experience),
        commission: payload.commission !== undefined ? Number(payload.commission) : 0,
      });
    }

    await writeAuditLog(req, auth, {
      action: allowDoctorPortal ? "doctor.registered_with_portal" : "doctor.registered_directory_only",
      resourceType: "Doctor",
      resourceId: doctor._id,
      metadata: { userId: portalUser?._id, email, invitationSent, allowDoctorPortal },
    });

    return Response.json({
      ...(doctor.toObject ? doctor.toObject() : doctor),
      portalAccount: allowDoctorPortal && portalUser ? {
        userId: portalUser.userId,
        status: portalUser.status,
        email,
        invitationSent,
        invitationError: invitationSent ? "" : invitationError,
      } : null,
    }, { status: 201 });

  } catch (err) {
    console.error("POST /api/doctor error:", err);

    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map((e) => e.message);
      return Response.json({ error: messages.join("; ") }, { status: 400 });
    }

    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return Response.json(
        { error: `Duplicate value for ${field}. This ${field} already exists.` },
        { status: 409 }
      );
    }

    return Response.json(
      { error: "Internal server error. Please try again." },
      { status: 500 }
    );
  }
}

// ── GET: List / Search Doctors ──
export async function GET(req) {
  try {
    const auth = requireTenantSession(req, "doctors.view");
    if (auth.error) return auth.error;

    const { tenantId } = auth;
    const moduleAuth = await requireEnabledTenantModule(tenantId, "doctors.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { Doctor } = await getTenantModels(tenantId);

    const { searchParams } = new URL(req.url);
    const search = clean(searchParams.get("search"));
    const status = clean(searchParams.get("status"));
    const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, Number.parseInt(searchParams.get("limit") || "20", 10)));

    let query = {};

    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      query.$or = [
        { name: regex },
        { phone: regex },
        { doctorId: regex },
        { mciNumber: regex },
        { speciality: regex },
      ];
    }

    if (status && status !== "all") {
      query.status = status;
    }

    const canViewFinancials = hasPermission(auth.session, "accounts.view");
    const selectFields = canViewFinancials
      ? null
      : "-commission -pendingPayout";

    const [doctors, total, subscription] = await Promise.all([
      Doctor.find(query)
        .select(selectFields)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Doctor.countDocuments(query),
      getLabSubscriptionEntitlements(tenantId),
    ]);

    const enrichedDoctors = doctors.map((doc) => ({
      ...doc,
      deleteRestrictionReason: getDeleteRestrictionReason(doc, subscription, "doctors"),
    }));

    return Response.json({
      doctors: enrichedDoctors,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });

  } catch (err) {
    console.error("GET /api/doctor error:", err);
    return jsonError("Fetch failed", err, 500);
  }
}
