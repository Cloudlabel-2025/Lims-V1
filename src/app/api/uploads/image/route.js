import { NextResponse } from "next/server";
import { nextJsonError } from "@/app/lib/api-response";
import { hasPermission, requireAnySession } from "@/app/lib/auth";
import { normalizeTenantId } from "@/app/lib/tenant-resolver";
import { uploadImageToCloudinary } from "@/app/lib/cloudinary";

export const runtime = "nodejs";

const contextFolders = {
  "lab-logo": "branding/logo",
  "report-signature": "reports/signatures",
  "patient-photo": "patients/photos",
  "doctor-photo": "doctors/photos",
  attachment: "attachments",
};

function cleanFolderPart(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getUploadTenantId(session, rawTenantId) {
  if (session.userType === "tenant") {
    return normalizeTenantId(session.tenantId);
  }

  if (session.userType === "developer" && session.isSystemOwner) {
    if (!rawTenantId) {
      throw new Error("Tenant ID is required for developer uploads");
    }

    return normalizeTenantId(rawTenantId);
  }

  throw new Error("Upload access denied");
}

export async function POST(req) {
  try {
    const auth = requireAnySession(req);
    if (auth.error) return auth.error;

    const formData = await req.formData();
    const file = formData.get("file");
    const context = String(formData.get("context") || "attachment");
    const tenantId = getUploadTenantId(auth.session, formData.get("tenantId"));
    const folderSuffix = contextFolders[context];

    if (
      auth.session.userType === "tenant" &&
      context === "lab-logo" &&
      !hasPermission(auth.session, "settings.branding")
    ) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    if (!folderSuffix) {
      return NextResponse.json({ error: "Unsupported upload context" }, { status: 400 });
    }

    const folder = `lims/labs/${tenantId}/${folderSuffix}`;
    const publicIdPrefix = `${cleanFolderPart(context)}-${Date.now()}`;
    const image = await uploadImageToCloudinary(file, { folder, publicIdPrefix });

    return NextResponse.json({ image });
  } catch (error) {
    console.error("POST /api/uploads/image error:", error.message);

    return nextJsonError("Image upload failed", error, error.status || 400);
  }
}
