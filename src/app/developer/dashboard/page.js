"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icons } from "@/app/components/Icons";
import { cachedJsonFetch } from "@/app/lib/use-current-user";

function formatDate(value) {
  if (!value) return "Not available";
  return new Date(value).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function DeveloperDashboardPage() {
  const [labs, setLabs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadLabs() {
      try {
        const { response, data } = await cachedJsonFetch("/api/developer/labs", { ttl: 15_000 });

        if (!response.ok) {
          throw new Error(data.error || "Unable to load developer dashboard");
        }

        if (!cancelled) setLabs(data.labs || []);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadLabs();

    return () => {
      cancelled = true;
    };
  }, []);

  const activeLabs = labs.filter((lab) => lab.status === "active").length;
  const suspendedLabs = labs.filter((lab) => lab.status === "suspended").length;
  const recentLabs = labs.slice(0, 5);
  const moduleCount = new Set(labs.flatMap((lab) => lab.enabledModules || [])).size;

  return (
    <section className="developer-page">
      <div className="developer-page-actions">
        <div>
          <p className="developer-kicker">Platform Overview</p>
          <h2>Developer Dashboard</h2>
          <span>Monitor tenant labs and jump into platform control workflows.</span>
        </div>
        <Link className="developer-primary-link" href="/developer/labs/create">
          {Icons.plus}
          Create Lab
        </Link>
      </div>

      {error && <div className="developer-alert">{error}</div>}

      <div className="developer-summary-grid">
        <article className="developer-summary-card">
          <span>Total Labs</span>
          <strong>{loading ? "-" : labs.length}</strong>
        </article>
        <article className="developer-summary-card">
          <span>Active Labs</span>
          <strong>{loading ? "-" : activeLabs}</strong>
        </article>
        <article className="developer-summary-card">
          <span>Suspended Labs</span>
          <strong>{loading ? "-" : suspendedLabs}</strong>
        </article>
        <article className="developer-summary-card">
          <span>Assigned Modules</span>
          <strong>{loading ? "-" : moduleCount}</strong>
        </article>
      </div>

      <div className="developer-two-column">
        <section className="developer-panel">
          <div className="developer-panel-header">
            <h2>Recent Labs</h2>
            <p>Latest tenant labs created in the platform.</p>
          </div>
          {loading ? (
            <p className="developer-empty">Loading recent labs...</p>
          ) : recentLabs.length === 0 ? (
            <p className="developer-empty">No labs created yet.</p>
          ) : (
            <div className="developer-compact-list">
              {recentLabs.map((lab) => (
                <article key={lab.tenantId}>
                  <div>
                    <strong>{lab.name}</strong>
                    <span>{lab.tenantId} - {lab.subscriptionPlan}</span>
                  </div>
                  <small>{formatDate(lab.createdAt)}</small>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="developer-panel">
          <div className="developer-panel-header">
            <h2>Quick Actions</h2>
            <p>Common platform owner tasks.</p>
          </div>
          <div className="developer-action-grid">
            <Link href="/developer/labs/create">{Icons.plus} Create Lab</Link>
            <Link href="/developer/labs">{Icons.list} View Labs</Link>
            <Link href="/developer/modules">{Icons.grid} Manage Modules</Link>
            <Link href="/developer/system">{Icons.settings} System Config</Link>
          </div>
        </section>
      </div>
    </section>
  );
}
