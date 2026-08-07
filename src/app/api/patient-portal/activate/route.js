import { NextResponse } from "next/server";
import { normalizeTenantId } from "@/app/lib/tenant-resolver";
import { getTenantModels } from "@/app/lib/tenant-db";
import { hashPatientActivationToken, isValidPortalPin, normalizeDob, hashOtpToken } from "@/app/lib/patient-portal";
import { hashSecret, verifyPassword } from "@/app/lib/password";
import { checkRateLimit, getClientIp } from "@/app/lib/rate-limit";
import { createPatientSessionToken, setPatientSessionCookie } from "@/app/lib/patient-session";
import { jsonError } from "@/app/lib/api-response";

export async function POST(req) {
  try {
    const body = await req.json();
    const tenantId = normalizeTenantId(body.tenantId);
    const token = String(body.token || "");
    const accessPin = String(body.accessPin || "");
    const dob = normalizeDob(body.dob);
    const portalPin = String(body.portalPin || "");
    if (!token || !/^\d{6}$/.test(accessPin) || !dob || !isValidPortalPin(portalPin)) {
      return Response.json({ error: "Enter the access PIN, date of birth, and a new 4-digit portal PIN" }, { status: 400 });
    }
    if (portalPin !== String(body.confirmPortalPin || "")) return Response.json({ error: "Portal PINs do not match" }, { status: 400 });
    const ip = getClientIp(req);
    const limit = await checkRateLimit({ namespace: "patient-activate", identifier: `${tenantId}:${ip}`, maxAttempts: 5, windowMs: 15 * 60 * 1000 });
    if (!limit.allowed) return Response.json({ error: `Too many attempts. Try again in ${limit.retryAfter} seconds.` }, { status: 429 });

    const rawPhone = String(body.phone || "").replace(/\D/g, "");
    const otp = String(body.otp || "").trim();

    const { PatientPortalAccount, Patient } = await getTenantModels(tenantId);

    // Support Mobile + OTP activation flow
    if (rawPhone && otp) {
      if (!/^\d{10}$/.test(rawPhone) || !/^\d{6}$/.test(otp) || !isValidPortalPin(portalPin)) {
        return Response.json({ error: "Enter valid mobile number, 6-digit OTP, and 4-digit PIN" }, { status: 400 });
      }
      if (portalPin !== String(body.confirmPortalPin || "")) return Response.json({ error: "PINs do not match" }, { status: 400 });

      const patient = await Patient.findOne({ phone: rawPhone }).select("dob patientId name phone").lean();
      if (!patient) return Response.json({ error: "Invalid mobile number or OTP" }, { status: 400 });

      const account = await PatientPortalAccount.findOne({ patient: patient._id }).select("+otpHash +otpExpiresAt status patient credentialVersion");
      if (!account || !account.otpHash || !account.otpExpiresAt || account.otpExpiresAt < new Date()) {
        return Response.json({ error: "OTP has expired. Request a new OTP code." }, { status: 400 });
      }

      if (hashOtpToken(otp) !== account.otpHash) {
        return Response.json({ error: "Invalid OTP code" }, { status: 401 });
      }

      account.portalPinHash = await hashSecret(portalPin);
      account.status = "active";
      account.activatedAt = new Date();
      account.lastLoginAt = new Date();
      account.otpHash = undefined;
      account.otpExpiresAt = undefined;
      await account.save();

      const sessionToken = createPatientSessionToken({ tenantId, patientId: String(patient._id), accountId: String(account._id), credentialVersion: account.credentialVersion });
      const response = NextResponse.json({ message: "Patient portal activated", patient: { name: patient.name, patientId: patient.patientId } });
      setPatientSessionCookie(response, sessionToken, req);
      return response;
    }

    // Fallback token activation
    const account = await PatientPortalAccount.findOne({
      activationTokenHash: hashPatientActivationToken(token),
      activationExpiresAt: { $gt: new Date() },
      status: "invited",
    }).select("+accessPinHash +activationTokenHash +activationExpiresAt patient credentialVersion");
    if (!account || !(await verifyPassword(accessPin, account.accessPinHash))) {
      return Response.json({ error: "Invalid or expired access details" }, { status: 400 });
    }
    const patient = await Patient.findById(account.patient).select("dob patientId name").lean();
    if (!patient || normalizeDob(patient.dob) !== dob) return Response.json({ error: "Invalid or expired access details" }, { status: 400 });

    account.portalPinHash = await hashSecret(portalPin);
    account.status = "active";
    account.activatedAt = new Date();
    account.lastLoginAt = new Date();
    account.termsAcceptedAt = new Date();
    account.failedLoginAttempts = 0;
    account.lockedUntil = undefined;
    account.activationTokenHash = undefined;
    account.accessPinHash = undefined;
    account.activationExpiresAt = undefined;
    await account.save();

    const sessionToken = createPatientSessionToken({ tenantId, patientId: String(patient._id), accountId: String(account._id), credentialVersion: account.credentialVersion });
    const response = NextResponse.json({ message: "Patient portal activated", patient: { name: patient.name, patientId: patient.patientId } });
    setPatientSessionCookie(response, sessionToken, req);
    return response;
  } catch (error) {
    if (error?.message === "Invalid tenant identifier") return Response.json({ error: "Invalid lab" }, { status: 400 });
    return jsonError("Unable to activate patient portal", error, 500);
  }
}
