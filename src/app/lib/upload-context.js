import { hasPermission } from "@/app/lib/auth";
import { normalizeTenantId } from "@/app/lib/tenant-resolver";

export const uploadContextFolders = {
  "lab-logo": "branding/logo",
  "report-header": "reports/header",
  "report-signature": "reports/signatures",
  "patient-photo": "patients/photos",
  "doctor-photo": "doctors/photos",
  attachment: "attachments",
};

export function cleanUploadFolderPart(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getUploadTenantId(session, rawTenantId) {
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

export function assertUploadAccess(session, context) {
  if (
    session.userType === "tenant" &&
    context === "lab-logo" &&
    !hasPermission(session, "settings.branding")
  ) {
    return { error: "Permission denied", status: 403 };
  }

  return null;
}

export function buildUploadTarget(session, { context, tenantId }) {
  const normalizedContext = String(context || "attachment");
  const normalizedTenantId = getUploadTenantId(session, tenantId);
  const folderSuffix = uploadContextFolders[normalizedContext];

  if (!folderSuffix) {
    return { error: "Unsupported upload context", status: 400 };
  }

  const accessError = assertUploadAccess(session, normalizedContext);
  if (accessError) return accessError;

  return {
    context: normalizedContext,
    tenantId: normalizedTenantId,
    folder: `lims/labs/${normalizedTenantId}/${folderSuffix}`,
    publicIdPrefix: `${cleanUploadFolderPart(normalizedContext)}-${Date.now()}`,
  };
}
