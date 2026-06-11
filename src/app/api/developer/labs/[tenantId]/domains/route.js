import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { nextJsonError } from "@/app/lib/api-response";
import { requireDeveloperSession } from "@/app/lib/auth";
import {
  createTenantDomain,
  getLabByIdOrTenantId,
  listTenantDomains,
  removeTenantDomain,
  setPrimaryTenantDomain,
  verifyTenantDomain,
} from "@/app/lib/domain-management";
import connectMasterDB from "@/app/lib/master-db";
import { normalizeCustomDomain } from "@/app/lib/domain-utils";

function serializeLab(lab, req) {
  const rootDomain = normalizeCustomDomain(process.env.ROOT_DOMAIN);
  const protocol = String(process.env.PUBLIC_APP_PROTOCOL || "https").replace(/:$/, "");
  const defaultDomain = rootDomain ? `${lab.tenantId}.${rootDomain}` : "";

  return {
    id: String(lab._id),
    name: lab.name,
    tenantId: lab.tenantId,
    defaultDomain,
    defaultUrl: defaultDomain ? `${protocol}://${defaultDomain}/` : "",
    cmsHost: new URL(req.url).host,
  };
}

async function getKnownLabsForDebug(masterConnection) {
  if (process.env.NODE_ENV === "production") return [];

  return masterConnection.db
    .collection("labs")
    .find({}, { projection: { _id: 1, tenantId: 1, labId: 1, name: 1, status: 1 } })
    .sort({ createdAt: -1 })
    .limit(10)
    .toArray()
    .then((labs) =>
      labs.map((lab) => ({
        id: String(lab._id),
        tenantId: lab.tenantId,
        labId: lab.labId,
        name: lab.name,
        status: lab.status,
      }))
    );
}

async function loadDomainPagePayload(req, params) {
  const { tenantId } = await params;
  const masterConnection = await connectMasterDB();
  const lab = await getLabByIdOrTenantId(masterConnection, tenantId);
  const dbName = masterConnection.db?.databaseName || "unknown";

  if (process.env.NODE_ENV !== "production") {
    console.log("[developer:domains] lab lookup", {
      tenantId,
      dbName,
      found: Boolean(lab),
      matchedTenantId: lab?.tenantId,
      labName: lab?.name,
    });
  }

  if (!lab) {
    const knownLabs = await getKnownLabsForDebug(masterConnection);
    return {
      error: NextResponse.json(
        {
          error: "Lab not found",
          ...(process.env.NODE_ENV !== "production"
            ? {
                details: `No lab matched "${tenantId}" in database "${dbName}"`,
                knownLabs,
              }
            : {}),
        },
        { status: 404 }
      ),
    };
  }

  if (lab.status === "archived") {
    return { error: NextResponse.json({ error: "This lab has been archived. Restore it before managing domains." }, { status: 403 }) };
  }

  const domains = await listTenantDomains(masterConnection, lab);
  return {
    masterConnection,
    lab,
    payload: {
      lab: serializeLab(lab, req),
      domains,
    },
  };
}

function resultResponse(result, payload, status = 200) {
  if (result?.error) {
    return NextResponse.json({ error: result.error }, { status: result.status || 400 });
  }

  return NextResponse.json(payload, { status: result?.status || status });
}

export async function GET(req, { params }) {
  try {
    const auth = requireDeveloperSession(req);
    if (auth.error) return auth.error;

    const page = await loadDomainPagePayload(req, params);
    if (page.error) return page.error;

    return NextResponse.json(page.payload);
  } catch (error) {
    return nextJsonError("Unable to load domains", error, 500);
  }
}

export async function POST(req, { params }) {
  try {
    const auth = requireDeveloperSession(req);
    if (auth.error) return auth.error;

    const page = await loadDomainPagePayload(req, params);
    if (page.error) return page.error;

    const body = await req.json();
    const result = await createTenantDomain(
      page.masterConnection,
      page.lab,
      body.domainName || body.domain,
      auth.session.userId
    );
    const domains = await listTenantDomains(page.masterConnection, page.lab);

    return resultResponse(result, { ...page.payload, domains }, 201);
  } catch (error) {
    return nextJsonError("Unable to add domain", error, error.status || 500);
  }
}

export async function PATCH(req, { params }) {
  try {
    const auth = requireDeveloperSession(req);
    if (auth.error) return auth.error;

    const page = await loadDomainPagePayload(req, params);
    if (page.error) return page.error;

    const body = await req.json();
    const action = String(body.action || "verify");
    const domain = body.domainName || body.domain;
    let result;

    if (action === "set-primary") {
      result = await setPrimaryTenantDomain(page.masterConnection, page.lab, domain);
    } else {
      result = await verifyTenantDomain(page.masterConnection, page.lab, domain);
    }

    const domains = await listTenantDomains(page.masterConnection, page.lab);
    return resultResponse(result, { ...page.payload, domains });
  } catch (error) {
    return nextJsonError("Unable to update domain", error, error.status || 500);
  }
}

export async function DELETE(req, { params }) {
  try {
    const auth = requireDeveloperSession(req);
    if (auth.error) return auth.error;

    const page = await loadDomainPagePayload(req, params);
    if (page.error) return page.error;

    const { searchParams } = new URL(req.url);
    const result = await removeTenantDomain(
      page.masterConnection,
      page.lab,
      searchParams.get("domain")
    );
    const domains = await listTenantDomains(page.masterConnection, page.lab);

    return resultResponse(result, { ...page.payload, domains });
  } catch (error) {
    return nextJsonError("Unable to remove domain", error, error.status || 500);
  }
}
