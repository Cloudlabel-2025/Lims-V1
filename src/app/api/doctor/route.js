import { jsonError } from "@/app/lib/api-response";
import { getTenantModels } from "@/app/lib/tenant-db";
import { hasPermission, requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";
import { formatDoctorValidationErrors, validateDoctorPayload } from "@/app/utils/doctor-validation";

function clean(value) {
  return String(value || "").trim();
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── POST: Create a new Doctor ──
export async function POST(req) {
  try {
    const auth = requireTenantSession(req, "doctors.register");
    if (auth.error) return auth.error;

    const { tenantId } = auth;
    const moduleAuth = await requireEnabledTenantModule(tenantId, "doctors.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { Doctor } = await getTenantModels(tenantId);
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

    // --- Duplicate Checks ---
    const [existingMCI, existingPhone] = await Promise.all([
      Doctor.findOne({ mciNumber: String(mciNumber) }),
      Doctor.findOne({ phone: String(phone) })
    ]);

    const conflicts = [];
    if (existingMCI) {
      conflicts.push(`MCI Number "${mciNumber}" (belongs to ${existingMCI.name})`);
    }
    if (existingPhone) {
      conflicts.push(`Mobile Number "${phone}" (belongs to ${existingPhone.name})`);
    }

    if (conflicts.length > 0) {
      return Response.json(
        { error: `Duplicate records found: ${conflicts.join(" and ")}.` },
        { status: 409 }
      );
    }

    const doctor = await Doctor.create({
      ...payload,
      email: String(payload.email).toLowerCase(),
      phone: String(phone),
      mciNumber: String(mciNumber).toUpperCase(),
      experience: Number(payload.experience),
      commission: payload.commission !== undefined ? Number(payload.commission) : 0,
    });

    return Response.json(doctor, { status: 201 });

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

    const [doctors, total] = await Promise.all([
      Doctor.find(query)
        .select(selectFields)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Doctor.countDocuments(query),
    ]);

    return Response.json({
      doctors,
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
