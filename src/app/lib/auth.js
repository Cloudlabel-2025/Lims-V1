import { NextResponse } from "next/server";
import { getSessionCookieName, verifySessionToken } from "@/app/lib/session";
import { getTenantIdFromRequest } from "@/app/lib/tenant-resolver";
import { availableLabModules, defaultLabModules } from "@/app/lib/modules";
import { getTenantConfig } from "@/app/lib/tenant-cache";

export function getSessionFromRequest(req) {
  const token = req.cookies.get(getSessionCookieName())?.value;
  return verifySessionToken(token);
}

export function hasPermission(session, permission) {
  if (!permission) return true;
  if (!session) return false;
  if (session.userType === "developer" && session.isSystemOwner) return true;
  return (
    Array.isArray(session.permissions) &&
    (session.permissions.includes("*") || session.permissions.includes(permission))
  );
}

export function requireTenantSession(req, permission) {
  const session = getSessionFromRequest(req);

  if (!session) {
    return {
      error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
    };
  }

  if (session.userType !== "tenant") {
    return {
      error: NextResponse.json({ error: "Tenant account required" }, { status: 403 }),
    };
  }

  let tenantId = session.tenantId;
  try {
    const requestedTenantId = getTenantIdFromRequest(req);
    if (requestedTenantId && requestedTenantId !== session.tenantId) {
      return {
        error: NextResponse.json({ error: "Tenant mismatch" }, { status: 403 }),
      };
    }
    tenantId = requestedTenantId || tenantId;
  } catch {
    tenantId = session.tenantId;
  }

  if (!hasPermission(session, permission)) {
    return {
      error: NextResponse.json({ error: "Permission denied" }, { status: 403 }),
    };
  }

  return { session, tenantId };
}

export async function requireEnabledTenantModule(tenantId, permission) {
  const moduleConfig = availableLabModules.find((module) => module.permission === permission);
  if (!moduleConfig) return {};

  const lab = await getTenantConfig(tenantId);

  if (!lab) {
    return {
      error: NextResponse.json({ error: "Tenant not found" }, { status: 404 }),
    };
  }

  if (lab.status === "suspended") {
    return {
      error: NextResponse.json({ error: "Tenant is suspended" }, { status: 423 }),
    };
  }

  if (lab.status !== "active") {
    return {
      error: NextResponse.json({ error: "Tenant is not active" }, { status: 403 }),
    };
  }

  const enabledModules = lab.enabledModules?.length ? lab.enabledModules : defaultLabModules;

  if (!enabledModules.includes(moduleConfig.id)) {
    return {
      error: NextResponse.json(
        { error: `${moduleConfig.label} module is not enabled for this lab` },
        { status: 403 }
      ),
    };
  }

  return {};
}

export function requireAnySession(req) {
  const session = getSessionFromRequest(req);

  if (!session) {
    return {
      error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
    };
  }

  return { session };
}

export function requireDeveloperSession(req) {
  const session = getSessionFromRequest(req);

  if (!session) {
    return {
      error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
    };
  }

  if (session.userType !== "developer" || !session.isSystemOwner) {
    return {
      error: NextResponse.json({ error: "Developer owner access required" }, { status: 403 }),
    };
  }

  return { session };
}
