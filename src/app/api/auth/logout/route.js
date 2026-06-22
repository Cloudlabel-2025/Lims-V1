import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/app/lib/session";
import { getSessionFromRequest } from "@/app/lib/auth";
import { buildTenantUrl } from "@/app/lib/subdomain";
import { writeAuditLog } from "@/app/lib/audit";

export async function POST(req) {
  const session = getSessionFromRequest(req);

  if (session?.userType === "tenant" && session.tenantId) {
    writeAuditLog(req, { tenantId: session.tenantId, session }, {
      action: "logout",
      resourceType: "user",
      resourceId: session.userId,
    });
  }

  const redirectUrl =
    session?.userType === "tenant" && session.tenantId
      ? buildTenantUrl(session.tenantId, req.url)
      : "/";
  const response = NextResponse.json({ message: "Logged out", redirectUrl });
  clearSessionCookie(response, req);
  return response;
}
