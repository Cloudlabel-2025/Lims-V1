import { jsonError } from "@/app/lib/api-response";
import connectMasterDB from "@/app/lib/master-db";
import { createResetToken } from "@/app/lib/password";
import { buildPasswordResetUrl, sendPasswordResetEmail } from "@/app/lib/reset-email";
import { getTenantModels } from "@/app/lib/tenant-db";
import { normalizeTenantId } from "@/app/lib/tenant-resolver";
import { getDeveloperUserModel } from "@/app/models/master/DeveloperUser";
import { getLabModel } from "@/app/models/master/Lab";

const resetTokenTtlMs = 30 * 60 * 1000;

export async function POST(req) {
  try {
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const userType = body.userType === "developer" ? "developer" : "tenant";
    const bodyTenantId = String(body.tenantId || "").trim();

    if (!email) {
      return Response.json({ error: "Email is required" }, { status: 400 });
    }

    const { token, tokenHash } = createResetToken();
    const expiresAt = new Date(Date.now() + resetTokenTtlMs);
    let user = null;
    let resetTenantId = null;

    if (userType === "developer") {
      const masterConnection = await connectMasterDB();
      const DeveloperUser = getDeveloperUserModel(masterConnection);
      user = await DeveloperUser.findOne({ email, status: "active" }).select(
        "+passwordResetTokenHash +passwordResetExpiresAt"
      );
    } else {
      const resolved = bodyTenantId
        ? await resolveTenantUserByEmailAndTenant(email, bodyTenantId)
        : await resolveTenantUserByEmail(email);
      user = resolved.user;
      resetTenantId = resolved.tenantId;
    }

    if (user) {
      user.passwordResetTokenHash = tokenHash;
      user.passwordResetExpiresAt = expiresAt;
      await user.save();
    }

    let emailDelivery = null;
    if (user) {
      const resetUrl = buildPasswordResetUrl(req, {
        token,
        userType,
        tenantId: resetTenantId,
      });

      try {
        emailDelivery = await sendPasswordResetEmail({
          to: email,
          resetUrl,
          expiresAt,
        });
      } catch (emailError) {
        emailDelivery = { sent: false, reason: emailError.message };
        console.error("Password reset email failed:", emailError.message);
      }
    }

    const response = {
      message: "If the account exists, a password reset link has been generated.",
    };

    if (process.env.NODE_ENV !== "production" && user) {
      response.resetToken = token;
      response.expiresAt = expiresAt;
      response.emailDelivery = emailDelivery;
      response.resetContext = {
        userType,
        tenantId: resetTenantId,
      };
    }

    return Response.json(response);
  } catch (error) {
    return jsonError("Unable to start password reset", error, 500);
  }
}

async function resolveTenantUserByEmail(email) {
  const masterConnection = await connectMasterDB();
  const Lab = getLabModel(masterConnection);
  const labs = await Lab.find({ status: "active" }).select("tenantId").lean();
  const matches = [];

  for (const lab of labs) {
    try {
      const { User } = await getTenantModels(lab.tenantId);
      const user = await User.findOne({
        email,
        status: { $in: ["active", "invited"] },
      }).select("+passwordResetTokenHash +passwordResetExpiresAt");

      if (user) {
        matches.push({ tenantId: lab.tenantId, user });
      }
    } catch {
      // Skip unavailable tenant databases so reset requests remain non-enumerating.
    }
  }

  if (matches.length !== 1) {
    return { tenantId: null, user: null };
  }

  return matches[0];
}

async function resolveTenantUserByEmailAndTenant(email, tenantIdValue) {
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

    if (!lab) {
      return { tenantId: null, user: null };
    }

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
