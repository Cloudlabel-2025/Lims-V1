"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";

const quotaLabels = {
  patientRegistrations: "Patient registrations",
  billingRecords: "Confirmed bills",
  staffUsers: "Active staff users",
};

function formatDate(value) {
  if (!value) return "Not available";
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatPrice(value, currency = "INR") {
  if (value === null || value === undefined) return "Not set";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(value / 100);
}

function UsageCard({ quotaKey, quota }) {
  const limit = quota.unlimited ? "Unlimited" : quota.effectiveLimit;
  const percent = quota.utilizationPercent === null ? 0 : Math.min(100, quota.utilizationPercent);
  const tone = quota.overLimit ? "#dc2626" : percent >= 85 ? "#d97706" : "#0d9488";

  return (
    <article className="developer-summary-card" style={{ minHeight: 170 }}>
      <span>{quotaLabels[quotaKey] || quotaKey}</span>
      <strong>{quota.consumed} / {limit}</strong>
      <small>{quota.unlimited ? "Unlimited allowance" : `${quota.remaining} remaining`}</small>
      <div style={{ height: 8, borderRadius: 99, background: "var(--border-color)", overflow: "hidden", marginTop: 12 }}>
        <div style={{ width: `${percent}%`, height: "100%", background: tone }} />
      </div>
      <small style={{ color: tone, marginTop: 8 }}>
        {quota.overLimit ? "Would be blocked in hard mode" : `${quota.utilizationPercent ?? 0}% utilized`}
      </small>
      {quota.wouldBlockAttempts > 0 && <small>{quota.wouldBlockAttempts} shadow over-limit attempt(s)</small>}
    </article>
  );
}

export default function LabSubscriptionUsagePage({ params }) {
  const { id } = use(params);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch(`/api/developer/labs/${encodeURIComponent(id)}/subscription`, {
          credentials: "include",
          cache: "no-store",
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Unable to load subscription usage");
        if (!cancelled) setData(payload);
      } catch (loadError) {
        if (!cancelled) setError(loadError.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  return (
    <section className="developer-page">
      <div className="developer-page-actions">
        <div>
          <p className="developer-kicker">Subscription Phase 1</p>
          <h2>Usage & Entitlements</h2>
          <span>Shadow-mode measurements never block lab operations.</span>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <Link className="developer-secondary-link" href={`/developer/labs/${encodeURIComponent(id)}/edit`}>Edit Lab</Link>
          <Link className="developer-secondary-link" href="/developer/labs">Back to Labs</Link>
        </div>
      </div>

      {error && <div className="developer-alert">{error}</div>}
      {loading && <p className="developer-empty">Loading subscription usage...</p>}

      {data && (
        <>
          <section className="developer-panel">
            <div className="developer-panel-header">
              <h2>
                {data.subscription.packageName} version {data.subscription.packageReleaseVersion || data.subscription.packageVersion}
              </h2>
              <p>
                Monthly price: {formatPrice(
                  data.subscription.commercialTerms?.monthlyAmountMinor,
                  data.subscription.commercialTerms?.currency
                )} | Annual price: {formatPrice(
                  data.subscription.commercialTerms?.annualAmountMinor,
                  data.subscription.commercialTerms?.currency
                )}
              </p>
              <p>
                Status: {data.subscription.status} · Enforcement: {data.subscription.enforcementMode} · Legacy plan: {data.subscription.legacyPlan || "none"}
              </p>
              <p>
                Current period: {formatDate(data.usage.periodStart)} – {formatDate(data.usage.periodEnd)}
              </p>
            </div>
          </section>

          <div className="developer-summary-grid">
            {Object.entries(data.usage.quotas).map(([key, quota]) => (
              <UsageCard key={key} quotaKey={key} quota={quota} />
            ))}
          </div>

          <section className="developer-panel">
            <div className="developer-panel-header">
              <h2>Effective Entitlements</h2>
              <p>Modules and features stored in the assigned package snapshot.</p>
            </div>
            <p><strong>Modules:</strong> {data.subscription.entitlements.modules.join(", ")}</p>
            <p><strong>Features:</strong> {data.subscription.entitlements.features.join(", ") || "None"}</p>
          </section>

          <section className="developer-panel">
            <div className="developer-panel-header">
              <h2>Recent Usage Events</h2>
              <p>Immutable patient and confirmed-billing measurements.</p>
            </div>
            {data.recentEvents.length === 0 ? (
              <p className="developer-empty">No usage events recorded for this lab yet.</p>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {data.recentEvents.map((event) => (
                  <article key={event.id} style={{ border: "1px solid var(--border-color)", borderRadius: 12, padding: 14 }}>
                    <strong>{quotaLabels[event.quotaKey] || event.quotaKey}: {event.consumedBefore} → {event.consumedAfter}</strong>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", color: "var(--text-muted)", fontSize: 13 }}>
                      <span>{event.type}</span>
                      <span>{formatDate(event.occurredAt)}</span>
                      <span>{event.actorEmail || "System"}</span>
                      {event.wouldExceedLimit && <span style={{ color: "#dc2626" }}>Would block in hard mode</span>}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}
