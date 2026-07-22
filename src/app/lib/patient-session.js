import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getTenantModels } from "@/app/lib/tenant-db";

const COOKIE_NAME = "lims_patient_session";
const MAX_AGE = 60 * 60 * 24 * 30;

function secret() {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 24) throw new Error("JWT_SECRET must be at least 24 characters long");
  return value;
}

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function decode(value) {
  try { return JSON.parse(Buffer.from(value, "base64url").toString("utf8")); } catch { return null; }
}

function secure(req) {
  return process.env.NODE_ENV === "production" || req?.headers?.get("x-forwarded-proto") === "https";
}

export function createPatientSessionToken(payload) {
  const now = Math.floor(Date.now() / 1000);
  const body = encode({ ...payload, scope: "patient-portal", iat: now, exp: now + MAX_AGE });
  const signature = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function readPatientSession(req) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  const a = Buffer.from(signature, "base64url");
  const b = Buffer.from(expected, "base64url");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const payload = decode(body);
  if (!payload || payload.scope !== "patient-portal" || !payload.patientId || !payload.tenantId || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export function setPatientSessionCookie(response, token, req) {
  response.cookies.set(COOKIE_NAME, token, { httpOnly: true, sameSite: "lax", secure: secure(req), path: "/", maxAge: MAX_AGE });
}

export function clearPatientSessionCookie(response, req) {
  response.cookies.set(COOKIE_NAME, "", { httpOnly: true, sameSite: "lax", secure: secure(req), path: "/", maxAge: 0 });
}

export async function requirePatientSession(req) {
  const session = readPatientSession(req);
  if (!session) return { error: NextResponse.json({ error: "Patient sign-in required" }, { status: 401 }) };
  const { PatientPortalAccount } = await getTenantModels(session.tenantId);
  const account = await PatientPortalAccount.findById(session.accountId).select("status patient credentialVersion").lean();
  if (!account || account.status !== "active" || String(account.patient) !== session.patientId || account.credentialVersion !== session.credentialVersion) {
    const response = NextResponse.json({ error: "Patient session has expired" }, { status: 401 });
    clearPatientSessionCookie(response, req);
    return { error: response };
  }
  return { session, account };
}
