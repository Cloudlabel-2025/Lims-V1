import { NextResponse } from "next/server";
import { normalizeTenantId } from "@/app/lib/tenant-resolver";
import { getTenantModels } from "@/app/lib/tenant-db";
import { normalizeDob } from "@/app/lib/patient-portal";
import { checkRateLimit, getClientIp } from "@/app/lib/rate-limit";
import { createPatientSessionToken, setPatientSessionCookie } from "@/app/lib/patient-session";
import { jsonError } from "@/app/lib/api-response";
import { getLabSubscriptionEntitlements } from "@/app/lib/subscription-service";
import { hasPatientPortalEntitlement } from "@/app/lib/portal-policy";

export async function POST(req) {
  try {
    const body = await req.json();
    const tenantId = normalizeTenantId(body.tenantId);
    const phone = String(body.phone || body.username || "").trim().replace(/\D/g, "");
    const dob = normalizeDob(body.dob || body.password || "");

    if (!phone || !dob) {
      return Response.json({ error: "Please enter your mobile number and date of birth" }, { status: 400 });
    }

    const subscription = await getLabSubscriptionEntitlements(tenantId);
    if (!hasPatientPortalEntitlement(subscription)) {
      return Response.json({
        error: "Patient Portal access is not enabled in your laboratory's active subscription package. Contact your laboratory administrator to enable Patient Portal.",
      }, { status: 403 });
    }

    const ip = getClientIp(req);
    const limit = await checkRateLimit({ namespace: "patient-login", identifier: `${tenantId}:${phone}:${ip}`, maxAttempts: 5, windowMs: 15 * 60 * 1000 });
    if (!limit.allowed) return Response.json({ error: `Too many attempts. Try again in ${limit.retryAfter} seconds.` }, { status: 429 });

    const { Patient, PatientPortalAccount } = await getTenantModels(tenantId);

    // Find all patients sharing this mobile number
    const patients = await Patient.find({
      $or: [
        { phone },
        { phone: `+91${phone}` },
        { phone: `91${phone}` },
      ],
    }).select("name patientId dob phone").lean();

    // Match the specific patient by date of birth
    const patient = patients.find(p => normalizeDob(p.dob) === dob);

    if (!patient) {
      return Response.json({ error: "Invalid mobile number or date of birth" }, { status: 401 });
    }

    // Retrieve or auto-create the PatientPortalAccount
    let account = await PatientPortalAccount.findOne({ patient: patient._id }).select("status credentialVersion");
    if (!account) {
      account = await PatientPortalAccount.create({
        patient: patient._id,
        status: "active",
        activatedAt: new Date(),
        lastLoginAt: new Date(),
        credentialVersion: 1
      });
    } else {
      if (account.status === "disabled") {
        return Response.json({ error: "Patient Portal access is disabled for this account." }, { status: 403 });
      }
      account.status = "active";
      account.lastLoginAt = new Date();
      await account.save();
    }

    const token = createPatientSessionToken({
      tenantId,
      patientId: String(patient._id),
      accountId: String(account._id),
      credentialVersion: account.credentialVersion,
    });

    const response = NextResponse.json({
      message: "Signed in",
      patient: { name: patient.name, patientId: patient.patientId }
    });

    setPatientSessionCookie(response, token, req);
    return response;
  } catch (error) {
    if (error?.message === "Invalid tenant identifier") return Response.json({ error: "Invalid lab" }, { status: 400 });
    return jsonError("Unable to sign in to patient portal", error, 500);
  }
}
