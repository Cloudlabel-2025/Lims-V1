import { NextResponse } from "next/server";
import { getTenantConfig } from "@/app/lib/tenant-cache";
import { normalizeTenantId } from "@/app/lib/tenant-resolver";

function getLookupSecret() {
  if (process.env.TENANT_LOOKUP_SECRET) return process.env.TENANT_LOOKUP_SECRET;
  if (process.env.NODE_ENV !== "production") return "dev-tenant-lookup-secret";
  return "";
}

export async function GET(req) {
  const expectedSecret = getLookupSecret();
  const receivedSecret =
    req.headers.get("x-tenant-secret") || req.headers.get("x-internal-tenant-lookup-secret");

  if (!expectedSecret || receivedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const tenantId = normalizeTenantId(searchParams.get("subdomain") || searchParams.get("tenantId"));
    const tenant = await getTenantConfig(tenantId);

    if (!tenant) {
      return NextResponse.json({ error: "Unknown tenant" }, { status: 404 });
    }

    if (tenant.status === "suspended") {
      return NextResponse.json(
        {
          error: "Tenant is suspended",
          tenantId: tenant.tenantId,
          status: tenant.status,
        },
        { status: 423 }
      );
    }

    if (tenant.status !== "active") {
      return NextResponse.json(
        {
          error: "Tenant is not active",
          tenantId: tenant.tenantId,
          status: tenant.status,
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      tenant: {
        tenantId: tenant.tenantId,
        labId: tenant.labId,
        name: tenant.name,
        status: tenant.status,
        enabledModules: tenant.enabledModules,
      },
    });
  } catch {
    return NextResponse.json({ error: "Invalid tenant" }, { status: 404 });
  }
}
