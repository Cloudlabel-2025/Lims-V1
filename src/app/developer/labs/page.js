"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { defaultLabModules } from "@/app/lib/modules";
import { Icons } from "@/app/components/Icons";

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

  useEffect(() => {
    let cancelled = false;

    async function loadLabs() {
      try {
        const response = await fetch("/api/developer/labs", { credentials: "include" });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Unable to load labs");
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

  async function copyLoginUrl(loginUrl) {
    if (!loginUrl) return;

    try {
      await navigator.clipboard.writeText(loginUrl);
      setCopiedLoginUrl(loginUrl);
      window.setTimeout(() => {
        setCopiedLoginUrl((current) => (current === loginUrl ? "" : current));
      }, 1800);
    } catch {
      setError("Unable to copy login link. Please copy it manually.");
    }
  }

  function openLoginUrl(lab) {
    window.open(getActiveLabLoginUrl(lab), "_blank", "noopener,noreferrer");
  }

  const activeLabs = labs.filter((lab) => lab.status === "active").length;
  const suspendedLabs = labs.filter((lab) => lab.status === "suspended").length;

  return (
    <section className="developer-page">
      <div className="developer-page-actions">
        <div>
          <p className="developer-kicker">Lab Management</p>
          <h2>Created Labs</h2>
          <span>Review tenant labs, login URLs, modules, status, and plan details.</span>
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
          <strong>{labs.length}</strong>
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
        ) : labs.length === 0 ? (
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
            {labs.map((lab) => {
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
                  </div>
                  <div className="developer-link-actions">
                    <button type="button" onClick={() => openLoginUrl(lab)}>
                      Open
                    </button>
                    <button type="button" onClick={() => copyLoginUrl(loginUrl)}>
                      {copiedLoginUrl === loginUrl ? "Copied" : "Copy Link"}
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
