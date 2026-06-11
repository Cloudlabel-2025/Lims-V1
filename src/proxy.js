import { NextResponse } from "next/server";
import { getHostnameFromHeaders, getTenantIdFromHostname, normalizeRootDomain } from "@/app/lib/tenant-resolver";

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
  const ttl = Number(process.env.TENANT_PROXY_CACHE_TTL_MS || process.env.TENANT_CACHE_TTL_MS || 30_000);
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

function isPlatformApiPath(pathname) {
  return (
    pathname === "/api/developer" ||
    pathname.startsWith("/api/developer/") ||
    pathname === "/api/tenants" ||
    pathname.startsWith("/api/tenants/")
  );
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

function getCachedTenantLookup(cacheKey) {
  const cached = tenantLookupCache.get(cacheKey);
  if (!cached) return null;

  if (cached.expiresAt <= Date.now()) {
    tenantLookupCache.delete(cacheKey);
    return null;
  }

  return cached;
}

function setCachedTenantLookup(cacheKey, status, tenantId = "") {
  tenantLookupCache.set(cacheKey, {
    status,
    tenantId,
    expiresAt: Date.now() + getTenantLookupCacheTtlMs(),
  });
}

function isPlatformHost(hostname) {
  const rootDomain = normalizeRootDomain(process.env.ROOT_DOMAIN);
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    (rootDomain && (hostname === rootDomain || hostname.endsWith(`.${rootDomain}`)))
  );
}

function isCustomDomain(hostname) {
  return !isPlatformHost(hostname);
}

function isDeveloperPath(pathname) {
  return (
    pathname === "/developer" ||
    pathname.startsWith("/developer/") ||
    pathname === "/onboarding" ||
    pathname.startsWith("/onboarding/")
  );
}

function isCmsPlatformApiPath(pathname) {
  return (
    pathname === "/api/auth/forgot-password" ||
    pathname === "/api/auth/reset-password"
  );
}

function isCmsPlatformPagePath(pathname) {
  return (
    pathname === "/forgot-password" ||
    pathname.startsWith("/forgot-password/") ||
    pathname === "/reset-password" ||
    pathname.startsWith("/reset-password/")
  );
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

  const hostname = getHostnameFromHeaders(req.headers);

  if (!isCustomDomain(hostname) && isApiPath(pathname) && isPlatformApiPath(pathname)) {
    debugRequestLog("skip-api-tenant-lookup", { pathname });
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  if (isCustomDomain(hostname) && isApiPath(pathname) && isPlatformApiPath(pathname)) {
    return blockedResponse("Not found", 404);
  }

  if (isCustomDomain(hostname) && isDeveloperPath(pathname)) {
    return blockedResponse("Not found", 404);
  }

  if (isCustomDomain(hostname) && isCmsPlatformPagePath(pathname)) {
    return blockedResponse("Not found", 404);
  }

  if (isCustomDomain(hostname) && isCmsPlatformApiPath(pathname)) {
    return blockedResponse("Not found", 404);
  }

  let tenantId = getTenantIdFromHostname(hostname);
  const shouldLookupCustomDomain = !tenantId && hostname && !isPlatformHost(hostname);

  if (!tenantId && !shouldLookupCustomDomain) {
    if (isCustomDomain(hostname)) {
      return blockedResponse("Lab portal not available", 404);
    }
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

  const lookupCacheKey = tenantId ? `subdomain:${tenantId}` : `domain:${hostname}`;
  const cachedLookup = getCachedTenantLookup(lookupCacheKey);
  if (cachedLookup) {
    tenantId = tenantId || cachedLookup.tenantId;
    debugRequestLog("tenant-lookup-cache-hit", {
      pathname,
      tenantId,
      hostname,
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
    if (tenantId) {
      lookupUrl.searchParams.set("subdomain", tenantId);
    } else {
      lookupUrl.searchParams.set("domain", hostname);
    }

    debugRequestLog("tenant-lookup-start", { pathname, tenantId, hostname });
    const lookupResponse = await fetch(lookupUrl, {
      headers: {
        "x-tenant-secret": lookupSecret,
      },
      cache: "no-store",
    });
    debugRequestLog("tenant-lookup-finish", {
      pathname,
      tenantId,
      hostname,
      status: lookupResponse.status,
    });
    const lookupData = await lookupResponse.json().catch(() => ({}));
    tenantId = tenantId || lookupData.tenant?.tenant_id || "";
    setCachedTenantLookup(lookupCacheKey, lookupResponse.status, tenantId);

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
