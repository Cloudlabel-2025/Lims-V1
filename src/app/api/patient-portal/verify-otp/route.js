import { NextResponse } from "next/server";
import { normalizeTenantId } from "@/app/lib/tenant-resolver";
import { getTenantModels } from "@/app/lib/tenant-db";
import { hashOtpToken } from "@/app/lib/patient-portal";
import { checkRateLimit, getClientIp } from "@/app/lib/rate-limit";
import { createPatientSessionToken, setPatientSessionCookie } from "@/app/lib/patient-session";
import { jsonError } from "@/app/lib/api-response";
import { getLabSubscriptionEntitlements } from "@/app/lib/subscription-service";
import { hasPatientPortalEntitlement } from "@/app/lib/portal-policy";

export async function POST(req) {
  try {
    const body = await req.json();
    const tenantId = normalizeTenantId(body.tenantId);
    const rawPhone = String(body.phone || "").replace(/\D/g, "");
    const otp = String(body.otp || "").trim();

    if (!rawPhone || rawPhone.length !== 10) {
      return Response.json({ error: "Enter a valid 10-digit mobile number" }, { status: 400 });
    }

    if (!otp || !/^\d{6}$/.test(otp)) {
      return Response.json({ error: "Enter a valid 6-digit OTP code" }, { status: 400 });
    }

    const subscription = await getLabSubscriptionEntitlements(tenantId);
    if (!hasPatientPortalEntitlement(subscription)) {
      return Response.json({
        error: "Patient Portal access is not enabled in your laboratory's active subscription package. Contact your laboratory administrator to enable Patient Portal.",
      }, { status: 403 });
    }

    const ip = getClientIp(req);
    const limit = await checkRateLimit({
      namespace: "patient-verify-otp",
      identifier: `${tenantId}:${rawPhone}:${ip}`,
      maxAttempts: 5,
      windowMs: 15 * 60 * 1000,
    });
    if (!limit.allowed) {
      return Response.json({ error: `Too many verification attempts. Try again in ${limit.retryAfter} seconds.` }, { status: 429 });
    }

    const tenDigitPhone = rawPhone.slice(-10);
    const { Patient, PatientPortalAccount } = await getTenantModels(tenantId);
    const patient = await Patient.findOne({
      $or: [
        { phone: rawPhone },
        { phone: tenDigitPhone },
        { phone: `+91${tenDigitPhone}` },
        { phone: `91${tenDigitPhone}` },
      ],
    }).select("name phone patientId dob").lean();

    if (!patient) {
      return Response.json({ error: "Invalid mobile number or OTP" }, { status: 401 });
    }

    const account = await PatientPortalAccount.findOne({ patient: patient._id })
      .select("+otpHash +otpExpiresAt +otpAttempts status credentialVersion lockedUntil");

    if (!account) {
      return Response.json({ error: "Invalid mobile number or OTP" }, { status: 401 });
    }

    if (account.status === "disabled") {
      return Response.json({ error: "Patient Portal access has been disabled for this account." }, { status: 403 });
    }

    if (account.lockedUntil && account.lockedUntil > new Date()) {
      return Response.json({ error: "Portal is temporarily locked. Try again later." }, { status: 423 });
    }

    if (!account.otpHash || !account.otpExpiresAt || account.otpExpiresAt < new Date()) {
      return Response.json({ error: "OTP has expired. Please request a new OTP code." }, { status: 400 });
    }

    const inputHash = hashOtpToken(otp);
    if (inputHash !== account.otpHash) {
      const attempts = Number(account.otpAttempts || 0) + 1;
      account.otpAttempts = attempts;
      if (attempts >= 5) {
        account.status = "locked";
        account.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      }
      await account.save();
      return Response.json({ error: "Invalid OTP code. Please check and try again." }, { status: 401 });
    }

    // OTP Verified successfully!
    account.status = "active";
    account.otpHash = undefined;
    account.otpExpiresAt = undefined;
    account.otpAttempts = 0;
    account.failedLoginAttempts = 0;
    account.lockedUntil = undefined;
    account.lastLoginAt = new Date();
    await account.save();

    const token = createPatientSessionToken({
      tenantId,
      patientId: String(patient._id),
      accountId: String(account._id),
      credentialVersion: account.credentialVersion,
    });

    const response = NextResponse.json({
      message: "Signed in successfully",
      patient: {
        name: patient.name,
        patientId: patient.patientId,
        phone: patient.phone,
      },
    });

    setPatientSessionCookie(response, token, req);
    return response;
  } catch (error) {
    if (error?.message === "Invalid tenant identifier") return Response.json({ error: "Invalid lab" }, { status: 400 });
    return jsonError("Unable to verify OTP", error, 500);
  }
}
