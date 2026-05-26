import { jsonError } from "@/app/lib/api-response";
import connectMasterDB from "@/app/lib/master-db";
import { hashPassword, hashResetToken, validatePasswordPolicy } from "@/app/lib/password";
import { getTenantModels } from "@/app/lib/tenant-db";
import { getTenantIdFromRequest, normalizeTenantId } from "@/app/lib/tenant-resolver";
import { getDeveloperUserModel } from "@/app/models/master/DeveloperUser";
import { getLabModel } from "@/app/models/master/Lab";

function resolveTenantId(req, bodyTenantId) {
  let requestTenantId = null;
  let normalizedBodyTenantId = null;

  try {
    requestTenantId = getTenantIdFromRequest(req);
  } catch {
    requestTenantId = null;
  }

  if (bodyTenantId) normalizedBodyTenantId = normalizeTenantId(bodyTenantId);
  if (requestTenantId && normalizedBodyTenantId && requestTenantId !== normalizedBodyTenantId) {
    throw new Error("Tenant mismatch");
  }

  return requestTenantId || normalizedBodyTenantId;
}

export async function POST(req) {
  try {
    const body = await req.json();
    const token = String(body.token || "").trim();
    const password = String(body.password || "");
    const confirmPassword = String(body.confirmPassword || body.passwordConfirm || "");
    const userType = body.userType === "developer" ? "developer" : "tenant";

    if (!token || !password || !confirmPassword) {
      return Response.json(
        { error: "Token, new password, and confirm password are required" },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return Response.json(
        { error: "Password and confirm password must match" },
        { status: 400 }
      );
    }

    const passwordPolicy = validatePasswordPolicy(password);
    if (!passwordPolicy.valid) {
      return Response.json(
        { error: passwordPolicy.errors.join("; ") },
        { status: 400 }
      );
    }

    const tokenHash = hashResetToken(token);
    const expiresQuery = { $gt: new Date() };
    let user = null;

    if (userType === "developer") {
      const masterConnection = await connectMasterDB();
      const DeveloperUser = getDeveloperUserModel(masterConnection);
      user = await DeveloperUser.findOne({
        status: "active",
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: expiresQuery,
      }).select("+passwordHash +passwordResetTokenHash +passwordResetExpiresAt");
    } else {
      const tenantId = resolveTenantId(req, body.tenantId);

      if (tenantId) {
        const { User } = await getTenantModels(tenantId);
        user = await User.findOne({
          status: { $in: ["active", "invited"] },
          passwordResetTokenHash: tokenHash,
          passwordResetExpiresAt: expiresQuery,
        }).select("+passwordHash +passwordResetTokenHash +passwordResetExpiresAt");
      } else {
        user = await resolveTenantUserByResetToken(tokenHash, expiresQuery);
      }
    }

    if (!user) {
      return Response.json({ error: "Invalid or expired reset token" }, { status: 400 });
    }

    user.passwordHash = await hashPassword(password);
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpiresAt = undefined;
    user.status = user.status === "invited" ? "active" : user.status;
    await user.save();

    return Response.json({ message: "Password has been reset successfully" });
  } catch (error) {
    if (error.message === "Tenant mismatch") {
      return Response.json({ error: "Tenant mismatch" }, { status: 403 });
    }

    return jsonError("Unable to reset password", error, 500);
  }
}

async function resolveTenantUserByResetToken(tokenHash, expiresQuery) {
  const masterConnection = await connectMasterDB();
  const Lab = getLabModel(masterConnection);
  const labs = await Lab.find({ status: "active" }).select("tenantId").lean();
  const matches = [];

  for (const lab of labs) {
    try {
      const { User } = await getTenantModels(lab.tenantId);
      const user = await User.findOne({
        status: { $in: ["active", "invited"] },
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: expiresQuery,
      }).select("+passwordHash +passwordResetTokenHash +passwordResetExpiresAt");

      if (user) {
        matches.push(user);
      }
    } catch {
      // Skip unavailable tenant databases so invalid token handling stays generic.
    }
  }

  if (matches.length !== 1) {
    return null;
  }

  return matches[0];
}
