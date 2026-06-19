import { nextJsonError } from "@/app/lib/api-response";
import { NextResponse } from "next/server";
import { requireDeveloperSession } from "@/app/lib/auth";
import connectMasterDB from "@/app/lib/master-db";
import { getLabModel } from "@/app/models/master/Lab";
import { buildTenantUrl } from "@/app/lib/subdomain";
import { defaultLabModules } from "@/app/lib/modules";

function serializeDeletedLab(lab, req) {
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
    loginUrl: buildTenantUrl(lab.tenantId, req.url),
    createdAt: lab.createdAt,
    archivedAt: lab.archivedAt,
    deletedAt: lab.deletedAt,
  };
}

// GET /api/developer/labs/deleted — list deleted labs without restore actions
export async function GET(req) {
  try {
    const auth = requireDeveloperSession(req);
    if (auth.error) return auth.error;

    const masterConnection = await connectMasterDB();
    const Lab = getLabModel(masterConnection);

    const labs = await Lab.find({ status: "deleted" })
      .sort({ deletedAt: -1, updatedAt: -1 })
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
        deletedAt: 1,
      })
      .lean();

    return NextResponse.json({ labs: labs.map((lab) => serializeDeletedLab(lab, req)) });
  } catch (error) {
    return nextJsonError("Unable to load deleted labs", error, 500);
  }
}
