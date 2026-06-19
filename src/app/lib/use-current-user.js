"use client";

import { createContext, useContext, useEffect, useState } from "react";

const TenantShellContext = createContext(null);
const apiCache = new Map();

function getCacheKey(url) {
  if (typeof window === "undefined") return url;
  return `${window.location.origin}:${url}`;
}

async function readJsonResponse(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  const fallbackMessage = response.ok
    ? "Server returned a non-JSON response."
    : `Request failed with ${response.status} ${response.statusText || "error"}.`;

  return {
    error: fallbackMessage,
    details: text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 180),
  };
}

export function clearCachedApi(url) {
  if (!url) {
    apiCache.clear();
    return;
  }

  apiCache.delete(getCacheKey(url));
}

export async function cachedJsonFetch(url, options = {}) {
  const {
    ttl = 10_000,
    force = false,
    credentials = "include",
    ...fetchOptions
  } = options;
  const method = String(fetchOptions.method || "GET").toUpperCase();

  if (method !== "GET") {
    const response = await fetch(url, { ...fetchOptions, credentials });
    const data = await readJsonResponse(response);
    return { response, data };
  }

  const cacheKey = getCacheKey(url);
  const cached = apiCache.get(cacheKey);
  const now = Date.now();

  if (!force && cached?.value && cached.expiresAt > now) {
    return cached.value;
  }

  if (!force && cached?.promise) {
    return cached.promise;
  }

  let promise;
  promise = (async () => {
    const response = await fetch(url, { ...fetchOptions, credentials });
    const data = await readJsonResponse(response);
    const value = { response, data };

    if (response.ok) {
      apiCache.set(cacheKey, {
        value,
        expiresAt: Date.now() + ttl,
        promise: null,
      });
    }

    return value;
  })().finally(() => {
    const current = apiCache.get(cacheKey);
    if (current?.promise === promise) {
      apiCache.set(cacheKey, {
        ...current,
        promise: null,
      });
    }
  });

  apiCache.set(cacheKey, {
    value: null,
    expiresAt: 0,
    promise,
  });

  return promise;
}

export function TenantShellProvider({ value, children }) {
  return <TenantShellContext.Provider value={value}>{children}</TenantShellContext.Provider>;
}

export function useTenantShell() {
  return useContext(TenantShellContext);
}

export function useCurrentUser() {
  const shell = useTenantShell();
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (shell?.user) {
      return undefined;
    }

    let cancelled = false;

    async function loadUser() {
      try {
        const response = await fetch("/api/auth/me", { credentials: "include" });
        const data = await response.json();
        if (!cancelled && response.ok) setUser(data.user);
      } catch {
        if (!cancelled) setUser(null);
      }
    }

    loadUser();

    return () => {
      cancelled = true;
    };
  }, [shell?.user]);

  return shell?.user || user;
}
