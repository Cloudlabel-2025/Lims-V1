import { requireTenantSession } from "@/app/lib/auth";
import { getTenantModels } from "@/app/lib/tenant-db";
import { createDoctorInvitation } from "@/app/lib/doctor-invitation";
import { sendDoctorInvitationEmail } from "@/app/lib/reset-email";
import { buildTenantUrl } from "@/app/lib/subdomain";
import { getTenantConfig } from "@/app/lib/tenant-cache";
import { writeAuditLog } from "@/app/lib/audit";
import { jsonError } from "@/app/lib/api-response";

export async function POST(req, { params }) {
  try {
    const auth = requireTenantSession(req, "users.manage");
    if (auth.error) return auth.error;
    const { id } = await params;
    const { Doctor, User } = await getTenantModels(auth.tenantId);
    const doctor = await Doctor.findById(id).select("name email status").lean();
    if (!doctor) return Response.json({ error: "Doctor not found" }, { status: 404 });

    const user = await User.findOne({ doctorId: doctor._id })
      .select("email status +passwordResetTokenHash +passwordResetExpiresAt");
    if (!user) return Response.json({ error: "No linked portal account found" }, { status: 404 });
    if (user.status === "active") {
      return Response.json({ error: "This portal account is already active" }, { status: 409 });
    }
    if (doctor.status !== "Active") {
      return Response.json({ error: "Activate the doctor profile before sending an invitation" }, { status: 409 });
    }

    const invitation = createDoctorInvitation();
    user.passwordResetTokenHash = invitation.otpHash;
    user.passwordResetExpiresAt = invitation.expiresAt;
    user.status = "invited";
    await user.save();

    const lab = await getTenantConfig(auth.tenantId);
    const path = `/activate-account?tenantId=${encodeURIComponent(auth.tenantId)}&email=${encodeURIComponent(user.email)}`;
    const activationUrl = buildTenantUrl(auth.tenantId, req.url, path);
    const result = await sendDoctorInvitationEmail({
      to: user.email,
      doctorName: doctor.name,
      labName: lab?.name,
      otp: invitation.otp,
      expiresAt: invitation.expiresAt,
      activationUrl,
    });
    if (!result?.sent) {
      return Response.json({ error: result?.reason || "Unable to send invitation email" }, { status: 502 });
    }

    await writeAuditLog(req, auth, {
      action: "doctor.invitation_resent",
      resourceType: "Doctor",
      resourceId: doctor._id,
      metadata: { email: user.email },
    });
    return Response.json({ message: `Invitation sent to ${user.email}` });
  } catch (error) {
    return jsonError("Unable to resend doctor invitation", error, 500);
  }
}
