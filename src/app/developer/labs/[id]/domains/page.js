"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { Icons } from "@/app/components/Icons";

function formatDate(value) {
  if (!value) return "Not verified";
  return new Date(value).toLocaleString();
}

function statusClass(status) {
  if (["verified", "active", "healthy", "configured", "issued"].includes(status)) return "available";
  if (["failed", "expired"].includes(status)) return "invalid";
  return "checking";
}

function getDomainUrl(domainName) {
  return domainName ? `https://${domainName}/` : "";
}

function getRecordName(record, domainName) {
  if (record.host === domainName) return "@";
  if (record.host.endsWith(`.${domainName}`)) {
    return record.host.slice(0, -(domainName.length + 1));
  }

  return record.host;
}

async function readApiJson(response, fallbackMessage) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(data.details || data.error || fallbackMessage);
      error.status = response.status;
      throw error;
    }

    return data;
  }

  const body = await response.text();
  const isHtml = body.trim().startsWith("<");
  const message = isHtml
    ? `${fallbackMessage}. The API route returned an HTML page, so restart the Next dev server and try again.`
    : body || fallbackMessage;
  const error = new Error(message);
  error.status = response.status;
  throw error;
}

function matchesLabIdentifier(lab, identifier) {
  const value = String(identifier || "").trim().toLowerCase();
  return [lab.id, lab.tenantId, lab.labId, lab.name]
    .filter(Boolean)
    .some((item) => String(item).trim().toLowerCase() === value);
}

async function resolveCanonicalLabIdentifier(identifier, signal) {
  const response = await fetch("/api/developer/labs", {
    credentials: "include",
    cache: "no-store",
    signal,
  });
  const data = await readApiJson(response, "Unable to resolve lab");
  const matchedLab = (data.labs || []).find((item) => matchesLabIdentifier(item, identifier));

  if (!matchedLab) return "";

  const current = String(identifier || "").trim().toLowerCase();
  if (String(matchedLab.id || "").trim().toLowerCase() !== current) return matchedLab.id;
  if (String(matchedLab.tenantId || "").trim().toLowerCase() !== current) return matchedLab.tenantId;

  return "";
}

export default function LabDomainsPage({ params }) {
  const { id } = use(params);
  const [apiLabId, setApiLabId] = useState(id);
  const [lab, setLab] = useState(null);
  const [domains, setDomains] = useState([]);
  const [domainName, setDomainName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifyingDomain, setVerifyingDomain] = useState("");
  const [error, setError] = useState("");

  const fetchDomainPayload = useCallback(async (identifier, signal) => {
    const response = await fetch(`/api/developer/labs/${encodeURIComponent(identifier)}/domains`, {
      credentials: "include",
      cache: "no-store",
      signal,
    });
    return readApiJson(response, "Unable to load domains");
  }, []);

  const loadDomains = useCallback(async (signal) => {
    setError("");
    try {
      let data;
      let resolvedIdentifier = id;

      try {
        data = await fetchDomainPayload(id, signal);
      } catch (err) {
        if (err.status !== 404) throw err;

        const canonicalIdentifier = await resolveCanonicalLabIdentifier(id, signal);
        if (!canonicalIdentifier) throw err;

        resolvedIdentifier = canonicalIdentifier;
        data = await fetchDomainPayload(canonicalIdentifier, signal);
      }

      setApiLabId(resolvedIdentifier);
      setLab(data.lab);
      setDomains(data.domains || []);
    } catch (err) {
      if (err.name !== "AbortError") setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [fetchDomainPayload, id]);

  useEffect(() => {
    const controller = new AbortController();
    loadDomains(controller.signal);
    return () => controller.abort();
  }, [loadDomains]);

  async function addDomain(event) {
    event.preventDefault();
    if (!domainName.trim()) return;

    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/developer/labs/${encodeURIComponent(apiLabId)}/domains`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({ domainName }),
      });
      const data = await readApiJson(response, "Unable to add domain");
      setLab(data.lab);
      setDomains(data.domains || []);
      setDomainName("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function verifyDomain(domain) {
    setVerifyingDomain(domain.domainName);
    setError("");
    try {
      const response = await fetch(`/api/developer/labs/${encodeURIComponent(apiLabId)}/domains`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({ domainName: domain.domainName }),
      });
      const data = await readApiJson(response, "Unable to verify domain");
      setLab(data.lab);
      setDomains(data.domains || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setVerifyingDomain("");
    }
  }

  async function setPrimaryDomain(domain) {
    setVerifyingDomain(domain.domainName);
    setError("");
    try {
      const response = await fetch(`/api/developer/labs/${encodeURIComponent(apiLabId)}/domains`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({ action: "set-primary", domainName: domain.domainName }),
      });
      const data = await readApiJson(response, "Unable to set primary domain");
      setLab(data.lab);
      setDomains(data.domains || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setVerifyingDomain("");
    }
  }

  async function removeDomain(domain) {
    const confirmed = window.confirm(`Remove ${domain.domainName} from this lab?`);
    if (!confirmed) return;

    setError("");
    try {
      const response = await fetch(
        `/api/developer/labs/${encodeURIComponent(apiLabId)}/domains?domain=${encodeURIComponent(domain.domainName)}`,
        {
          method: "DELETE",
          credentials: "include",
          cache: "no-store",
        }
      );
      const data = await readApiJson(response, "Unable to remove domain");
      setLab(data.lab);
      setDomains(data.domains || []);
    } catch (err) {
      setError(err.message);
    }
  }

  async function copyValue(value) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      setError("Unable to copy value. Please copy it manually.");
    }
  }

  if (loading) return <main className="developer-page">Loading domains...</main>;

  if (error && !lab) {
    return (
      <main className="developer-page">
        <div className="developer-page-actions">
          <div>
            <p className="developer-kicker">Domain Management</p>
            <h2>Lab Not Found</h2>
            <span>{error}</span>
          </div>
          <Link className="developer-secondary-link" href="/developer/labs">
            {Icons.arrowLeft}
            Back to Labs
          </Link>
        </div>
      </main>
    );
  }

  return (
    <section className="developer-page">
      <div className="developer-page-actions">
        <div>
          <p className="developer-kicker">Domain Management</p>
          <h2>{lab?.name || "Lab"} Domains</h2>
          <span>Connect a purchased domain so users can open the lab without the tenant.lims.store address.</span>
        </div>
        <Link className="developer-secondary-link" href="/developer/labs">
          {Icons.arrowLeft}
          Back to Labs
        </Link>
      </div>

      {error && <div className="developer-alert">{error}</div>}

      <div className="developer-summary-grid">
        <article className="developer-summary-card">
          <span>Default Subdomain</span>
          <strong>{lab?.defaultDomain || "Not configured"}</strong>
        </article>
        <article className="developer-summary-card">
          <span>Custom Domains</span>
          <strong>{domains.length}</strong>
        </article>
        <article className="developer-summary-card">
          <span>Verified</span>
          <strong>{domains.filter((domain) => domain.verificationStatus === "verified" || domain.status === "active").length}</strong>
        </article>
      </div>

      <section className="developer-panel">
        <div className="developer-panel-header">
          <h2>Mapping Flow</h2>
          <p>Follow this order for every purchased domain, such as uthiram.in.</p>
        </div>
        <div className="developer-summary-grid">
          <article className="developer-summary-card">
            <span>Step 1</span>
            <strong>Add domain here</strong>
          </article>
          <article className="developer-summary-card">
            <span>Step 2</span>
            <strong>Vercel is configured</strong>
          </article>
          <article className="developer-summary-card">
            <span>Step 3</span>
            <strong>Point nameservers to Vercel</strong>
          </article>
          <article className="developer-summary-card">
            <span>Step 4</span>
            <strong>Verify SSL and open</strong>
          </article>
        </div>
        <div className="developer-step-warning">
          Point your domain registrar nameservers to <strong>ns1.vercel-dns.com</strong> and <strong>ns2.vercel-dns.com</strong>. Vercel will then manage all DNS and SSL automatically. Keep lims.store as the platform root — do not point its nameservers.
        </div>
      </section>

      <section className="developer-panel">
        <div className="developer-panel-header">
          <h2>Default Lab URL</h2>
          <p>This platform URL stays available, but your custom domain works as a separate lab address after verification.</p>
        </div>
        <div className="developer-credential-grid">
          <div>
            <span>Tenant URL</span>
            <button type="button" onClick={() => copyValue(lab?.defaultUrl)}>
              <span>{lab?.defaultUrl || "Not configured"}</span>
              {Icons.copy}
            </button>
          </div>
        </div>
      </section>

      <form className="developer-panel" onSubmit={addDomain}>
        <div className="developer-panel-header">
          <h2>Add Custom Domain</h2>
          <p>Add only the domain you bought, such as customerlab.com or portal.customerlab.com. Do not include tenant ID or lims.store.</p>
        </div>
        <div className="developer-inline-form">
          <input
            value={domainName}
            onChange={(event) => setDomainName(event.target.value)}
            placeholder="Enter custom domain"
          />
          <button type="submit" disabled={saving || !domainName.trim()}>
            {saving ? "Adding..." : "Add Domain"}
          </button>
        </div>
      </form>

      <section className="developer-panel">
        <div className="developer-panel-header">
          <h2>Connected Domains</h2>
          <p>Point your domain nameservers to Vercel, then verify below.</p>
        </div>

        {domains.length === 0 ? (
          <div className="developer-empty-state">
            <strong>No custom domains connected.</strong>
            <span>Add a customer domain to generate DNS verification records.</span>
          </div>
        ) : (
          <div className="developer-lab-list">
            {domains.map((domain) => (
              <article className="developer-lab-card" key={domain.domainName}>
                <div className="developer-lab-swatch" />
                <div>
                  <h3>{domain.domainName}</h3>
                  <span>
                    DNS: {domain.dnsStatus || domain.dnsHealthStatus} - Status: {domain.status || domain.verificationStatus} - SSL: {domain.sslStatus}
                  </span>
                  {domain.isPrimary && <small>Primary domain</small>}
                  <button
                    type="button"
                    className="developer-url-link"
                    onClick={() => window.open(getDomainUrl(domain.domainName), "_blank", "noopener,noreferrer")}
                  >
                    {getDomainUrl(domain.domainName)}
                  </button>
                  <small>Last checked {formatDate(domain.lastVerifiedAt)}</small>
                  <div className="developer-domain-records">
                    {(domain.dnsRecords || []).map((record) =>
                      record.type === "NS" ? (
                        <div
                          key={`${record.type}-${record.host}-${record.value}`}
                          className="developer-dns-record"
                        >
                          <strong>Nameserver</strong>
                          <button type="button" onClick={() => copyValue(record.value)} title="Copy nameserver">
                            <span>Set at registrar</span>
                            <code>{record.value}</code>
                            {Icons.copy}
                          </button>
                        </div>
                      ) : (
                        <div
                          key={`${record.type}-${record.host}-${record.value}`}
                          className="developer-dns-record"
                        >
                          <strong>{record.required === false ? "Optional" : "Required"} {record.type}</strong>
                          <button type="button" onClick={() => copyValue(getRecordName(record, domain.domainName))} title="Copy name">
                            <span>Name</span>
                            <code>{getRecordName(record, domain.domainName)}</code>
                            {Icons.copy}
                          </button>
                          <button type="button" onClick={() => copyValue(record.value)} title="Copy value">
                            <span>Value</span>
                            <code>{record.value}</code>
                            {Icons.copy}
                          </button>
                        </div>
                      )
                    )}
                  </div>
                  <div className={`tenant-onboarding-status ${statusClass(domain.status || domain.verificationStatus)}`}>
                    <span>{domain.status || domain.verificationStatus}</span>
                    <small>Vercel project setup is automated. Verification checks DNS and SSL state through the Vercel API.</small>
                  </div>
                </div>
                <div className="developer-link-actions">
                  <button
                    type="button"
                    onClick={() => verifyDomain(domain)}
                    disabled={verifyingDomain === domain.domainName}
                  >
                    {verifyingDomain === domain.domainName ? "Verifying" : "Verify"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrimaryDomain(domain)}
                    disabled={domain.isPrimary || domain.status !== "active"}
                  >
                    Set Primary
                  </button>
                  <button type="button" className="danger" onClick={() => removeDomain(domain)}>
                    {Icons.trash}
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
