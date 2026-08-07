import { requireTenantSession } from "@/app/lib/auth";
import { getTenantModels } from "@/app/lib/tenant-db";
import { getNextAvailableUserId } from "@/app/models/tenant/User";
import { createDoctorInvitation } from "@/app/lib/doctor-invitation";
import { sendDoctorInvitationEmail } from "@/app/lib/reset-email";
import { buildTenantUrl } from "@/app/lib/subdomain";
import { getTenantConfig } from "@/app/lib/tenant-cache";
import { writeAuditLog } from "@/app/lib/audit";

export async function POST(req, { params }) {
  try {
    console.log("[resend-invitation] Step 1: Authenticating...");
    const auth = requireTenantSession(req, "users.manage");
    if (auth.error) return auth.error;

    const { id } = await params;
    console.log("[resend-invitation] Step 2: Doctor ID =", id);

    console.log("[resend-invitation] Step 3: Getting tenant models...");
    const { Doctor, User } = await getTenantModels(auth.tenantId);

    console.log("[resend-invitation] Step 4: Finding doctor...");
    const doctor = await Doctor.findById(id).select("name email status").lean();
    if (!doctor) {
      console.log("[resend-invitation] Doctor not found for id:", id);
      return Response.json({ error: "Doctor not found" }, { status: 404 });
    }
    console.log("[resend-invitation] Step 5: Doctor found:", doctor.name, "status:", doctor.status);

    let user = await User.findOne({ doctorId: doctor._id })
      .select("userId email status +passwordResetTokenHash +passwordResetExpiresAt");

    const invitation = createDoctorInvitation();

    if (!user) {
      if (!doctor.email) {
        return Response.json({ error: "Doctor email is required to create a portal account" }, { status: 400 });
      }

      const { Role } = await getTenantModels(auth.tenantId);
      let doctorRole = await Role.findOne({ name: "Doctor" });
      if (!doctorRole) {
        doctorRole = await Role.create({
          name: "Doctor",
          description: "Referring doctor with access to portal and test orders.",
          permissions: ["doctor-portal.access"],
          isSystemRole: true,
        });
      }

      const nameParts = String(doctor.name || "").trim().split(/\s+/);
      const firstName = nameParts[0] || "Doctor";
      const lastName = nameParts.slice(1).join(" ") || "Partner";
      const nextUserId = await getNextAvailableUserId(User);

      user = new User({
        userId: nextUserId,
        firstName,
        lastName,
        email: doctor.email,
        role: doctorRole._id,
        status: "invited",
        doctorId: doctor._id,
        createdBy: auth.session.userId,
      });
    } else {
      if (doctor.email && user.email !== doctor.email) {
        user.email = doctor.email;
      }

      if (user.status === "active") {
        return Response.json({ error: "This portal account is already active" }, { status: 409 });
      }
    }

    if (doctor.status !== "Active") {
      return Response.json({ error: "Activate the doctor profile before sending an invitation" }, { status: 409 });
    }

    console.log("[resend-invitation] Step 8: Creating invitation OTP...");
    user.passwordResetTokenHash = invitation.otpHash;
    user.passwordResetExpiresAt = invitation.expiresAt;
    user.status = "invited";

    console.log("[resend-invitation] Step 9: Saving user...");
    await user.save();
    console.log("[resend-invitation] Step 10: User saved successfully");

    console.log("[resend-invitation] Step 11: Getting lab config...");
    const lab = await getTenantConfig(auth.tenantId);

    const path = `/activate-account?tenantId=${encodeURIComponent(auth.tenantId)}&email=${encodeURIComponent(user.email)}`;
    const activationUrl = buildTenantUrl(auth.tenantId, req.url, path);
    console.log("[resend-invitation] Step 12: Sending email to:", user.email);

    const result = await sendDoctorInvitationEmail({
      to: user.email,
      doctorName: doctor.name,
      labName: lab?.name,
      otp: invitation.otp,
      expiresAt: invitation.expiresAt,
      activationUrl,
    });
    console.log("[resend-invitation] Step 13: Email result:", JSON.stringify(result));

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
    console.error("[resend-invitation] FATAL ERROR:", error.message);
    console.error("[resend-invitation] Stack:", error.stack);
    return Response.json(
      { error: "Unable to resend doctor invitation", details: error.message, name: error.name },
      { status: 500 }
    );
  }
}
