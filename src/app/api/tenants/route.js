import { NextResponse } from "next/server";
import { requireDeveloperSession } from "@/app/lib/auth";
import { buildTenantUrl, slugifySubdomain, validateSubdomain } from "@/app/lib/subdomain";
import {
  createTenant,
  getAvailableSubdomain,
  isSubdomainAvailable,
} from "@/app/lib/tenant-provisioning";

export async function GET(req) {
  const auth = requireDeveloperSession(req);
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(req.url);
    const requestedSubdomain = searchParams.get("subdomain");
    const seedName = searchParams.get("name");
    const subdomain = requestedSubdomain
      ? slugifySubdomain(requestedSubdomain)
      : slugifySubdomain(seedName);
    const validation = validateSubdomain(subdomain);

    if (!validation.valid) {
      return NextResponse.json({
        available: false,
        valid: false,
        subdomain,
        error: validation.error,
      });
    }

    const available = await isSubdomainAvailable(validation.subdomain);
    const suggestion = available
      ? validation.subdomain
      : await getAvailableSubdomain(validation.subdomain);

    return NextResponse.json({
      available,
      valid: true,
      subdomain: validation.subdomain,
      suggestion,
      url: buildTenantUrl(suggestion, req.url),
    });
  } catch (error) {
    return NextResponse.json(
      { available: false, valid: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  const auth = requireDeveloperSession(req);
  if (auth.error) return auth.error;

  try {
    const body = await req.json();
    const name = String(body.name || "").trim();
    const subdomain = slugifySubdomain(body.subdomain || name);
    const validation = validateSubdomain(subdomain);

    if (!name || name.length < 2) {
      return NextResponse.json({ error: "Lab name is required" }, { status: 400 });
    }

    if (!validation.valid) {
      return NextResponse.json({ error: validation.error, subdomain }, { status: 400 });
    }

    const lab = await createTenant({
      name,
      subdomain: validation.subdomain,
      createdBy: auth.session.userId,
    });

    return NextResponse.json(
      {
        tenant_id: lab.tenantId,
        lab_id: lab.labId,
        name: lab.name,
        status: lab.status,
        url: buildTenantUrl(lab.tenantId, req.url),
      },
      { status: 201 }
    );
  } catch (error) {
    if (error.code === "SUBDOMAIN_TAKEN") {
      return NextResponse.json(
        {
          error: "Subdomain is already taken",
          suggestion: error.suggestion,
          url: buildTenantUrl(error.suggestion, req.url),
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Unable to create tenant", details: error.message },
      { status: 500 }
    );
  }
}
