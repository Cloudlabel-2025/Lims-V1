function cleanEnv(name) {
  return String(process.env[name] || "").trim();
}

function getResendConfig() {
  return {
    apiKey: cleanEnv("RESEND_API_KEY"),
    from: cleanEnv("RESET_EMAIL_FROM") || cleanEnv("EMAIL_FROM"),
    replyTo: cleanEnv("RESET_EMAIL_REPLY_TO") || cleanEnv("EMAIL_REPLY_TO"),
  };
}

export async function sendPasswordResetEmail({ to, otp, expiresAt }) {
  const { apiKey, from, replyTo } = getResendConfig();

  if (!apiKey || !from) {
    return {
      sent: false,
      reason: "Password reset email is not configured.",
    };
  }

  const expiresText = expiresAt.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      reply_to: replyTo || undefined,
      subject: "Your LIMS password reset OTP",
      text: [
        "We received a request to reset your LIMS password.",
        "",
        `Your OTP: ${otp}`,
        `This OTP expires at ${expiresText}. Do not share it with anyone.`,
        "",
        "If you did not request this, you can ignore this email.",
      ].join("\n"),
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#172033">
          <h2 style="margin:0 0 12px">Reset your LIMS password</h2>
          <p>We received a request to reset your password. Use the OTP below:</p>
          <div style="margin:20px 0;text-align:center">
            <span style="display:inline-block;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:10px;padding:14px 32px;font-size:32px;font-weight:700;letter-spacing:10px;color:#0d9488">${otp}</span>
          </div>
          <p>This OTP expires at <strong>${expiresText}</strong>. Do not share it with anyone.</p>
          <p>If you did not request this, you can ignore this email.</p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Unable to send reset email");
  }

  return { sent: true };
}
