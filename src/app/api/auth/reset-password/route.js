import { jsonError } from "@/app/lib/api-response";
import connectMasterDB from "@/app/lib/master-db";
import { hashPassword, validatePasswordPolicy } from "@/app/lib/password";
import { getTenantModels } from "@/app/lib/tenant-db";
import { normalizeTenantId } from "@/app/lib/tenant-resolver";
import { getDeveloperUserModel } from "@/app/models/master/DeveloperUser";
import { getLabModel } from "@/app/models/master/Lab";
import { checkRateLimit, resetRateLimit, getClientIp } from "@/app/lib/rate-limit";

async function resolveUserByOtpAndTenant(otp, tenantId) {
  const { User } = await getTenantModels(tenantId);
  const user = await User.findOne({
    status: { $in: ["active", "invited"] },
    passwordResetTokenHash: otp,
    passwordResetExpiresAt: { $gt: new Date() },
  }).select("+passwordHash +passwordResetTokenHash +passwordResetExpiresAt");

  return user || null;
}

export async function POST(req) {
  try {
    const ip = getClientIp(req);
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const otp = String(body.otp || "").trim();
    const password = String(body.password || "");
    const confirmPassword = String(body.confirmPassword || body.passwordConfirm || "");
    const userType = body.userType === "developer" ? "developer" : "tenant";

    if (!email || !otp || !password || !confirmPassword) {
      return Response.json(
        { error: "Email, OTP, new password, and confirm password are required" },
        { status: 400 }
      );
    }

    if (!/^\d{6}$/.test(otp)) {
      return Response.json({ error: "OTP must be a 6-digit number" }, { status: 400 });
    }

    const rateCheck = await checkRateLimit({
      namespace: "reset-password",
      identifier: `${userType}:${email}:${ip}`,
      maxAttempts: 5,
      windowMs: 15 * 60 * 1000,
    });

    if (!rateCheck.allowed) {
      return Response.json(
        { error: `Too many attempts. Try again in ${rateCheck.retryAfter} seconds.` },
        { status: 429 }
      );
    }

    if (password !== confirmPassword) {
      return Response.json({ error: "Password and confirm password must match" }, { status: 400 });
    }

    const passwordPolicy = validatePasswordPolicy(password);
    if (!passwordPolicy.valid) {
      return Response.json({ error: passwordPolicy.errors.join("; ") }, { status: 400 });
    }

    let user = null;

    if (userType === "developer") {
      const masterConnection = await connectMasterDB();
      const DeveloperUser = getDeveloperUserModel(masterConnection);
      user = await DeveloperUser.findOne({
        email,
        status: "active",
        passwordResetTokenHash: otp,
        passwordResetExpiresAt: { $gt: new Date() },
      }).select("+passwordHash +passwordResetTokenHash +passwordResetExpiresAt");
    } else {
      const bodyTenantId = String(body.tenantId || "").trim();
      if (!bodyTenantId) {
        return Response.json({ error: "Tenant ID is required" }, { status: 400 });
      }

      let tenantId = "";
      try {
        tenantId = normalizeTenantId(bodyTenantId);
      } catch {
        return Response.json({ error: "Invalid tenant ID" }, { status: 400 });
      }

      const masterConnection = await connectMasterDB();
      const Lab = getLabModel(masterConnection);
      const lab = await Lab.findOne({ tenantId, status: "active" }).select("tenantId").lean();
      if (!lab) {
        return Response.json({ error: "Invalid or expired OTP" }, { status: 400 });
      }

      user = await resolveUserByOtpAndTenant(otp, lab.tenantId);

      if (user && user.email !== email) {
        user = null;
      }
    }

    if (!user) {
      return Response.json({ error: "Invalid or expired OTP" }, { status: 400 });
    }

    user.passwordHash = await hashPassword(password);
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpiresAt = undefined;
    user.passwordChangedAt = new Date();
    user.status = user.status === "invited" ? "active" : user.status;
    await user.save();

    await Promise.all([
      resetRateLimit("forgot-password", email),
      resetRateLimit("reset-password", `${userType}:${email}:${ip}`),
    ]);

    return Response.json({ message: "Password has been reset successfully" });
  } catch (error) {
    return jsonError("Unable to reset password", error, 500);
  }
}
