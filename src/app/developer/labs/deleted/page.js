"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icons } from "@/app/components/Icons";
import { cachedJsonFetch } from "@/app/lib/use-current-user";

const LABS_PER_PAGE = 10;

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-US", {
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
          <h2>Deleted Labs</h2>
          <span>Labs moved out of archive. Restore is not available from this list.</span>
        </div>
        <Link className="developer-secondary-link" href="/developer/labs/archived">
          {Icons.trash}
          Archived Labs
        </Link>
      </div>

      {error && <div className="developer-alert">{error}</div>}

      <section className="developer-panel">
        <div className="developer-panel-header">
          <h2>Deleted Lab List</h2>
          <p>These tenant records are retained for audit/history only and cannot be restored from CMS.</p>
        </div>

        {loading ? (
          <p className="developer-empty">Loading deleted labs...</p>
        ) : labs.length === 0 ? (
          <div className="developer-empty-state">
            <strong>No deleted labs.</strong>
            <span>Labs moved from archive to deleted will appear here.</span>
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
                      <em style={{ color: "var(--danger, #dc2626)" }}>deleted</em>
                    </span>
                    <small>Created {formatDate(lab.createdAt)}</small>
                    <small>Archived {formatDate(lab.archivedAt)}</small>
                    <small style={{ color: "var(--danger, #dc2626)" }}>
                      Deleted {formatDate(lab.deletedAt)}
                    </small>
                    {lab.adminEmail && <small>Admin: {lab.adminEmail}</small>}
                    <small>DB: {lab.dbName}</small>
                  </div>
                  <div className="developer-link-actions">
                    <button type="button" disabled>
                      Restore Not Available
                    </button>
                  </div>
                </article>
              ))}
            </div>

            {totalPages > 1 && (
              <nav className="developer-pagination" aria-label="Deleted lab list pagination">
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
