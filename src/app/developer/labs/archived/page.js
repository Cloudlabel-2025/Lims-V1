"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icons } from "@/app/components/Icons";
import { cachedJsonFetch, clearCachedApi } from "@/app/lib/use-current-user";

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
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
  const [restoringId, setRestoringId] = useState("");

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
    } catch (err) {
      setError(err.message);
    } finally {
      setRestoringId("");
    }
  }

  return (
    <section className="developer-page">
      <div className="developer-page-actions">
        <div>
          <p className="developer-kicker">Lab Management</p>
          <h2>Archived Labs</h2>
          <span>Labs that were deleted. Restore them to make them active again — all data is intact.</span>
        </div>
        <Link className="developer-secondary-link" href="/developer/labs">
          {Icons.list}
          Back to Lab List
        </Link>
      </div>

      {error && <div className="developer-alert">{error}</div>}

      <section className="developer-panel">
        <div className="developer-panel-header">
          <h2>Deleted Labs</h2>
          <p>These labs were archived. Their databases and all tenant data are untouched.</p>
        </div>

        {loading ? (
          <p className="developer-empty">Loading archived labs...</p>
        ) : labs.length === 0 ? (
          <div className="developer-empty-state">
            <strong>No archived labs.</strong>
            <span>Labs you delete will appear here and can be restored at any time.</span>
          </div>
        ) : (
          <div className="developer-lab-list">
            {labs.map((lab) => (
              <article key={lab.tenantId} className="developer-lab-card">
                <div
                  className="developer-lab-swatch"
                  style={{ background: lab.primaryColor || "#6b7280" }}
                />
                <div>
                  <h3>{lab.name}</h3>
                  <span>{lab.tenantId} · {lab.subscriptionPlan} · <em style={{ color: "var(--danger, #dc2626)" }}>archived</em></span>
                  <small>Created {formatDate(lab.createdAt)}</small>
                  <small style={{ color: "var(--danger, #dc2626)" }}>
                    Archived {formatDate(lab.archivedAt)}
                  </small>
                  {lab.adminEmail && (
                    <small>Admin: {lab.adminEmail}</small>
                  )}
                  <small>DB: {lab.dbName}</small>
                </div>
                <div className="developer-link-actions">
                  <button
                    type="button"
                    className="developer-submit"
                    disabled={restoringId === lab.tenantId}
                    onClick={() => restoreLab(lab)}
                  >
                    {restoringId === lab.tenantId ? "Restoring..." : "Restore Lab"}
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
