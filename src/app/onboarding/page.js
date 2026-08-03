"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icons } from "@/app/components/Icons";

function slugifySubdomain(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 63);
}

function getPreviewUrl(subdomain) {
  if (!subdomain) return "";

  if (typeof window !== "undefined") {
    const { hostname, port, protocol } = window.location;
    const isLocal =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname.endsWith(".localhost");

    if (isLocal) {
      const host = port ? `${subdomain}.localhost:${port}` : `${subdomain}.localhost`;
      return `${protocol}//${host}/`;
    }
  }

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  const protocol = process.env.NEXT_PUBLIC_APP_PROTOCOL || "https";

  if (rootDomain) {
    return `${protocol.replace(/:$/, "")}://${subdomain}.${rootDomain}/`;
  }

  const url = new URL(window.location.origin);
  url.searchParams.set("tenantId", subdomain);
  url.searchParams.set("access", "lab");
  return url.toString();
}

export default function TenantOnboardingPage() {
  const router = useRouter();
  const [labName, setLabName] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [subdomainTouched, setSubdomainTouched] = useState(false);
  const [status, setStatus] = useState({ state: "idle", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [createdUrl, setCreatedUrl] = useState("");

  const previewUrl = useMemo(() => getPreviewUrl(subdomain), [subdomain]);
  const canSubmit =
    labName.trim().length >= 2 && subdomain && status.state === "available" && !submitting;

  useEffect(() => {
    let cancelled = false;

    async function verifyDeveloperSession() {
      const response = await fetch("/api/auth/me", { credentials: "include" });
      const data = await response.json();

      if (!cancelled && (!response.ok || data.user?.userType !== "developer")) {
        router.replace("/");
      }
    }

    verifyDeveloperSession();

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (subdomainTouched) return;
    setSubdomain(slugifySubdomain(labName));
  }, [labName, subdomainTouched]);

  useEffect(() => {
    if (!subdomain) {
      setStatus({ state: "idle", message: "" });
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setStatus({ state: "checking", message: "Checking availability..." });

      try {
        const response = await fetch(
          `/api/tenants?subdomain=${encodeURIComponent(subdomain)}`,
          {
            credentials: "include",
            signal: controller.signal,
          }
        );
        const data = await response.json();

        if (!response.ok || !data.valid) {
          setStatus({ state: "invalid", message: data.error || "Invalid subdomain" });
          return;
        }

        if (!data.available) {
          setStatus({
            state: "taken",
            message: `Already taken. Try ${data.suggestion}.`,
            suggestion: data.suggestion,
          });
          return;
        }

        setStatus({ state: "available", message: "Subdomain is available" });
      } catch (error) {
        if (error.name !== "AbortError") {
          setStatus({ state: "invalid", message: "Unable to check subdomain" });
        }
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [subdomain]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setStatus({ state: "checking", message: "Creating lab..." });

    try {
      const response = await fetch("/api/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: labName,
          subdomain,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setStatus({
          state: response.status === 409 ? "taken" : "invalid",
          message: data.error || data.details || "Unable to create lab",
          suggestion: data.suggestion,
        });
        return;
      }

      setCreatedUrl(data.url);
      window.location.assign(data.url);
    } catch {
      setStatus({ state: "invalid", message: "Unable to create lab" });
    } finally {
      setSubmitting(false);
    }
  }

  function applySuggestion() {
    if (!status.suggestion) return;
    setSubdomainTouched(true);
    setSubdomain(status.suggestion);
  }

  return (
    <main className="tenant-onboarding-page">
      <aside className="tenant-onboarding-aside">
        <div className="tenant-onboarding-brand">
          <span>{Icons.logo}</span>
          <div><strong>UTHIRAM</strong><small>Provisioning console</small></div>
        </div>
        <div className="tenant-onboarding-progress">
          <p>Onboarding progress</p>
          <div className="active"><i>1</i><span><strong>Identity setup</strong><small>Lab name and tenant URL</small></span></div>
          <div><i>2</i><span><strong>Subscription package</strong><small>Capabilities and limits</small></span></div>
          <div><i>3</i><span><strong>Administrator</strong><small>Workspace owner access</small></span></div>
        </div>
        <div className="tenant-onboarding-help"><strong>Developer context</strong><span>Create the tenant identity first. Package assignment and administrator setup remain controlled workflows.</span></div>
      </aside>

      <section className="tenant-onboarding-workspace">
        <header className="tenant-onboarding-topbar">
          <Link href="/developer/dashboard">{Icons.arrowLeft} Back to console</Link>
          <span>New tenant provisioning</span>
        </header>

        <div className="tenant-onboarding-panel">
          <div className="tenant-onboarding-header">
            <p>Laboratory onboarding</p>
            <h1>Provision new laboratory tenant</h1>
            <span>Create a dedicated laboratory workspace and verify its tenant address.</span>
          </div>

          <div className="tenant-onboarding-grid">
          <form className="tenant-onboarding-form" onSubmit={handleSubmit}>
          <label>
            Laboratory legal name
            <input
              value={labName}
              onChange={(event) => setLabName(event.target.value)}
              placeholder="e.g. City General Pathlabs"
              required
            />
          </label>

          <label>
            Tenant subdomain
            <div className="tenant-onboarding-domain-field">
              <input
                value={subdomain}
                onChange={(event) => {
                  setSubdomainTouched(true);
                  setSubdomain(slugifySubdomain(event.target.value));
                }}
                placeholder="your-lab"
                required
              />
              <span>.lims.store</span>
            </div>
          </label>

          <div className={`tenant-onboarding-status ${status.state}`}>
            {status.message || "Choose a lab name to generate a subdomain."}
            {status.suggestion && (
              <button type="button" onClick={applySuggestion}>
                Use {status.suggestion}
              </button>
            )}
          </div>

          <div className="tenant-onboarding-preview">
            <span>{Icons.mapPin} Tenant URL preview</span>
            <strong>{previewUrl || "Generated after entering a tenant ID"}</strong>
          </div>

          <button type="submit" disabled={!canSubmit}>
            {submitting ? "Creating..." : "Create Lab And Open"}
          </button>

          {createdUrl && <a href={createdUrl}>Open tenant login</a>}
          </form>

          <aside className="tenant-onboarding-summary">
            <h2>Deployment summary</h2>
            <dl>
              <div><dt>Environment</dt><dd>Tenant production</dd></div>
              <div><dt>Authentication</dt><dd>Native secure access</dd></div>
              <div><dt>Tenant isolation</dt><dd>Dedicated subdomain</dd></div>
              <div><dt>Provisioning status</dt><dd>{status.state === "available" ? "Ready" : "Awaiting details"}</dd></div>
            </dl>
            <p>{Icons.shield} The tenant remains inaccessible until provisioning and access setup complete.</p>
          </aside>
          </div>
        </div>
      </section>
    </main>
  );
}
