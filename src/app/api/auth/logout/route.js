import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/app/lib/session";
import { getSessionFromRequest } from "@/app/lib/auth";
import { buildTenantUrl } from "@/app/lib/subdomain";

export async function POST(req) {
  const session = getSessionFromRequest(req);
  const redirectUrl =
    session?.userType === "tenant" && session.tenantId
      ? buildTenantUrl(session.tenantId, req.url)
      : "/";
  const response = NextResponse.json({ message: "Logged out", redirectUrl });
  clearSessionCookie(response);
  return response;
}
