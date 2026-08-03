"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icons } from "@/app/components/Icons";
import SuccessDialog from "@/app/components/SuccessDialog";
import { cachedJsonFetch, clearCachedApi } from "@/app/lib/use-current-user";

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

export default function ArchivedLabsPage() {
  const [labs, setLabs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [restoringId, setRestoringId] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { response, data } = await cachedJsonFetch(
          "/api/developer/labs/archived",
          { ttl: 10_000 }
        );
        if (!response.ok) throw new Error(data.error || "Unable to load archived labs");
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

  async function restoreLab(lab) {
    const confirmed = window.confirm(
      `Restore "${lab.name}"?\n\nThis will set the lab back to active and allow users to log in again.`
    );
    if (!confirmed) return;

    setError("");
    setSuccess("");
    setRestoringId(lab.tenantId);

    try {
      const response = await fetch("/api/developer/labs/archived", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tenantId: lab.tenantId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to restore lab");

      clearCachedApi("/api/developer/labs/archived");
      clearCachedApi("/api/developer/labs");
      setLabs((current) => current.filter((item) => item.tenantId !== lab.tenantId));
      setSuccess(`Lab "${lab.name}" restored successfully.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setRestoringId("");
    }
  }

  async function moveToDeleted(lab) {
    const confirmed = window.confirm(
      `Move "${lab.name}" to Deleted Labs?\n\nDeleted labs cannot be restored from CMS. Tenant data is still retained for audit/history.`
    );
    if (!confirmed) return;

    setError("");
    setSuccess("");
    setDeletingId(lab.tenantId);

    try {
      const response = await fetch("/api/developer/labs/archived", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tenantId: lab.tenantId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to move lab to deleted list");

      clearCachedApi("/api/developer/labs/archived");
      clearCachedApi("/api/developer/labs/deleted");
      clearCachedApi("/api/developer/labs");
      setLabs((current) => current.filter((item) => item.tenantId !== lab.tenantId));
      setSuccess(`Lab "${lab.name}" moved to Deleted Labs successfully.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId("");
    }
  }

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
    <section className="developer-page developer-archived-page">
      <div className="developer-page-actions">
        <div>
          <p className="developer-kicker">Lab Management</p>
          <h2>Archived Labs</h2>
          <span>Review inactive tenant workspaces and safely return them to service.</span>
        </div>
        <div className="developer-page-action-group">
          <Link className="developer-secondary-link" href="/developer/labs/deleted">
            {Icons.trash}
            Deleted Labs
          </Link>
          <Link className="developer-secondary-link" href="/developer/labs">
            {Icons.list}
            Back to Lab List
          </Link>
        </div>
      </div>

      {error && <div className="developer-alert">{error}</div>}
      <SuccessDialog message={success} onClose={() => setSuccess("")} />

      <div className="developer-archive-summary" aria-label="Archived lab overview">
        <article>
          <span>Archived workspaces</span>
          <strong>{labs.length}</strong>
          <small>Currently outside normal lab operations</small>
        </article>
        <article>
          <span>Recovery state</span>
          <strong>Restorable</strong>
          <small>Workspace access returns after restoration</small>
        </article>
        <article>
          <span>Data handling</span>
          <strong>Retained</strong>
          <small>Tenant data remains available for recovery</small>
        </article>
      </div>

      <aside className="developer-archive-notice">
        <span>{Icons.alertCircle}</span>
        <div>
          <strong>Archived labs cannot sign in or run normal operations.</strong>
          <p>Restore a lab to reactivate it. Moving it to Deleted Labs removes the restore option from this workspace.</p>
        </div>
      </aside>

      <section className="developer-panel developer-archive-directory">
        <div className="developer-panel-header">
          <div>
            <h2>Archive directory</h2>
            <p>Search tenant identity, plan, administrator, or database information.</p>
          </div>
          <span className="developer-panel-count">{labs.length} {labs.length === 1 ? "lab" : "labs"}</span>
        </div>

        {!loading && labs.length > 0 && (
          <div className="developer-archive-toolbar">
            <label>
              <span>{Icons.search}</span>
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search archived labs"
                aria-label="Search archived labs"
              />
            </label>
            <small>{filteredLabs.length} matching {filteredLabs.length === 1 ? "workspace" : "workspaces"}</small>
          </div>
        )}

        {loading ? (
          <div className="developer-archive-loading" aria-live="polite">
            <span />
            <div><strong>Loading archived labs</strong><small>Retrieving workspace and recovery information...</small></div>
          </div>
        ) : labs.length === 0 ? (
          <div className="developer-empty-state">
            <strong>No archived labs.</strong>
            <span>Labs you delete will appear here and can be restored at any time.</span>
            <Link className="developer-secondary-link" href="/developer/labs">{Icons.list} Return to Lab List</Link>
          </div>
        ) : filteredLabs.length === 0 ? (
          <div className="developer-empty-state">
            <strong>No archived labs match “{searchQuery}”.</strong>
            <span>Try a lab name, tenant ID, plan, administrator email, or database name.</span>
            <button type="button" className="developer-secondary-link" onClick={() => setSearchQuery("")}>Clear search</button>
          </div>
        ) : (
          <>
            <div className="developer-archive-list">
              {paginatedLabs.map((lab) => (
                <article key={lab.tenantId} className="developer-archive-card">
                  <header>
                    <div className="developer-archive-identity">
                      <div className="developer-archive-avatar" style={{ borderColor: lab.primaryColor || "#0d9488" }}>
                        {(lab.name || lab.tenantId || "L").trim().charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3>{lab.name}</h3>
                        <span>{lab.tenantId}</span>
                      </div>
                    </div>
                    <span className="developer-archive-status"><i /> Archived</span>
                  </header>

                  <div className="developer-archive-facts">
                    <div><small>Subscription plan</small><strong>{lab.subscriptionPlan || "Not assigned"}</strong></div>
                    <div><small>Created</small><strong>{formatDate(lab.createdAt)}</strong></div>
                    <div className="archive-date"><small>Archived</small><strong>{formatDate(lab.archivedAt)}</strong></div>
                    <div><small>Administrator</small><strong>{lab.adminEmail || "Not assigned"}</strong></div>
                  </div>

                  <details className="developer-archive-details">
                    <summary>Technical and contact information <span>{Icons.chevronRight}</span></summary>
                    <div>
                      <article><small>Database</small><strong>{lab.dbName || "Not available"}</strong></article>
                      <article><small>Lab ID</small><strong>{lab.labId || lab.id || "Not available"}</strong></article>
                      <article><small>Contact email</small><strong>{lab.contactEmail || "Not provided"}</strong></article>
                      <article><small>Contact phone</small><strong>{lab.contactPhone || "Not provided"}</strong></article>
                      <article className="wide"><small>Enabled modules</small><strong>{lab.enabledModules?.length ? lab.enabledModules.join(", ") : "No modules recorded"}</strong></article>
                    </div>
                  </details>

                  <footer>
                    <p><strong>Recovery available</strong><span>Restore this workspace to the active lab directory.</span></p>
                    <button
                      type="button"
                      className="developer-archive-restore"
                      disabled={restoringId === lab.tenantId || deletingId === lab.tenantId}
                      onClick={() => restoreLab(lab)}
                    >
                      {Icons.undo}
                      {restoringId === lab.tenantId ? "Restoring..." : "Restore Lab"}
                    </button>
                    <button
                      type="button"
                      className="developer-archive-delete"
                      disabled={restoringId === lab.tenantId || deletingId === lab.tenantId}
                      onClick={() => moveToDeleted(lab)}
                    >
                      {Icons.trash}
                      {deletingId === lab.tenantId ? "Moving..." : "Move To Deleted"}
                    </button>
                  </footer>
                </article>
              ))}
            </div>

            {totalPages > 1 && (
              <nav className="developer-pagination" aria-label="Archived lab list pagination">
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
