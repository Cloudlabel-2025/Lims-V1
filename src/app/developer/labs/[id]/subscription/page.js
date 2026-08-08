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
              <h2>Capacity Add-on Purchases</h2>
              <p>Approved and pending quota packages purchased by the lab.</p>
            </div>
            {!data.addOnHistory || data.addOnHistory.length === 0 ? (
              <p className="developer-empty">No capacity add-ons purchased by this lab yet.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ background: "var(--border-color)", borderBottom: "1px solid var(--border-color)", textAlign: "left" }}>
                      {["Date", "Resource", "Pack size", "Level change", "Cost", "Requested By", "Status", "Expiry"].map((h) => (
                        <th key={h} style={{ padding: "10px 12px", color: "var(--text-secondary)", fontWeight: "600" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.addOnHistory.map((item) => (
                      <tr key={item.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                        <td style={{ padding: "12px 12px", whiteSpace: "nowrap" }}>
                          {new Date(item.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </td>
                        <td style={{ padding: "12px 12px", fontWeight: "600" }}>
                          {quotaLabels[item.quotaKey] || item.quotaKey}
                        </td>
                        <td style={{ padding: "12px 12px", color: "#0d9488", fontWeight: "700" }}>
                          {item.quotaKey === "patientRegistrations" ? "+100" : item.quotaKey === "billingRecords" ? "+250" : "+1"}
                        </td>
                        <td style={{ padding: "12px 12px" }}>
                          {item.initialLimit !== undefined && item.newLimit !== undefined ? (
                            <span>{item.initialLimit} → <strong>{item.newLimit}</strong></span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td style={{ padding: "12px 12px", fontWeight: "700" }}>
                          {formatPrice(item.amountMinor)}
                        </td>
                        <td style={{ padding: "12px 12px", color: "var(--text-muted)" }}>
                          {item.requestedByEmail || "—"}
                        </td>
                        <td style={{ padding: "12px 12px" }}>
                          <span style={{
                            padding: "2px 8px",
                            borderRadius: "12px",
                            fontSize: "11px",
                            fontWeight: "700",
                            backgroundColor: item.status === "approved" ? "#dcfce7" : item.status === "pending" ? "#fef3c7" : "#fee2e2",
                            color: item.status === "approved" ? "#166534" : item.status === "pending" ? "#92400e" : "#991b1b",
                          }}>
                            {item.status}
                          </span>
                        </td>
                        <td style={{ padding: "12px 12px", color: item.expiresAt ? "#d97706" : "var(--text-muted)", fontWeight: "500" }}>
                          {item.expiresAt ? (
                            new Date(item.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
                          ) : (
                            <span style={{ color: "#166534", backgroundColor: "#dcfce7", padding: "2px 8px", borderRadius: "12px", fontSize: "11px" }}>Permanent</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
