"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { defaultLabModules } from "@/app/lib/modules";
import { Icons } from "@/app/components/Icons";
import SuccessDialog from "@/app/components/SuccessDialog";
import { cachedJsonFetch, clearCachedApi } from "@/app/lib/use-current-user";

const LABS_PER_PAGE = 10;

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
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function normalizeStatus(status) {
  return String(status || "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export default function DeveloperLabsListPage() {
  const [labs, setLabs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [copiedLoginUrl, setCopiedLoginUrl] = useState("");
  const [deletingLabId, setDeletingLabId] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

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

  async function copyValue(value, failureMessage = "Unable to copy value. Please copy it manually.") {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      setError(failureMessage);
    }
  }

  async function copyLoginUrl(loginUrl) {
    if (!loginUrl) return;
    await copyValue(loginUrl, "Unable to copy login link. Please copy it manually.");
    setCopiedLoginUrl(loginUrl);
    window.setTimeout(() => {
      setCopiedLoginUrl((current) => (current === loginUrl ? "" : current));
    }, 1800);
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
    setSuccess("");
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
      setSuccess(`Lab "${lab.name}" archived successfully.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingLabId("");
    }
  }

  const visibleLabs = labs.filter((lab) => !["archived", "deleted"].includes(lab.status));
  const activeLabs = visibleLabs.filter((lab) => lab.status === "active").length;
  const assignedModuleCount = new Set(visibleLabs.flatMap((lab) => lab.enabledModules || defaultLabModules)).size;
  const totalPages = Math.max(1, Math.ceil(visibleLabs.length / LABS_PER_PAGE));
  const pageStart = (currentPage - 1) * LABS_PER_PAGE;
  const paginatedLabs = visibleLabs.slice(pageStart, pageStart + LABS_PER_PAGE);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  return (
    <section className="developer-page developer-labs-page">
      <div className="developer-page-actions">
        <div>
          <p className="developer-kicker">Lab Management</p>
          <h2>Created Labs</h2>
          <span>Review tenant workspaces, subscriptions, access, and service state.</span>
        </div>
        <div className="developer-page-action-group">
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
      <SuccessDialog message={success} onClose={() => setSuccess("")} />

      <div className="developer-summary-grid developer-labs-summary-grid">
        <article className="developer-summary-card"><span>Total Labs</span><strong>{visibleLabs.length}</strong></article>
        <article className="developer-summary-card"><span>Active Labs</span><strong>{activeLabs}</strong></article>
        <article className="developer-summary-card"><span>Available Modules</span><strong>{assignedModuleCount}</strong></article>
      </div>

      <section className="developer-panel developer-labs-directory">
        <div className="developer-panel-header">
          <div>
            <h2>Laboratory directory</h2>
            <p>Essential workspace information is visible. Technical data stays available on demand.</p>
          </div>
          <span className="developer-panel-count">{visibleLabs.length} labs</span>
        </div>

        {loading ? (
          <p className="developer-empty">Loading labs...</p>
        ) : visibleLabs.length === 0 ? (
          <div className="developer-empty-state">
            <strong>No labs created yet.</strong>
            <span>Create the first tenant lab to initialize its database and admin user.</span>
            <Link className="developer-primary-link" href="/developer/labs/create">{Icons.plus} Create First Lab</Link>
          </div>
        ) : (
          <>
            <div className="developer-lab-list">
              {paginatedLabs.map((lab) => {
                const loginUrl = getActiveLabLoginUrl(lab);
                const enabledModules = lab.enabledModules || defaultLabModules;
                const visibleModules = enabledModules.slice(0, 4);
                const hiddenModuleCount = Math.max(0, enabledModules.length - visibleModules.length);
                const status = lab.subscriptionStatus || lab.status || "unknown";

                return (
                  <article key={lab.tenantId} className="developer-lab-card">
                    <header className="developer-lab-card-header">
                      <div className="developer-lab-identity">
                        <div className="developer-lab-avatar" style={{ borderColor: lab.primaryColor || "#0d9488" }}>
                          {(lab.name || lab.tenantId || "L").trim().charAt(0).toUpperCase()}
                        </div>
                        <div><h3>{lab.name}</h3><span>{lab.tenantId}</span></div>
                      </div>
                      <span className={`developer-lab-status status-${normalizeStatus(status)}`}>
                        <i /> {String(status).replace(/_/g, " ")}
                      </span>
                    </header>

                    <div className="developer-lab-facts">
                      <div><small>Package</small><strong>{lab.subscriptionPackageName || "Not assigned"}{lab.subscriptionReleaseVersion ? ` ${lab.subscriptionReleaseVersion}` : ""}</strong></div>
                      <div><small>Created</small><strong>{formatDate(lab.createdAt)}</strong></div>
                      <div><small>Modules</small><strong>{enabledModules.length} enabled</strong></div>
                      <div><small>Administrator</small><strong>{lab.adminEmail || "Not set"}</strong></div>
                    </div>

                    <div className="developer-lab-modules" aria-label="Enabled modules">
                      {visibleModules.map((module) => <span key={module}>{module}</span>)}
                      {hiddenModuleCount > 0 && <span className="more">+{hiddenModuleCount} more</span>}
                    </div>

                    <div className="developer-lab-access-row">
                      <div>
                        <small>Workspace login</small>
                        <button type="button" className="developer-url-link" onClick={() => openLoginUrl(lab)}>{loginUrl}</button>
                      </div>
                      <button type="button" className="developer-icon-button" onClick={() => copyLoginUrl(loginUrl)} title="Copy workspace login URL" aria-label="Copy workspace login URL">
                        {copiedLoginUrl === loginUrl ? "✓" : Icons.copy}
                      </button>
                    </div>

                    <details className="developer-lab-details">
                      <summary>Technical details <span>{Icons.chevronRight}</span></summary>
                      <div className="developer-lab-details-grid">
                        <div><small>Default subdomain</small><button type="button" onClick={() => copyValue(lab.defaultDomain || lab.loginUrl, "Unable to copy default subdomain.")}>{lab.defaultDomain || lab.loginUrl}{Icons.copy}</button></div>
                        <div><small>Lab administrator</small><button type="button" onClick={() => copyValue(lab.adminEmail, "Unable to copy lab admin user ID.")} disabled={!lab.adminEmail}>{lab.adminEmail || "Not set"}{lab.adminEmail && Icons.copy}</button></div>
                        {getLocalLabLoginUrl(lab.tenantId) && <div className="wide"><small>Production URL</small><span>{lab.loginUrl}</span></div>}
                        <div className="wide"><small>All enabled modules</small><span>{enabledModules.join(", ")}</span></div>
                      </div>
                    </details>

                    <footer className="developer-lab-card-actions">
                      <button type="button" className="primary" onClick={() => openLoginUrl(lab)}>Open workspace {Icons.arrowRight}</button>
                      <Link href={`/developer/labs/${encodeURIComponent(lab.id)}/edit`}>{Icons.edit} Edit</Link>
                      <Link href={`/developer/labs/${encodeURIComponent(lab.tenantId)}/subscription`}>Usage</Link>
                      <details className="developer-lab-action-menu">
                        <summary>More {Icons.dots}</summary>
                        <div>
                          <button type="button" onClick={() => copyLoginUrl(loginUrl)}>{Icons.copy}{copiedLoginUrl === loginUrl ? "Copied" : "Copy login link"}</button>
                          <button type="button" className="danger" disabled={deletingLabId === lab.id} onClick={() => deleteLab(lab)}>{Icons.trash}{deletingLabId === lab.id ? "Archiving..." : "Archive lab"}</button>
                        </div>
                      </details>
                    </footer>
                  </article>
                );
              })}
            </div>

            {totalPages > 1 && (
              <nav className="developer-pagination" aria-label="Lab list pagination">
                <span>Showing {pageStart + 1}-{Math.min(pageStart + LABS_PER_PAGE, visibleLabs.length)} of {visibleLabs.length}</span>
                <div>
                  <button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1}>Previous</button>
                  {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                    <button type="button" className={page === currentPage ? "active" : ""} key={page} onClick={() => setCurrentPage(page)} aria-current={page === currentPage ? "page" : undefined}>{page}</button>
                  ))}
                  <button type="button" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages}>Next</button>
                </div>
              </nav>
            )}
          </>
        )}
      </section>
    </section>
  );
}
