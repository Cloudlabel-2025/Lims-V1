import nodemailer from "nodemailer";

const MAX_RETRIES = 2;
const BASE_DELAY_MS = 2000;

function cleanEnv(name) {
  return String(process.env[name] || "").trim();
}

function cleanPassword(value) {
  return String(value || "").replace(/\s+/g, "").trim();
}

function getSmtpConfig() {
  return {
    host: cleanEnv("SMTP_HOST"),
    port: parseInt(cleanEnv("SMTP_PORT") || "587", 10),
    user: cleanEnv("SMTP_USER"),
    pass: cleanPassword(process.env.SMTP_PASS),
    from: cleanEnv("SMTP_FROM"),
  };
}

function createTransporter(config) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    requireTLS: true,
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 30000,
    auth: { user: config.user, pass: config.pass },
    tls: {
      minVersion: "TLSv1.2",
      rejectUnauthorized: false,
    },
  });
}

function isTransientError(error) {
  const code = (error.code || "").toUpperCase();
  const message = (error.message || "").toLowerCase();
  const transientCodes = ["ETIMEOUT", "ECONNRESET", "ECONNREFUSED", "EAI_AGAIN", "ENOTFOUND", "EPIPE"];
  const transientPhrases = ["timeout", "connection reset", "connection refused", "temporary", "try again", "throttl"];
  return transientCodes.includes(code) || transientPhrases.some((p) => message.includes(p));
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function sendMailWithRetry(transporterFn, mailOptions) {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const transporter = transporterFn();
      await transporter.sendMail(mailOptions);
      return { sent: true };
    } catch (error) {
      lastError = error;

      console.error(`[reset-email] Attempt ${attempt}/${MAX_RETRIES} failed:`, {
        code: error.code,
        message: error.message,
        response: error.response,
      });

      if (attempt < MAX_RETRIES && isTransientError(error)) {
        const backoffMs = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        console.log(`[reset-email] Retrying in ${backoffMs}ms...`);
        await delay(backoffMs);
        continue;
      }

      break;
    }
  }

  throw new Error(lastError?.message || "Unable to send reset email");
}

export async function sendPasswordResetEmail({ to, otp, expiresAt }) {
  const config = getSmtpConfig();

  if (!config.host || !config.user || !config.pass || !config.from) {
    if (process.env.NODE_ENV !== "production" || process.env.ALLOW_DEV_EMAIL_FALLBACK === "true") {
      console.log(`\n================ [DEV EMAIL FALLBACK] ================`);
      console.log(`[PASSWORD RESET EMAIL] To: ${to}`);
      console.log(`[PASSWORD RESET EMAIL] OTP: ${otp}`);
      console.log(`======================================================\n`);
      return { sent: true, devFallback: true };
    }

    return {
      sent: false,
      reason: "SMTP is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS, and SMTP_FROM in .env.local.",
    };
  }

  console.log("[reset-email] SMTP config:", {
    host: config.host,
    port: config.port,
    user: config.user ? config.user.substring(0, 3) + "***" : "(empty)",
    passLength: config.pass?.length || 0,
    from: config.from,
  });

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
    return await sendMailWithRetry(
      () => createTransporter(config),
      {
        from: config.from,
        to,
        subject: "Your LIMS password reset OTP",
        text: textBody,
        html: htmlBody,
      }
    );
  } catch (error) {
    console.error("[reset-email] Send failed:", {
      code: error.code,
      message: error.message,
      command: error.command,
      response: error.response,
      to,
    });
    return { sent: false, reason: error.message || "Unable to send password reset email" };
  }
}

export async function sendDoctorInvitationEmail({ to, doctorName, labName, otp, expiresAt, activationUrl }) {
  const config = getSmtpConfig();
  const safeName = doctorName || "Doctor";
  const safeLab = labName || "your laboratory";

  if (!config.host || !config.user || !config.pass || !config.from) {
    if (process.env.NODE_ENV !== "production" || process.env.ALLOW_DEV_EMAIL_FALLBACK === "true") {
      console.log(`\n================ [DEV EMAIL FALLBACK] ================`);
      console.log(`[DOCTOR INVITATION EMAIL] To: ${to}`);
      console.log(`[DOCTOR INVITATION EMAIL] Doctor: ${safeName} (${safeLab})`);
      console.log(`[DOCTOR INVITATION EMAIL] OTP: ${otp}`);
      console.log(`[DOCTOR INVITATION EMAIL] Activation URL: ${activationUrl}`);
      console.log(`======================================================\n`);
      return { sent: true, devFallback: true };
    }

    return { sent: false, reason: "SMTP is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS, and SMTP_FROM in .env.local." };
  }

  console.log("[reset-email] SMTP config:", {
    host: config.host,
    port: config.port,
    user: config.user ? config.user.substring(0, 3) + "***" : "(empty)",
    passLength: config.pass?.length || 0,
    from: config.from,
  });

  const expiresText = expiresAt.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });
  const textBody = [
    `Hello ${safeName},`,
    "",
    `${safeLab} created your doctor portal account.`,
    `Activation OTP: ${otp}`,
    `Activate your account: ${activationUrl}`,
    `This invitation expires at ${expiresText}.`,
    "",
    "Do not share this OTP. If you were not expecting this invitation, contact the laboratory.",
  ].join("\n");
  const htmlBody = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#172033;max-width:600px;margin:auto">
      <h2 style="margin:0 0 12px">Welcome to ${safeLab}</h2>
      <p>Hello <strong>${safeName}</strong>, your doctor portal account is ready.</p>
      <div style="margin:20px 0;text-align:center">
        <span style="display:inline-block;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:10px;padding:14px 32px;font-size:32px;font-weight:700;letter-spacing:10px;color:#0d9488">${otp}</span>
      </div>
      <p style="text-align:center"><a href="${activationUrl}" style="display:inline-block;background:#0d9488;color:white;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:700">Activate doctor portal</a></p>
      <p>This invitation expires at <strong>${expiresText}</strong>. Do not share the OTP.</p>
      <p>If you were not expecting this invitation, contact the laboratory.</p>
    </div>`;

  try {
    return await sendMailWithRetry(() => createTransporter(config), {
      from: config.from,
      to,
      subject: `${safeLab} doctor portal invitation`,
      text: textBody,
      html: htmlBody,
    });
  } catch (error) {
    console.error("[reset-email] Send failed:", {
      code: error.code,
      message: error.message,
      command: error.command,
      response: error.response,
      to,
    });
    return { sent: false, reason: error.message || "Unable to send invitation email" };
  }
}
