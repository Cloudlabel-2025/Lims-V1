import { NextResponse } from "next/server";
import { normalizeTenantId } from "@/app/lib/tenant-resolver";
import { getTenantModels } from "@/app/lib/tenant-db";
import { hashPatientActivationToken } from "@/app/lib/patient-portal";
import { createPatientSessionToken, setPatientSessionCookie } from "@/app/lib/patient-session";
import { jsonError } from "@/app/lib/api-response";
import { getLabSubscriptionEntitlements } from "@/app/lib/subscription-service";
import { hasPatientPortalEntitlement } from "@/app/lib/portal-policy";

export async function POST(req) {
  try {
    const body = await req.json();
    const tenantId = normalizeTenantId(body.tenantId);
    const token = String(body.token || "").trim();

    if (!token) {
      return Response.json({ error: "Access token is required" }, { status: 400 });
    }

    const subscription = await getLabSubscriptionEntitlements(tenantId);
    if (!hasPatientPortalEntitlement(subscription)) {
      return Response.json({
        error: "Patient Portal access is not enabled in your laboratory's active subscription package. Contact your laboratory administrator to enable Patient Portal.",
      }, { status: 403 });
    }

    const tokenHash = hashPatientActivationToken(token);
    const { Patient, PatientPortalAccount } = await getTenantModels(tenantId);

    const account = await PatientPortalAccount.findOne({ activationTokenHash: tokenHash })
      .select("+activationTokenHash +activationExpiresAt status patient credentialVersion");

    if (!account) {
      return Response.json({ error: "Invalid or expired WhatsApp login link." }, { status: 401 });
    }

    if (account.status === "disabled") {
      return Response.json({ error: "Patient Portal access is disabled for this account." }, { status: 403 });
    }

    const patient = await Patient.findById(account.patient).select("name phone patientId").lean();
    if (!patient) {
      return Response.json({ error: "Patient record not found." }, { status: 404 });
    }

    // Activate and sign in
    account.status = "active";
    account.activatedAt = account.activatedAt || new Date();
    account.lastLoginAt = new Date();
    await account.save();

    const sessionToken = createPatientSessionToken({
      tenantId,
      patientId: String(patient._id),
      accountId: String(account._id),
      credentialVersion: account.credentialVersion,
    });

    const response = NextResponse.json({
      success: true,
      message: "WhatsApp 1-click sign in successful",
      patient: {
        name: patient.name,
        patientId: patient.patientId,
      },
    });

    setPatientSessionCookie(response, sessionToken, req);
    return response;
  } catch (error) {
    if (error?.message === "Invalid tenant identifier") return Response.json({ error: "Invalid lab" }, { status: 400 });
    return jsonError("Unable to process token login", error, 500);
  }
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = normalizeTenantId(searchParams.get("tenantId"));
    const token = String(searchParams.get("token") || "").trim();

    if (!token) {
      return Response.redirect(new URL("/patient?error=missing_token", req.url));
    }

    const subscription = await getLabSubscriptionEntitlements(tenantId);
    if (!hasPatientPortalEntitlement(subscription)) {
      return Response.redirect(new URL("/patient?error=portal_disabled", req.url));
    }

    const tokenHash = hashPatientActivationToken(token);
    const { Patient, PatientPortalAccount } = await getTenantModels(tenantId);

    const account = await PatientPortalAccount.findOne({ activationTokenHash: tokenHash })
      .select("+activationTokenHash +activationExpiresAt status patient credentialVersion");

    if (!account) {
      return Response.redirect(new URL("/patient?error=invalid_token", req.url));
    }

    const patient = await Patient.findById(account.patient).select("name phone patientId").lean();
    if (!patient) {
      return Response.redirect(new URL("/patient?error=patient_not_found", req.url));
    }

    account.status = "active";
    account.activatedAt = account.activatedAt || new Date();
    account.lastLoginAt = new Date();
    await account.save();

    const sessionToken = createPatientSessionToken({
      tenantId,
      patientId: String(patient._id),
      accountId: String(account._id),
      credentialVersion: account.credentialVersion,
    });

    const redirectUrl = new URL(`/patient/portal?tenantId=${encodeURIComponent(tenantId)}`, req.url);
    const response = NextResponse.redirect(redirectUrl);
    setPatientSessionCookie(response, sessionToken, req);
    return response;
  } catch (error) {
    return Response.redirect(new URL("/patient?error=server_error", req.url));
  }
}
