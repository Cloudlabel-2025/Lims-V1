function cleanEnv(name) {
  return String(process.env[name] || "").trim();
}

function getPublicBaseUrl(req) {
  const configured =
    cleanEnv("PASSWORD_RESET_BASE_URL") ||
    cleanEnv("PUBLIC_APP_URL") ||
    cleanEnv("NEXT_PUBLIC_APP_URL");

  if (configured) return configured.replace(/\/+$/, "");

  const requestUrl = new URL(req.url);
  return requestUrl.origin;
}

export function buildPasswordResetUrl(req, { token, userType, tenantId }) {
  const resetUrl = new URL("/reset-password", getPublicBaseUrl(req));
  resetUrl.searchParams.set("token", token);
  resetUrl.searchParams.set("userType", userType);

  if (tenantId) {
    resetUrl.searchParams.set("tenantId", tenantId);
  }

  return resetUrl.toString();
}

function getResendConfig() {
  return {
    apiKey: cleanEnv("RESEND_API_KEY"),
    from: cleanEnv("RESET_EMAIL_FROM") || cleanEnv("EMAIL_FROM"),
    replyTo: cleanEnv("RESET_EMAIL_REPLY_TO") || cleanEnv("EMAIL_REPLY_TO"),
  };
}

export async function sendPasswordResetEmail({ to, resetUrl, expiresAt }) {
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
      subject: "Reset your LIMS password",
      text: [
        "We received a request to reset your LIMS password.",
        "",
        `Reset link: ${resetUrl}`,
        `This link expires at ${expiresText}.`,
        "",
        "If you did not request this, you can ignore this email.",
      ].join("\n"),
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#172033">
          <h2 style="margin:0 0 12px">Reset your LIMS password</h2>
          <p>We received a request to reset your password.</p>
          <p>
            <a href="${resetUrl}" style="display:inline-block;background:#0d9488;color:#ffffff;padding:10px 14px;border-radius:6px;text-decoration:none">
              Reset password
            </a>
          </p>
          <p>This link expires at ${expiresText}.</p>
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
