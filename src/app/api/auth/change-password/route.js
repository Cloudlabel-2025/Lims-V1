import { nextJsonError } from "@/app/lib/api-response";
import { requireAnySession } from "@/app/lib/auth";
import connectMasterDB from "@/app/lib/master-db";
import { connectTenantDB } from "@/app/lib/tenant-db";
import { hashPassword, verifyPassword, validatePasswordPolicy } from "@/app/lib/password";
import { getDeveloperUserModel } from "@/app/models/master/DeveloperUser";
import { getUserModel } from "@/app/models/tenant/User";
import { checkRateLimit } from "@/app/lib/rate-limit";

export async function POST(req) {
  try {
    const auth = requireAnySession(req);
    if (auth.error) return auth.error;

    const { session } = auth;

    const body = await req.json();
    const currentPassword = String(body.currentPassword || "");
    const newPassword = String(body.newPassword || "");
    const confirmPassword = String(body.confirmPassword || "");

    if (!currentPassword || !newPassword || !confirmPassword) {
      return Response.json(
        { error: "Current password, new password, and confirm password are required" },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return Response.json(
        { error: "Password and confirm password must match" },
        { status: 400 }
      );
    }

    const passwordPolicy = validatePasswordPolicy(newPassword);
    if (!passwordPolicy.valid) {
      return Response.json({ error: passwordPolicy.errors.join("; ") }, { status: 400 });
    }

    const rateCheck = await checkRateLimit({
      namespace: "change-password",
      identifier: session.userId,
      maxAttempts: 5,
      windowMs: 15 * 60 * 1000,
    });

    if (!rateCheck.allowed) {
      return Response.json(
        { error: `Too many attempts. Try again in ${rateCheck.retryAfter} seconds.` },
        { status: 429 }
      );
    }

    let user = null;

    if (session.userType === "tenant") {
      const connection = await connectTenantDB(session.tenantId);
      const User = getUserModel(connection);
      user = await User.findById(session.userId).select("+passwordHash");
    } else if (session.userType === "developer") {
      const connection = await connectMasterDB();
      const DeveloperUser = getDeveloperUserModel(connection);
      user = await DeveloperUser.findById(session.userId).select("+passwordHash");
    }

    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const isValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!isValid) {
      return Response.json({ error: "Current password is incorrect" }, { status: 400 });
    }

    user.passwordHash = await hashPassword(newPassword);
    user.passwordChangedAt = new Date();
    await user.save();

    return Response.json({
      message: "Password changed successfully. Please log in again.",
    });
  } catch (error) {
    return nextJsonError("Unable to change password", error, 500);
  }
}
