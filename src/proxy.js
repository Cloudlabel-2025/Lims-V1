import { NextResponse } from "next/server";
import { getTenantIdFromHostname, normalizeRootDomain } from "@/app/lib/tenant-resolver";

const skippedPrefixes = [
  "/_next",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  "/api/internal",
];

const tenantLookupCache = globalThis.limsTenantLookupCache || new Map();
globalThis.limsTenantLookupCache = tenantLookupCache;

function getTenantLookupCacheTtlMs() {
  const ttl = Number(process.env.TENANT_PROXY_CACHE_TTL_MS || 30_000);
  return Number.isFinite(ttl) && ttl > 0 ? ttl : 30_000;
}

function getLookupSecret() {
  if (process.env.TENANT_LOOKUP_SECRET) return process.env.TENANT_LOOKUP_SECRET;
  if (process.env.NODE_ENV !== "production") return "dev-tenant-lookup-secret";
  return "";
}

function isSkippedPath(pathname) {
  return skippedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isApiPath(pathname) {
  return pathname === "/api" || pathname.startsWith("/api/");
}

function debugRequestLog(message, details = {}) {
  if (process.env.NODE_ENV === "production" || process.env.DEBUG_REQUESTS === "false") return;

  const detailText = Object.entries(details)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key}=${value}`)
    .join(" ");

  console.log(`[request:proxy] ${message}${detailText ? ` ${detailText}` : ""}`);
}

function blockedResponse(message, status) {
  return new NextResponse(message, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function getCachedTenantLookup(tenantId) {
  const cached = tenantLookupCache.get(tenantId);
  if (!cached) return null;

  if (cached.expiresAt <= Date.now()) {
    tenantLookupCache.delete(tenantId);
    return null;
  }

  return cached;
}

function setCachedTenantLookup(tenantId, status) {
  tenantLookupCache.set(tenantId, {
    status,
    expiresAt: Date.now() + getTenantLookupCacheTtlMs(),
  });
}

export async function proxy(req) {
  const { pathname } = req.nextUrl;

  if (isSkippedPath(pathname) || /\.[a-zA-Z0-9]+$/.test(pathname)) {
    return NextResponse.next();
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.delete("x-tenant-id");
  requestHeaders.delete("x-lims-tenant-id");
  requestHeaders.delete("x-lims-tenant-status");

  if (isApiPath(pathname)) {
    debugRequestLog("skip-api-tenant-lookup", { pathname });
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  const hostname = host.split(":")[0].toLowerCase();
  const tenantId = getTenantIdFromHostname(hostname);

  if (!tenantId) {
    debugRequestLog("no-tenant", { pathname, hostname });
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  const lookupSecret = getLookupSecret();
  if (!lookupSecret) {
    return blockedResponse("Tenant lookup is not configured", 500);
  }

  const cachedLookup = getCachedTenantLookup(tenantId);
  if (cachedLookup) {
    debugRequestLog("tenant-lookup-cache-hit", {
      pathname,
      tenantId,
      status: cachedLookup.status,
    });

    if (cachedLookup.status === 404) {
      return blockedResponse("Tenant not found", 404);
    }

    if (cachedLookup.status === 423) {
      return blockedResponse("Tenant is suspended", 423);
    }

    if (cachedLookup.status !== 200) {
      return blockedResponse("Tenant is not available", cachedLookup.status || 403);
    }
  }

  if (!cachedLookup) {
    const lookupUrl = req.nextUrl.clone();
    lookupUrl.pathname = "/api/internal/tenant";
    lookupUrl.search = "";
    lookupUrl.searchParams.set("subdomain", tenantId);

    debugRequestLog("tenant-lookup-start", { pathname, tenantId });
    const lookupResponse = await fetch(lookupUrl, {
      headers: {
        "x-tenant-secret": lookupSecret,
      },
      cache: "no-store",
    });
    debugRequestLog("tenant-lookup-finish", {
      pathname,
      tenantId,
      status: lookupResponse.status,
    });
    setCachedTenantLookup(tenantId, lookupResponse.status);

    if (lookupResponse.status === 404) {
      return blockedResponse("Tenant not found", 404);
    }

    if (lookupResponse.status === 423) {
      return blockedResponse("Tenant is suspended", 423);
    }

    if (!lookupResponse.ok) {
      return blockedResponse("Tenant is not available", lookupResponse.status || 403);
    }
  }

  requestHeaders.set("x-lims-tenant-id", tenantId);
  requestHeaders.set("x-lims-tenant-status", "active");

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  const rootDomain = normalizeRootDomain(process.env.ROOT_DOMAIN);
  if (rootDomain && hostname.endsWith(`.${rootDomain}`)) {
    response.headers.set("x-lims-tenant-id", tenantId);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
