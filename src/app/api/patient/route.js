import { jsonError } from "@/app/lib/api-response";
import { getTenantModels } from "@/app/lib/tenant-db";
import { requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";
import { createPatientAccessCredential, normalizeDob } from "@/app/lib/patient-portal";
import { writeAuditLog } from "@/app/lib/audit";
import { ensureQuotaPeriod, recordShadowUsage } from "@/app/lib/quota-meter";
import { getShadowSubscriptionEntitlements } from "@/app/lib/subscription-service";
import connectMasterDB from "@/app/lib/master-db";
import { getSubscriptionPackageModel } from "@/app/models/master/SubscriptionPackage";

function clean(value) {
  return String(value || "").trim();
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function POST(req) {
  let subscription = null;
  try {
    const auth = requireTenantSession(req, "patients.register");
    if (auth.error) return auth.error;

    const { tenantId } = auth;
    const moduleAuth = await requireEnabledTenantModule(tenantId, "patients.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { connection, Patient, PatientPortalAccount } = await getTenantModels(tenantId);
    const body = await req.json();

    const { name, dob, age, gender, phone, address, force } = body;
    const missing = [];
    if (!clean(name)) missing.push("Full Name");
    if (!dob) missing.push("Date of Birth");
    if (age === undefined || age === null || age === "") missing.push("Age");
    if (!clean(gender)) missing.push("Gender");
    if (!clean(phone)) missing.push("Mobile Number");
    if (!clean(address)) missing.push("Address");

    if (missing.length > 0) {
      return Response.json({ error: `Missing required fields: ${missing.join(", ")}` }, { status: 400 });
    }

    const dobDate = new Date(dob);
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

    if (Number(age) < 0 || Number(age) > 150) {
      return Response.json({ error: "Age must be between 0 and 150" }, { status: 400 });
    }

    if (gender === "Other" && !body.genderIdentity) {
      return Response.json({ error: "Gender Identity is required when Gender is 'Other'" }, { status: 400 });
    }

    if (!/^\d{10}$/.test(String(phone))) {
      return Response.json({ error: "Mobile Number must be exactly 10 digits" }, { status: 400 });
    }

    const addr = clean(body.address);
    if (!/^[A-Za-z0-9 .,/#-]+$/.test(addr)) {
      return Response.json({ error: "Only letters, numbers, spaces, and . , / # - allowed in address" }, { status: 400 });
    }
    if (/https?:\/\/|www\./i.test(addr)) {
      return Response.json({ error: "URLs not allowed in address" }, { status: 400 });
    }

    if (body.uhId && !/^[A-Za-z0-9]{14}$/.test(String(body.uhId))) {
      return Response.json({ error: "UH ID must be exactly 14 alphanumeric characters" }, { status: 400 });
    }

    if (body.uhId) {
      const existingUhId = await Patient.findOne({ uhId: String(body.uhId) });
      if (existingUhId) {
        return Response.json({ error: "UH ID already exists" }, { status: 400 });
      }
    }

    const cleanPhone = String(phone).replace(/\D/g, "");
    const existingPatients = await Patient.find({
      $or: [
        { phone: cleanPhone },
        { phone: `+91${cleanPhone}` },
        { phone: `91${cleanPhone}` },
      ],
    }).lean();

    if (existingPatients.length >= 2) {
      return Response.json({
        error: "Maximum of 2 patients can share the same mobile number. Registering a third patient is not allowed."
      }, { status: 400 });
    }

    const inputDobNormalized = normalizeDob(dob);
    const dobMatch = existingPatients.find(p => normalizeDob(p.dob) === inputDobNormalized);
    if (dobMatch) {
      return Response.json({
        error: "A patient with this mobile number and date of birth is already registered."
      }, { status: 400 });
    }

    if (existingPatients.length === 1 && !force) {
      return Response.json({
        warning: "Mobile already exists",
        patient: existingPatients[0]
      }, { status: 200 });
    }

    let access;
    [access, subscription] = await Promise.all([
      createPatientAccessCredential(tenantId, req.url),
      getShadowSubscriptionEntitlements(tenantId),
    ]);
    await ensureQuotaPeriod(connection, tenantId, subscription);
    let patient;
    let quotaUsage;
    await connection.transaction(async (session) => {
      [patient] = await Patient.create([{
        ...body,
        selectedTests: undefined,
        phone: String(phone),
        refDoctorName: body.refDoctorName || undefined,
      }], { session });
      await PatientPortalAccount.create([{
        patient: patient._id,
        status: "active",
        lastAccessSlipIssuedAt: new Date(),
      }], { session });
      quotaUsage = await recordShadowUsage({
        connection,
        tenantId,
        subscription,
        quotaKey: "patientRegistrations",
        idempotencyKey: `patient-registration:${patient._id}`,
        relatedResourceType: "Patient",
        relatedResourceId: patient._id,
        actorId: auth.session.userId,
        actorEmail: auth.session.email,
        metadata: { source: "patient-api", shadowMode: true },
        session,
      });
      if (!quotaUsage.duplicate && quotaUsage.event?.wouldExceedLimit) {
        const error = new Error("Patient registration quota exceeded");
        error.name = "QuotaExceededError";
        throw error;
      }
    });

    await writeAuditLog(req, auth, {
      action: "patient.portal_provisioned",
      resourceType: "Patient",
      resourceId: patient._id,
      metadata: { expiresAt: access.expiresAt },
    });
    return Response.json({
      ...patient.toObject(),
      portalAccess: { activationUrl: access.portalUrl, expiresAt: access.expiresAt },
      quotaUsage: quotaUsage?.quota || null,
    }, { status: 201 });
  } catch (err) {
    console.error("POST /api/patient error:", err);

    if (err.name === "QuotaExceededError") {
      const masterConnection = await connectMasterDB();
      const SubscriptionPackage = getSubscriptionPackageModel(masterConnection);
      const pkg = await SubscriptionPackage.findOne({ key: subscription.packageKey }).lean();
      const version = pkg?.versions?.find((item) => item.version === pkg.activeVersion) || pkg?.versions?.at(-1);
      const addons = version?.addons || {
        patientRegistrations: { units: 100, priceMinor: 10000 }
      };
      const currency = version?.pricing?.currency || "INR";
      return Response.json(
        { 
          error: "Usage limit exceeded. Please upgrade your subscription package to register more patients.",
          addon: {
            quotaKey: "patientRegistrations",
            units: addons.patientRegistrations?.units ?? 100,
            priceMinor: addons.patientRegistrations?.priceMinor ?? 10000,
            currency
          }
        },
        { status: 403 }
      );
    }

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

    const { Patient, BillingRecord } = await getTenantModels(tenantId);
    const { searchParams } = new URL(req.url);
    const search = clean(searchParams.get("search"));
    const gender = clean(searchParams.get("gender"));
    const ageMin = clean(searchParams.get("ageMin"));
    const ageMax = clean(searchParams.get("ageMax"));
    const refDoctorOnly = searchParams.get("refDoctorOnly") === "true";
    const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, Number.parseInt(searchParams.get("limit") || "50", 10)));

    let query = {};
    if (auth.session.doctorId) {
      const referredPatientIds = await BillingRecord.distinct("patient", {
        tenantId,
        referralDoctor: auth.session.doctorId,
        status: { $ne: "cancelled" },
      });
      query._id = { $in: referredPatientIds };
    }
    if (refDoctorOnly) {
      query.$and = [
        {
          $or: [
            { refDoctorName: { $exists: true, $ne: "" } },
            { refDoctor: { $exists: true, $ne: null } },
          ],
        },
      ];
    }
    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      const searchOr = [{ name: regex }, { phone: regex }, { patientId: regex }];
      if (query.$and) {
        query.$and.push({ $or: searchOr });
      } else {
        query.$or = searchOr;
      }
    }
    if (gender && ["Male", "Female", "Other"].includes(gender)) {
      query.gender = gender;
    }
    if (ageMin !== "" || ageMax !== "") {
      query.age = {};
      if (ageMin !== "") query.age.$gte = Number(ageMin);
      if (ageMax !== "") query.age.$lte = Number(ageMax);
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
