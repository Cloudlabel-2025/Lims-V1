const RESEND_API = "https://api.resend.com/emails";

export async function sendPasswordResetEmail({ to, otp, expiresAt }) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from =
    process.env.RESET_EMAIL_FROM?.trim() ||
    process.env.RESEND_FROM?.trim() ||
    "LIMS <noreply@yourdomain.com>";

  if (!apiKey) {
    return {
      sent: false,
      reason: "Resend is not configured. Set RESEND_API_KEY.",
    };
  }

  const expiresText = expiresAt.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });

  const textBody = [
    "We received a request to reset your LIMS password.",
    "",
    `Your OTP: ${otp}`,
    `This OTP expires at ${expiresText}. Do not share it with anyone.`,
    "",
    "If you did not request this, you can ignore this email.",
  ].join("\n");

  const htmlBody = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#172033">
      <h2 style="margin:0 0 12px">Reset your LIMS password</h2>
      <p>We received a request to reset your password. Use the OTP below:</p>
      <div style="margin:20px 0;text-align:center">
        <span style="display:inline-block;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:10px;padding:14px 32px;font-size:32px;font-weight:700;letter-spacing:10px;color:#0d9488">${otp}</span>
      </div>
      <p>This OTP expires at <strong>${expiresText}</strong>. Do not share it with anyone.</p>
      <p>If you did not request this, you can ignore this email.</p>
    </div>
  `;

  try {
    const response = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject: "Your LIMS password reset OTP",
        text: textBody,
        html: htmlBody,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.message || `Resend API error: ${response.status}`);
    }

    return { sent: true };
  } catch (error) {
    throw new Error(error.message || "Unable to send reset email");
  }
}
