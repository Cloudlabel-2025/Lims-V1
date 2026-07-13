import { jsonError } from "@/app/lib/api-response";
import connectMasterDB from "@/app/lib/master-db";
import { sendPasswordResetEmail } from "@/app/lib/reset-email";
import { getTenantModels } from "@/app/lib/tenant-db";
import { normalizeTenantId } from "@/app/lib/tenant-resolver";
import { getDeveloperUserModel } from "@/app/models/master/DeveloperUser";
import { getLabModel } from "@/app/models/master/Lab";
import { checkRateLimit, getClientIp } from "@/app/lib/rate-limit";
import crypto from "node:crypto";

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_LENGTH = 6;

function generateOtp() {
  return String(crypto.randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");
}

async function resolveUserByEmailAndTenant(email, tenantIdValue) {
  let tenantId = "";
  try {
    tenantId = normalizeTenantId(tenantIdValue);
  } catch {
    return { tenantId: null, user: null };
  }

  try {
    const masterConnection = await connectMasterDB();
    const Lab = getLabModel(masterConnection);
    const lab = await Lab.findOne({ tenantId, status: "active" }).select("tenantId").lean();
    if (!lab) return { tenantId: null, user: null };

    const { User } = await getTenantModels(lab.tenantId);
    const user = await User.findOne({
      email,
      status: { $in: ["active", "invited"] },
    }).select("+passwordResetTokenHash +passwordResetExpiresAt");

    return user ? { tenantId: lab.tenantId, user } : { tenantId: null, user: null };
  } catch {
    return { tenantId: null, user: null };
  }
}

async function resolveDeveloperUser(email) {
  try {
    const masterConnection = await connectMasterDB();
    const DeveloperUser = getDeveloperUserModel(masterConnection);
    const user = await DeveloperUser.findOne({ email, status: "active" }).select(
      "+passwordResetTokenHash +passwordResetExpiresAt"
    );
    return user || null;
  } catch {
    return null;
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const userType = body.userType === "developer" ? "developer" : "tenant";
    const bodyTenantId = String(body.tenantId || "").trim();

    if (!email) {
      return Response.json({ error: "Email is required" }, { status: 400 });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: "Invalid email format" }, { status: 400 });
    }

    if (userType === "tenant" && !bodyTenantId) {
      return Response.json({ error: "Tenant ID is required" }, { status: 400 });
    }

    const rateCheck = await checkRateLimit({
      namespace: "forgot-password",
      identifier: email,
      maxAttempts: 3,
      windowMs: 15 * 60 * 1000,
    });

    if (!rateCheck.allowed) {
      return Response.json(
        { error: `Too many requests. Try again in ${rateCheck.retryAfter} seconds.` },
        { status: 429 }
      );
    }

    let user = null;
    let resetTenantId = null;

    if (userType === "developer") {
      user = await resolveDeveloperUser(email);
    } else {
      const resolved = await resolveUserByEmailAndTenant(email, bodyTenantId);
      user = resolved.user;
      resetTenantId = resolved.tenantId;
    }

    if (!user) {
      return Response.json({ error: "No account found with this email address." }, { status: 404 });
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    user.passwordResetTokenHash = otp;
    user.passwordResetExpiresAt = expiresAt;

    try {
      await user.save();
    } catch {
      return jsonError("Unable to process password reset", null, 500);
    }

    let emailResult = null;
    try {
      emailResult = await sendPasswordResetEmail({ to: email, otp, expiresAt });
    } catch (emailError) {
      emailResult = { sent: false, reason: emailError.message };
    }

    if (!emailResult?.sent) {
      return Response.json(
        { error: "Unable to send OTP email. Please try again later." },
        { status: 500 }
      );
    }

    return Response.json({
      message: "OTP sent to your email. Check your inbox.",
    });
  } catch (error) {
    return jsonError("Unable to start password reset", error, 500);
  }
}
