import { jsonError } from "@/app/lib/api-response";
import { normalizeTenantId } from "@/app/lib/tenant-resolver";
import { getTenantModels } from "@/app/lib/tenant-db";
import { generateMobileOtp } from "@/app/lib/patient-portal";
import { checkRateLimit, getClientIp } from "@/app/lib/rate-limit";
import { getLabSubscriptionEntitlements } from "@/app/lib/subscription-service";
import { hasPatientPortalEntitlement } from "@/app/lib/portal-policy";

export async function POST(req) {
  try {
    const body = await req.json();
    const tenantId = normalizeTenantId(body.tenantId);
    const rawPhone = String(body.phone || "").replace(/\D/g, "");

    if (!rawPhone || rawPhone.length !== 10) {
      return Response.json({ error: "Enter a valid 10-digit mobile number" }, { status: 400 });
    }

    const subscription = await getLabSubscriptionEntitlements(tenantId);
    if (!hasPatientPortalEntitlement(subscription)) {
      return Response.json({
        error: "Patient Portal access is not enabled in your laboratory's active subscription package. Contact your laboratory administrator to enable Patient Portal.",
      }, { status: 403 });
    }

    const ip = getClientIp(req);
    const limit = await checkRateLimit({
      namespace: "patient-send-otp",
      identifier: `${tenantId}:${rawPhone}:${ip}`,
      maxAttempts: 5,
      windowMs: 10 * 60 * 1000,
    });
    if (!limit.allowed) {
      return Response.json({ error: `Too many OTP requests. Try again in ${limit.retryAfter} seconds.` }, { status: 429 });
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
    }).select("name phone patientId").lean();

    if (!patient) {
      return Response.json({
        error: "No patient record found with this mobile number. Please check the number or ensure you registered with this mobile number at the lab.",
      }, { status: 404 });
    }

    const { otp, otpHash, expiresAt } = generateMobileOtp();

    let account = await PatientPortalAccount.findOne({ patient: patient._id });
    if (!account) {
      account = await PatientPortalAccount.create({
        patient: patient._id,
        status: "active",
        otpHash,
        otpExpiresAt: expiresAt,
        otpAttempts: 0,
      });
    } else {
      account.otpHash = otpHash;
      account.otpExpiresAt = expiresAt;
      account.otpAttempts = 0;
      await account.save();
    }

    const maskedPhone = `+91 ******${rawPhone.slice(-4)}`;
    console.log(`[PATIENT-PORTAL-OTP] Sent OTP ${otp} to phone ${rawPhone} for tenant ${tenantId}`);

    return Response.json({
      success: true,
      message: `OTP sent successfully to ${maskedPhone}.`,
      devOtp: otp, // Displayed on screen during local testing
    });
  } catch (error) {
    if (error?.message === "Invalid tenant identifier") return Response.json({ error: "Invalid lab" }, { status: 400 });
    return jsonError("Unable to send OTP", error, 500);
  }
}
