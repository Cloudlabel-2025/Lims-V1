"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icons } from "@/app/components/Icons";
import { cachedJsonFetch } from "@/app/lib/use-current-user";

const LABS_PER_PAGE = 10;

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DeletedLabsPage() {
  const [labs, setLabs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { response, data } = await cachedJsonFetch(
          "/api/developer/labs/deleted",
          { ttl: 10_000 }
        );
        if (!response.ok) throw new Error(data.error || "Unable to load deleted labs");
        if (!cancelled) setLabs(data.labs || []);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredLabs = normalizedSearch
    ? labs.filter((lab) =>
        [lab.name, lab.tenantId, lab.adminEmail, lab.dbName, lab.subscriptionPlan]
          .some((value) => String(value || "").toLowerCase().includes(normalizedSearch))
      )
    : labs;
  const totalPages = Math.max(1, Math.ceil(filteredLabs.length / LABS_PER_PAGE));
  const pageStart = (currentPage - 1) * LABS_PER_PAGE;
  const paginatedLabs = filteredLabs.slice(pageStart, pageStart + LABS_PER_PAGE);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  return (
    <section className="developer-page developer-deleted-page">
      <div className="developer-page-actions">
        <div>
          <p className="developer-kicker">Lab Management</p>
          <h2>Deleted Labs</h2>
          <span>Review final-state tenant records retained for governance and audit history.</span>
        </div>
        <div className="developer-page-action-group">
          <Link className="developer-secondary-link" href="/developer/labs/archived">
            {Icons.undo}
            Archived Labs
          </Link>
          <Link className="developer-secondary-link" href="/developer/labs">
            {Icons.list}
            Back to Lab List
          </Link>
        </div>
      </div>

      {error && <div className="developer-alert">{error}</div>}

      <div className="developer-archive-summary developer-deleted-summary" aria-label="Deleted lab overview">
        <article>
          <span>Deleted records</span>
          <strong>{labs.length}</strong>
          <small>Final-state tenant records in this directory</small>
        </article>
        <article>
          <span>Recovery state</span>
          <strong>Unavailable</strong>
          <small>CMS restoration is no longer available</small>
        </article>
        <article>
          <span>Record purpose</span>
          <strong>Audit</strong>
          <small>Identity and lifecycle history remain visible</small>
        </article>
      </div>

      <aside className="developer-deleted-notice">
        <span>{Icons.lock}</span>
        <div>
          <strong>Deleted labs are locked in a final lifecycle state.</strong>
          <p>These records cannot be restored from the developer console. They remain visible only for traceability and audit review.</p>
        </div>
      </aside>

      <section className="developer-panel developer-archive-directory developer-deleted-directory">
        <div className="developer-panel-header">
          <div>
            <h2>Deleted records directory</h2>
            <p>Search tenant identity, plan, administrator, or database information.</p>
          </div>
          <span className="developer-panel-count">{labs.length} {labs.length === 1 ? "record" : "records"}</span>
        </div>

        {!loading && labs.length > 0 && (
          <div className="developer-archive-toolbar">
            <label>
              <span>{Icons.search}</span>
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search deleted labs"
                aria-label="Search deleted labs"
              />
            </label>
            <small>{filteredLabs.length} matching {filteredLabs.length === 1 ? "record" : "records"}</small>
          </div>
        )}

        {loading ? (
          <div className="developer-archive-loading" aria-live="polite">
            <span />
            <div><strong>Loading deleted records</strong><small>Retrieving tenant lifecycle and audit information...</small></div>
          </div>
        ) : labs.length === 0 ? (
          <div className="developer-empty-state">
            <strong>No deleted labs.</strong>
            <span>Labs moved from the archive into their final state will appear here.</span>
            <Link className="developer-secondary-link" href="/developer/labs/archived">{Icons.undo} View Archived Labs</Link>
          </div>
        ) : filteredLabs.length === 0 ? (
          <div className="developer-empty-state">
            <strong>No deleted records match “{searchQuery}”.</strong>
            <span>Try a lab name, tenant ID, plan, administrator email, or database name.</span>
            <button type="button" className="developer-secondary-link" onClick={() => setSearchQuery("")}>Clear search</button>
          </div>
        ) : (
          <>
            <div className="developer-deleted-list">
              {paginatedLabs.map((lab) => (
                <article key={lab.tenantId} className="developer-deleted-card">
                  <header>
                    <div className="developer-archive-identity">
                      <div className="developer-archive-avatar developer-deleted-avatar" style={{ borderColor: lab.primaryColor || "#94a3b8" }}>
                        {(lab.name || lab.tenantId || "L").trim().charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3>{lab.name}</h3>
                        <span>{lab.tenantId}</span>
                      </div>
                    </div>
                    <span className="developer-deleted-status"><i /> Deleted</span>
                  </header>

                  <div className="developer-deleted-facts">
                    <div><small>Subscription plan</small><strong>{lab.subscriptionPlan || "Not assigned"}</strong></div>
                    <div><small>Created</small><strong>{formatDate(lab.createdAt)}</strong></div>
                    <div><small>Archived</small><strong>{formatDate(lab.archivedAt)}</strong></div>
                    <div className="deleted-date"><small>Deleted</small><strong>{formatDate(lab.deletedAt)}</strong></div>
                  </div>

                  <details className="developer-archive-details developer-deleted-details">
                    <summary>Audit and technical information <span>{Icons.chevronRight}</span></summary>
                    <div>
                      <article><small>Administrator</small><strong>{lab.adminEmail || "Not assigned"}</strong></article>
                      <article><small>Database</small><strong>{lab.dbName || "Not available"}</strong></article>
                      <article><small>Lab ID</small><strong>{lab.labId || lab.id || "Not available"}</strong></article>
                      <article><small>Contact email</small><strong>{lab.contactEmail || "Not provided"}</strong></article>
                      <article><small>Contact phone</small><strong>{lab.contactPhone || "Not provided"}</strong></article>
                      <article className="wide"><small>Last recorded modules</small><strong>{lab.enabledModules?.length ? lab.enabledModules.join(", ") : "No modules recorded"}</strong></article>
                    </div>
                  </details>

                  <footer>
                    <span>{Icons.lock}</span>
                    <div>
                      <strong>Final state - restore unavailable</strong>
                      <small>This record is retained for audit visibility only.</small>
                    </div>
                    <span className="developer-deleted-audit-badge">Audit record</span>
                  </footer>
                </article>
              ))}
            </div>

            {totalPages > 1 && (
              <nav className="developer-pagination" aria-label="Deleted lab list pagination">
                <span>
                  Showing {pageStart + 1}-{Math.min(pageStart + LABS_PER_PAGE, filteredLabs.length)} of{" "}
                  {filteredLabs.length}
                </span>
                <div>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </button>
                  {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                    <button
                      type="button"
                      className={page === currentPage ? "active" : ""}
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      aria-current={page === currentPage ? "page" : undefined}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </button>
                </div>
              </nav>
            )}
          </>
        )}
      </section>
    </section>
  );
}
