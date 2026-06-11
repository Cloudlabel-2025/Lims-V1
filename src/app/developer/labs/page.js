"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { defaultLabModules } from "@/app/lib/modules";
import { Icons } from "@/app/components/Icons";
import { cachedJsonFetch, clearCachedApi } from "@/app/lib/use-current-user";

function getLocalLabLoginUrl(tenantId) {
  if (typeof window === "undefined") return "";
  const { hostname, port, protocol } = window.location;
  if (hostname !== "localhost" && hostname !== "127.0.0.1") return "";
  const host = port ? `${tenantId}.localhost:${port}` : `${tenantId}.localhost`;
  return `${protocol}//${host}/`;
}

function getActiveLabLoginUrl(lab) {
  return getLocalLabLoginUrl(lab.tenantId) || lab.loginUrl;
}

function formatDate(value) {
  if (!value) return "Not available";
  return new Date(value).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function DeveloperLabsListPage() {
  const [labs, setLabs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedLoginUrl, setCopiedLoginUrl] = useState("");
  const [deletingLabId, setDeletingLabId] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadLabs() {
      try {
        const { response, data } = await cachedJsonFetch("/api/developer/labs", { ttl: 15_000 });
        if (!response.ok) throw new Error(data.error || "Unable to load labs");
        if (!cancelled) setLabs(data.labs || []);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadLabs();
    return () => { cancelled = true; };
  }, []);

  async function copyLoginUrl(loginUrl) {
    if (!loginUrl) return;
    await copyValue(loginUrl, "Unable to copy login link. Please copy it manually.");
    setCopiedLoginUrl(loginUrl);
    window.setTimeout(() => {
      setCopiedLoginUrl((current) => (current === loginUrl ? "" : current));
    }, 1800);
  }

  async function copyValue(value, failureMessage = "Unable to copy value. Please copy it manually.") {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      setError(failureMessage);
    }
  }

  function openLoginUrl(lab) {
    window.open(getActiveLabLoginUrl(lab), "_blank", "noopener,noreferrer");
  }

  async function deleteLab(lab) {
    const confirmed = window.confirm(
      `Archive "${lab.name}"?\n\nThe lab will be deactivated and moved to Archived Labs. All data stays intact and can be restored at any time.`
    );
    if (!confirmed) return;

    setError("");
    setDeletingLabId(lab.id);

    try {
      const response = await fetch(`/api/developer/labs/${encodeURIComponent(lab.id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.details || "Unable to archive lab");

      clearCachedApi("/api/developer/labs");
      clearCachedApi("/api/developer/labs/archived");
      setLabs((current) => current.filter((item) => item.id !== lab.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingLabId("");
    }
  }

  const visibleLabs = labs.filter((lab) => lab.status !== "archived");
  const activeLabs = visibleLabs.filter((lab) => lab.status === "active").length;
  const suspendedLabs = visibleLabs.filter((lab) => lab.status === "suspended").length;

  return (
    <section className="developer-page">
      <div className="developer-page-actions">
        <div>
          <p className="developer-kicker">Lab Management</p>
          <h2>Created Labs</h2>
          <span>Review tenant labs, login URLs, modules, status, and plan details.</span>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <Link className="developer-secondary-link" href="/developer/labs/archived">
            {Icons.trash}
            Archived Labs
          </Link>
          <Link className="developer-primary-link" href="/developer/labs/create">
            {Icons.plus}
            Create Lab
          </Link>
        </div>
      </div>

      {error && <div className="developer-alert">{error}</div>}

      <div className="developer-summary-grid">
        <article className="developer-summary-card">
          <span>Total Labs</span>
          <strong>{visibleLabs.length}</strong>
        </article>
        <article className="developer-summary-card">
          <span>Active Labs</span>
          <strong>{activeLabs}</strong>
        </article>
        <article className="developer-summary-card">
          <span>Suspended Labs</span>
          <strong>{suspendedLabs}</strong>
        </article>
      </div>

      <section className="developer-panel">
        <div className="developer-panel-header">
          <h2>Lab List</h2>
          <p>Each card gives the lab login URL and module summary.</p>
        </div>

        {loading ? (
          <p className="developer-empty">Loading labs...</p>
        ) : visibleLabs.length === 0 ? (
          <div className="developer-empty-state">
            <strong>No labs created yet.</strong>
            <span>Create the first tenant lab to initialize its database and admin user.</span>
            <Link className="developer-primary-link" href="/developer/labs/create">
              {Icons.plus}
              Create First Lab
            </Link>
          </div>
        ) : (
          <div className="developer-lab-list">
            {visibleLabs.map((lab) => {
              const loginUrl = getActiveLabLoginUrl(lab);
              return (
                <article key={lab.tenantId} className="developer-lab-card">
                  <div className="developer-lab-swatch" style={{ background: lab.primaryColor }} />
                  <div>
                    <h3>{lab.name}</h3>
                    <span>
                      {lab.tenantId} - {lab.subscriptionPlan} - {lab.status}
                    </span>
                    <small>Created {formatDate(lab.createdAt)}</small>
                    <small>{(lab.enabledModules || defaultLabModules).join(", ")}</small>
                    <button
                      type="button"
                      className="developer-url-link"
                      onClick={() => openLoginUrl(lab)}
                    >
                      {loginUrl}
                    </button>
                    {getLocalLabLoginUrl(lab.tenantId) && (
                      <small className="developer-production-url">Production: {lab.loginUrl}</small>
                    )}
                    <div className="developer-lab-domain-summary">
                      <span>Default Subdomain</span>
                      <button
                        type="button"
                        onClick={() => copyValue(lab.defaultDomain || lab.loginUrl, "Unable to copy default subdomain.")}
                      >
                        {lab.defaultDomain || lab.loginUrl}
                        {Icons.copy}
                      </button>
                    </div>
                    <div className="developer-credential-grid">
                      <div>
                        <span>Lab Admin User ID</span>
                        <button
                          type="button"
                          onClick={() => copyValue(lab.adminEmail, "Unable to copy lab admin user ID.")}
                          disabled={!lab.adminEmail}
                          title="Copy lab admin user ID"
                        >
                          <span>{lab.adminEmail || "Not set"}</span>
                          {lab.adminEmail && Icons.copy}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="developer-link-actions">
                    <button type="button" onClick={() => openLoginUrl(lab)}>
                      Open
                    </button>
                    <button type="button" onClick={() => copyLoginUrl(loginUrl)}>
                      {copiedLoginUrl === loginUrl ? "Copied" : "Copy Link"}
                    </button>
                    <Link href={`/developer/labs/${encodeURIComponent(lab.id)}/edit`}>
                      {Icons.edit}
                      Edit
                    </Link>
                    <button
                      type="button"
                      className="danger"
                      disabled={deletingLabId === lab.id}
                      onClick={() => deleteLab(lab)}
                    >
                      {Icons.trash}
                      {deletingLabId === lab.id ? "Archiving..." : "Delete"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}
