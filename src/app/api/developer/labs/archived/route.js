import { nextJsonError } from "@/app/lib/api-response";
import { NextResponse } from "next/server";
import { requireDeveloperSession } from "@/app/lib/auth";
import connectMasterDB from "@/app/lib/master-db";
import { getLabModel } from "@/app/models/master/Lab";
import { clearTenantConfigCache, warmTenantConfigCache } from "@/app/lib/tenant-cache";
import { buildTenantUrl } from "@/app/lib/subdomain";
import { defaultLabModules } from "@/app/lib/modules";

function buildLoginUrl(req, tenantId) {
  return buildTenantUrl(tenantId, req.url);
}

function serializeArchivedLab(lab, req) {
  return {
    id: String(lab._id),
    labId: lab.labId,
    name: lab.name,
    tenantId: lab.tenantId,
    dbName: lab.dbName,
    status: lab.status,
    subscriptionPlan: lab.subscriptionPlan,
    contactEmail: lab.contactEmail || "",
    contactPhone: lab.contactPhone || "",
    adminEmail: lab.adminAccess?.email || "",
    enabledModules: lab.enabledModules?.length ? lab.enabledModules : defaultLabModules,
    primaryColor: lab.branding?.primaryColor || "#0d9488",
    logoUrl: lab.branding?.logo?.url || null,
    loginUrl: buildLoginUrl(req, lab.tenantId),
    createdAt: lab.createdAt,
    archivedAt: lab.archivedAt,
  };
}

// GET  /api/developer/labs/archived  — list all archived labs
export async function GET(req) {
  try {
    const auth = requireDeveloperSession(req);
    if (auth.error) return auth.error;

    const masterConnection = await connectMasterDB();
    const Lab = getLabModel(masterConnection);

    const labs = await Lab.find({ status: "archived" })
      .sort({ archivedAt: -1 })
      .select({
        labId: 1,
        name: 1,
        tenantId: 1,
        dbName: 1,
        status: 1,
        subscriptionPlan: 1,
        contactEmail: 1,
        contactPhone: 1,
        "adminAccess.email": 1,
        branding: 1,
        enabledModules: 1,
        createdAt: 1,
        archivedAt: 1,
      })
      .lean();

    return NextResponse.json({ labs: labs.map((lab) => serializeArchivedLab(lab, req)) });
  } catch (error) {
    return nextJsonError("Unable to load archived labs", error, 500);
  }
}

// POST /api/developer/labs/archived  — restore an archived lab
// body: { tenantId: "my-lab" }
export async function POST(req) {
  try {
    const auth = requireDeveloperSession(req);
    if (auth.error) return auth.error;

    const body = await req.json();
    const tenantId = String(body.tenantId || "").trim().toLowerCase();

    if (!tenantId) {
      return NextResponse.json({ error: "tenantId is required" }, { status: 400 });
    }

    const masterConnection = await connectMasterDB();
    const Lab = getLabModel(masterConnection);
    const lab = await Lab.findOne({ tenantId, status: "archived" });

    if (!lab) {
      return NextResponse.json(
        { error: "Archived lab not found" },
        { status: 404 }
      );
    }

    lab.status = "active";
    lab.archivedAt = undefined;
    lab.archivedBy = undefined;
    await lab.save();

    clearTenantConfigCache(tenantId);
    warmTenantConfigCache({
      id: String(lab._id),
      labId: lab.labId,
      tenantId: lab.tenantId,
      name: lab.name,
      status: "active",
      dbName: lab.dbName,
      dbConnectionString: lab.dbConnectionString,
      subscriptionPlan: lab.subscriptionPlan,
      enabledModules: lab.enabledModules?.length ? lab.enabledModules : defaultLabModules,
      branding: lab.branding || {},
    });

    return NextResponse.json({
      ok: true,
      lab: serializeArchivedLab(lab, req),
    });
  } catch (error) {
    return nextJsonError("Unable to restore lab", error, 500);
  }
}
