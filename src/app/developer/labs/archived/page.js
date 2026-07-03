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

  const totalPages = Math.max(1, Math.ceil(labs.length / LABS_PER_PAGE));
  const pageStart = (currentPage - 1) * LABS_PER_PAGE;
  const paginatedLabs = labs.slice(pageStart, pageStart + LABS_PER_PAGE);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  return (
    <section className="developer-page">
      <div className="developer-page-actions">
        <div>
          <p className="developer-kicker">Lab Management</p>
          <h2>Archived Labs</h2>
          <span>Recoverable soft-deleted labs. Restore them to make them active again.</span>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
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

      <section className="developer-panel">
        <div className="developer-panel-header">
          <h2>Archived Lab List</h2>
          <p>These labs are inactive, hidden from normal lab operations, and can still be restored.</p>
        </div>

        {loading ? (
          <p className="developer-empty">Loading archived labs...</p>
        ) : labs.length === 0 ? (
          <div className="developer-empty-state">
            <strong>No archived labs.</strong>
            <span>Labs you delete will appear here and can be restored at any time.</span>
          </div>
        ) : (
          <>
            <div className="developer-lab-list">
              {paginatedLabs.map((lab) => (
                <article key={lab.tenantId} className="developer-lab-card">
                  <div
                    className="developer-lab-swatch"
                    style={{ background: lab.primaryColor || "#6b7280" }}
                  />
                  <div>
                    <h3>{lab.name}</h3>
                    <span>
                      {lab.tenantId} - {lab.subscriptionPlan} -{" "}
                      <em style={{ color: "var(--danger, #dc2626)" }}>archived</em>
                    </span>
                    <small>Created {formatDate(lab.createdAt)}</small>
                    <small style={{ color: "var(--danger, #dc2626)" }}>
                      Archived {formatDate(lab.archivedAt)}
                    </small>
                    {lab.adminEmail && <small>Admin: {lab.adminEmail}</small>}
                    <small>DB: {lab.dbName}</small>
                  </div>
                  <div className="developer-link-actions">
                    <button
                      type="button"
                      className="developer-submit"
                      disabled={restoringId === lab.tenantId || deletingId === lab.tenantId}
                      onClick={() => restoreLab(lab)}
                    >
                      {restoringId === lab.tenantId ? "Restoring..." : "Restore Lab"}
                    </button>
                    <button
                      type="button"
                      className="danger"
                      disabled={restoringId === lab.tenantId || deletingId === lab.tenantId}
                      onClick={() => moveToDeleted(lab)}
                    >
                      {deletingId === lab.tenantId ? "Moving..." : "Move To Deleted"}
                    </button>
                  </div>
                </article>
              ))}
            </div>

            {totalPages > 1 && (
              <nav className="developer-pagination" aria-label="Archived lab list pagination">
                <span>
                  Showing {pageStart + 1}-{Math.min(pageStart + LABS_PER_PAGE, labs.length)} of{" "}
                  {labs.length}
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
