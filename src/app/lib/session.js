import crypto from "node:crypto";

const sessionCookieName = "lims_session";

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function base64UrlDecode(value) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  return Buffer.from(padded, "base64").toString("utf8");
}

function isBase64UrlPart(value) {
  return typeof value === "string" && /^[A-Za-z0-9_-]+$/.test(value);
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function isValidSessionPayload(payload) {
  if (!payload || typeof payload !== "object") return false;
  if (!["tenant", "developer"].includes(payload.userType)) return false;
  if (!payload.userId || typeof payload.userId !== "string") return false;
  if (!payload.email || typeof payload.email !== "string") return false;

  if (payload.userType === "tenant" && !payload.tenantId) return false;
  if (payload.exp !== undefined && !Number.isFinite(payload.exp)) return false;
  if (payload.iat !== undefined && !Number.isFinite(payload.iat)) return false;

  return true;
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 24) {
    throw new Error("JWT_SECRET must be at least 24 characters long");
  }

  return secret;
}

export function createSessionToken(payload, expiresInSeconds = 60 * 60 * 8) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const body = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedBody = base64UrlEncode(JSON.stringify(body));
  const data = `${encodedHeader}.${encodedBody}`;
  const signature = crypto.createHmac("sha256", getJwtSecret()).update(data).digest("base64url");

  return `${data}.${signature}`;
}

export function verifySessionToken(token) {
  if (!token || typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedBody, signature] = parts;
  if (
    !isBase64UrlPart(encodedHeader) ||
    !isBase64UrlPart(encodedBody) ||
    !isBase64UrlPart(signature)
  ) {
    return null;
  }

  const data = `${encodedHeader}.${encodedBody}`;
  const expectedSignature = crypto
    .createHmac("sha256", getJwtSecret())
    .update(data)
    .digest("base64url");

  const signatureBuffer = Buffer.from(signature, "base64url");
  const expectedBuffer = Buffer.from(expectedSignature, "base64url");

  try {
    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      return null;
    }
  } catch {
    return null;
  }

  const header = safeJsonParse(base64UrlDecode(encodedHeader));
  if (header?.alg !== "HS256" || header?.typ !== "JWT") {
    return null;
  }

  const payload = safeJsonParse(base64UrlDecode(encodedBody));
  if (!isValidSessionPayload(payload)) {
    return null;
  }

  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return payload;
}

function isSecure(req) {
  if (process.env.NODE_ENV === "production") return true;
  if (req?.headers?.get("x-forwarded-proto") === "https") return true;
  return false;
}

export function setSessionCookie(response, token, rememberMe = false, req) {
  response.cookies.set(sessionCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecure(req),
    path: "/",
    maxAge: rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 8,
  });
}

export function clearSessionCookie(response, req) {
  response.cookies.set(sessionCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecure(req),
    path: "/",
    maxAge: 0,
  });
}

export function getSessionCookieName() {
  return sessionCookieName;
}
