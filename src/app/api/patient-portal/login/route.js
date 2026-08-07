import { NextResponse } from "next/server";
import { normalizeTenantId } from "@/app/lib/tenant-resolver";
import { getTenantModels } from "@/app/lib/tenant-db";
import { isValidPortalPin, normalizeDob } from "@/app/lib/patient-portal";
import { verifyPassword } from "@/app/lib/password";
import { checkRateLimit, getClientIp } from "@/app/lib/rate-limit";
import { createPatientSessionToken, setPatientSessionCookie } from "@/app/lib/patient-session";
import { jsonError } from "@/app/lib/api-response";

import { getLabSubscriptionEntitlements } from "@/app/lib/subscription-service";
import { hasPatientPortalEntitlement } from "@/app/lib/portal-policy";

export async function POST(req) {
  try {
    const body = await req.json();
    const tenantId = normalizeTenantId(body.tenantId);
    const identifier = String(body.patientId || body.phone || body.username || "").trim();
    const portalPin = String(body.portalPin || body.password || "").trim();

    if (!identifier || !portalPin) {
      return Response.json({ error: "Enter patient ID or Phone number and Password / PIN" }, { status: 400 });
    }

    const subscription = await getLabSubscriptionEntitlements(tenantId);
    if (!hasPatientPortalEntitlement(subscription)) {
      return Response.json({
        error: "Patient Portal access is not included in your lab's active subscription package. Contact laboratory to enable portal access.",
      }, { status: 403 });
    }

    const ip = getClientIp(req);
    const limit = await checkRateLimit({ namespace: "patient-login", identifier: `${tenantId}:${identifier}:${ip}`, maxAttempts: 5, windowMs: 15 * 60 * 1000 });
    if (!limit.allowed) return Response.json({ error: `Too many attempts. Try again in ${limit.retryAfter} seconds.` }, { status: 429 });

    const { Patient, PatientPortalAccount } = await getTenantModels(tenantId);
    const patient = await Patient.findOne({
      $or: [
        { patientId: identifier.toUpperCase() },
        { phone: identifier },
        { phone: identifier.replace(/[^0-9]/g, "") },
      ],
    }).select("name patientId dob phone").lean();

    const account = patient ? await PatientPortalAccount.findOne({ patient: patient._id }).select("+portalPinHash status credentialVersion failedLoginAttempts lockedUntil") : null;
    if (!patient || !account || !["active", "locked"].includes(account.status)) {
      return Response.json({ error: "Invalid patient ID/Phone or Password/PIN" }, { status: 401 });
    }
    if (account.lockedUntil && account.lockedUntil > new Date()) return Response.json({ error: "Portal is temporarily locked. Contact the laboratory or try later." }, { status: 423 });
    if (!account.portalPinHash || !(await verifyPassword(portalPin, account.portalPinHash))) {
      const attempts = Number(account.failedLoginAttempts || 0) + 1;
      account.failedLoginAttempts = attempts;
      if (attempts >= 5) { account.status = "locked"; account.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); }
      await account.save();
      return Response.json({ error: "Invalid patient ID/Phone or Password/PIN" }, { status: 401 });
    }
    account.status = "active";
    account.failedLoginAttempts = 0;
    account.lockedUntil = undefined;
    account.lastLoginAt = new Date();
    await account.save();
    const token = createPatientSessionToken({ tenantId, patientId: String(patient._id), accountId: String(account._id), credentialVersion: account.credentialVersion });
    const response = NextResponse.json({ message: "Signed in", patient: { name: patient.name, patientId: patient.patientId } });
    setPatientSessionCookie(response, token, req);
    return response;
  } catch (error) {
    if (error?.message === "Invalid tenant identifier") return Response.json({ error: "Invalid lab" }, { status: 400 });
    return jsonError("Unable to sign in to patient portal", error, 500);
  }
}
