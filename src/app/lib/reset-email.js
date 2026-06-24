import nodemailer from "nodemailer";

function cleanEnv(name) {
  return String(process.env[name] || "").trim();
}

function getSmtpConfig() {
  return {
    host: cleanEnv("SMTP_HOST"),
    port: parseInt(cleanEnv("SMTP_PORT") || "587", 10),
    user: cleanEnv("SMTP_USER"),
    pass: cleanEnv("SMTP_PASS"),
    from: cleanEnv("SMTP_FROM"),
  };
}

let transporter = null;

function getTransporter(config) {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: { user: config.user, pass: config.pass },
  });
  return transporter;
}

export async function sendPasswordResetEmail({ to, otp, expiresAt }) {
  const config = getSmtpConfig();

  if (!config.host || !config.user || !config.pass || !config.from) {
    return {
      sent: false,
      reason: "SMTP is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS, and SMTP_FROM.",
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
    </div>`;

  try {
    await getTransporter(config).sendMail({
      from: config.from,
      to,
      subject: "Your LIMS password reset OTP",
      text: textBody,
      html: htmlBody,
    });
    return { sent: true };
  } catch (error) {
    throw new Error(error.message || "Unable to send reset email");
  }
}
