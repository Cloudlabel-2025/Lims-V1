import connectMasterDB from "@/app/lib/master-db";
import { createResetToken } from "@/app/lib/password";
import { getTenantModels } from "@/app/lib/tenant-db";
import { getTenantIdFromRequest, normalizeTenantId } from "@/app/lib/tenant-resolver";
import { getDeveloperUserModel } from "@/app/models/master/DeveloperUser";

const resetTokenTtlMs = 30 * 60 * 1000;

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
    const email = String(body.email || "").trim().toLowerCase();
    const userType = body.userType === "developer" ? "developer" : "tenant";

    if (!email) {
      return Response.json({ error: "Email is required" }, { status: 400 });
    }

    const { token, tokenHash } = createResetToken();
    const expiresAt = new Date(Date.now() + resetTokenTtlMs);
    let user = null;

    if (userType === "developer") {
      const masterConnection = await connectMasterDB();
      const DeveloperUser = getDeveloperUserModel(masterConnection);
      user = await DeveloperUser.findOne({ email, status: "active" }).select(
        "+passwordResetTokenHash +passwordResetExpiresAt"
      );
    } else {
      const tenantId = resolveTenantId(req, body.tenantId);
      if (!tenantId) {
        return Response.json({ error: "Tenant is required" }, { status: 400 });
      }

      const { User } = await getTenantModels(tenantId);
      user = await User.findOne({ email, status: { $in: ["active", "invited"] } }).select(
        "+passwordResetTokenHash +passwordResetExpiresAt"
      );
    }

    if (user) {
      user.passwordResetTokenHash = tokenHash;
      user.passwordResetExpiresAt = expiresAt;
      await user.save();
    }

    const response = {
      message: "If the account exists, a password reset link has been generated.",
    };

    if (process.env.NODE_ENV !== "production" && user) {
      response.resetToken = token;
      response.expiresAt = expiresAt;
    }

    return Response.json(response);
  } catch (error) {
    if (error.message === "Tenant mismatch") {
      return Response.json({ error: "Tenant mismatch" }, { status: 403 });
    }

    return Response.json(
      { error: "Unable to start password reset", details: error.message },
      { status: 500 }
    );
  }
}
