import { jsonError } from "@/app/lib/api-response";
import { getTenantModels } from "@/app/lib/tenant-db";
import { requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";

function clean(value) {
  return String(value || "").trim();
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function POST(req) {
  try {
    const auth = requireTenantSession(req, "patients.register");
    if (auth.error) return auth.error;

    const { tenantId } = auth;
    const moduleAuth = await requireEnabledTenantModule(tenantId, "patients.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { Patient } = await getTenantModels(tenantId);
    const body = await req.json();

    const { name, dob, age, gender, phone, receivedTime, address, force } = body;
    const missing = [];
    if (!clean(name)) missing.push("Full Name");
    if (!dob) missing.push("Date of Birth");
    if (age === undefined || age === null || age === "") missing.push("Age");
    if (!clean(gender)) missing.push("Gender");
    if (!clean(phone)) missing.push("Mobile Number");
    if (!clean(address)) missing.push("Address");
    if (!clean(body.barcode)) missing.push("Barcode");
    if (!clean(body.uhId)) missing.push("UH ID");
    if (!receivedTime) missing.push("Received Time");

    if (missing.length > 0) {
      return Response.json({ error: `Missing required fields: ${missing.join(", ")}` }, { status: 400 });
    }

    const dobDate = new Date(dob);
    if (isNaN(dobDate.getTime())) {
      return Response.json({ error: "Invalid date of birth" }, { status: 400 });
    }

    if (gender === "Other" && !body.genderIdentity) {
      return Response.json({ error: "Gender Identity is required when Gender is 'Other'" }, { status: 400 });
    }

    if (!/^\d{10}$/.test(String(phone))) {
      return Response.json({ error: "Mobile Number must be exactly 10 digits" }, { status: 400 });
    }

    if (!/^[A-Za-z0-9]{14}$/.test(String(body.uhId))) {
      return Response.json({ error: "UH ID must be exactly 14 alphanumeric characters" }, { status: 400 });
    }

    const barcode = clean(body.barcode);
    if (!/^[A-Za-z0-9-_]+$/.test(barcode)) {
      return Response.json({ error: "Barcode: only letters, numbers, hyphens, and underscores allowed" }, { status: 400 });
    }
    if (/https?:\/\/|www\./i.test(barcode)) {
      return Response.json({ error: "URLs not allowed in barcode" }, { status: 400 });
    }

    if (body.collectionTime && new Date(body.collectionTime) > new Date()) {
      return Response.json({ error: "Collection Time cannot be in the future" }, { status: 400 });
    }

    if (body.receivedTime && new Date(body.receivedTime) > new Date()) {
      return Response.json({ error: "Received Time cannot be in the future" }, { status: 400 });
    }

    if (body.collectionTime && new Date(body.receivedTime) < new Date(body.collectionTime)) {
      return Response.json({ error: "Received Time cannot be earlier than Collection Time" }, { status: 400 });
    }

    if (body.collectionTime && new Date(body.collectionTime) < new Date(dob)) {
      return Response.json({ error: "Collection time cannot be before date of birth" }, { status: 400 });
    }
    if (body.receivedTime && new Date(body.receivedTime) < new Date(dob)) {
      return Response.json({ error: "Received time cannot be before date of birth" }, { status: 400 });
    }

    if (!force) {
      const existing = await Patient.findOne({ phone: String(phone) }).sort({ createdAt: 1 });
      if (existing) {
        return Response.json({ warning: "Mobile already exists", patient: existing }, { status: 200 });
      }
    }

    const patient = await Patient.create({
      ...body,
      selectedTests: undefined,
      phone: String(phone),
      refDoctorName: body.refDoctorName || undefined,
    });

    return Response.json(patient.toObject(), { status: 201 });
  } catch (err) {
    console.error("POST /api/patient error:", err);

    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map((e) => e.message);
      return Response.json({ error: messages.join("; ") }, { status: 400 });
    }

    if (err.name === "CastError") {
      return Response.json({ error: `Invalid value for field '${err.path}': ${err.value}` }, { status: 400 });
    }

    return jsonError("Unable to register patient", err, 500);
  }
}

export async function GET(req) {
  try {
    const auth = requireTenantSession(req, "patients.view");
    if (auth.error) return auth.error;

    const { tenantId } = auth;
    const moduleAuth = await requireEnabledTenantModule(tenantId, "patients.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { Patient } = await getTenantModels(tenantId);
    const { searchParams } = new URL(req.url);
    const search = clean(searchParams.get("search"));
    const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, Number.parseInt(searchParams.get("limit") || "50", 10)));

    let query = {};
    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      query = { $or: [{ name: regex }, { phone: regex }, { patientId: regex }, { barcode: regex }] };
    }

    const [patients, total] = await Promise.all([
      Patient.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Patient.countDocuments(query),
    ]);

    return Response.json({
      patients,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (err) {
    return jsonError("Fetch failed", err, 500);
  }
}
