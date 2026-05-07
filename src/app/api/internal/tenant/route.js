import { NextResponse } from "next/server";
import { getTenantConfig } from "@/app/lib/tenant-cache";
import { normalizeTenantId } from "@/app/lib/tenant-resolver";

function getTenantLookupSecret() {
  if (process.env.TENANT_LOOKUP_SECRET) return process.env.TENANT_LOOKUP_SECRET;
  if (process.env.NODE_ENV !== "production") return "dev-tenant-lookup-secret";
  return "";
}

function publicTenantPayload(tenant) {
  return {
    tenant_id: tenant.tenantId,
    subdomain: tenant.tenantId,
    lab_id: tenant.labId,
    name: tenant.name,
    status: tenant.status,
    enabledModules: tenant.enabledModules || [],
  };
}

export async function GET(req) {
  const expectedSecret = getTenantLookupSecret();
  const receivedSecret = req.headers.get("x-tenant-secret");

  if (!expectedSecret || receivedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const subdomain = normalizeTenantId(searchParams.get("subdomain"));
    const tenant = await getTenantConfig(subdomain);

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    if (tenant.status === "suspended") {
      return NextResponse.json(
        { error: "Tenant is suspended", tenant: publicTenantPayload(tenant) },
        { status: 423 }
      );
    }

    if (tenant.status !== "active") {
      return NextResponse.json(
        { error: "Tenant is not active", tenant: publicTenantPayload(tenant) },
        { status: 403 }
      );
    }

    return NextResponse.json({ tenant: publicTenantPayload(tenant) });
  } catch {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }
}
