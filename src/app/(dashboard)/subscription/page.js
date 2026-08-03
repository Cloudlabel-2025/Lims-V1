"use client";

import { useEffect, useMemo, useState } from "react";
import { availableLabModules } from "@/app/lib/modules";

const quotaLabels = {
  patientRegistrations: "Patient registrations",
  billingRecords: "Billing records",
  staffUsers: "Staff users",
};

const quotaDescriptions = {
  patientRegistrations: "Patient records created during this billing period",
  billingRecords: "Invoices and billing records generated this period",
  staffUsers: "Active staff accounts with access to this workspace",
};

function formatDate(value) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

function formatMoney(minor, currency = "INR") {
  if (minor === null || minor === undefined) return "Not set";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(minor / 100);
}

export default function SubscriptionPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [selectedPlanKey, setSelectedPlanKey] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [notice, setNotice] = useState("");
  const [upgradeError, setUpgradeError] = useState("");
  const moduleNameById = useMemo(() => new Map(availableLabModules.map((item) => [item.id, item.label])), []);

  useEffect(() => {
    let cancelled = false;
    async function loadSubscription() {
      try {
        const response = await fetch("/api/subscription", { credentials: "include", cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Unable to load subscription");
        if (!cancelled) setData(payload);
      } catch (loadError) {
        if (!cancelled) setError(loadError.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadSubscription();
    return () => { cancelled = true; };
  }, []);

  async function requestUpgrade() {
    if (!selectedPlanKey) return;
    setRequesting(true);
    setUpgradeError("");
    try {
      const response = await fetch("/api/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ packageKey: selectedPlanKey }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to request upgrade");
      setData((current) => ({ ...current, pendingUpgrade: payload.request }));
      setNotice(payload.message);
      setUpgradeOpen(false);
      setSelectedPlanKey("");
    } catch (requestError) {
      setUpgradeError(requestError.message);
    } finally {
      setRequesting(false);
    }
  }

  if (loading) return <section className="module-page"><div className="module-card subscription-tenant-state">Loading subscription...</div></section>;
  if (error) return <section className="module-page"><div className="lims-alert error">{error}</div></section>;

  const { subscription, usage, upgradePlans = [], pendingUpgrade } = data;
  const currency = subscription.pricing?.currency || "INR";
  const selectedUpgradePlan = upgradePlans.find((plan) => plan.key === selectedPlanKey);
  const statusLabel = subscription.status.replaceAll("_", " ");

  return (
    <section className="module-page tenant-subscription-page">
      <section className="tenant-account-hero">
        <div className="tenant-account-hero-inner">
          <div className="tenant-account-identity">
            <span className="tenant-subscription-eyebrow">Account management</span>
            <div className="tenant-account-title-row">
              <h1>{subscription.packageName}</h1>
              {subscription.releaseVersion && <span className="tenant-plan-version">Version {subscription.releaseVersion}</span>}
            </div>
            <div className="tenant-account-facts">
              <div>
                <small>Service status</small>
                <strong className={`tenant-service-state status-${subscription.status}`}><i />{statusLabel}</strong>
              </div>
              <div>
                <small>Monthly fee</small>
                <strong>{formatMoney(subscription.pricing?.monthlyAmountMinor, currency)}</strong>
              </div>
              <div>
                <small>Annual commitment</small>
                <strong>{formatMoney(subscription.pricing?.annualAmountMinor, currency)}</strong>
              </div>
            </div>
          </div>
          <div className="tenant-account-actions">
            <button type="button" className="tenant-upgrade-button" onClick={() => { setUpgradeError(""); setNotice(""); setUpgradeOpen(true); }} disabled={Boolean(pendingUpgrade)}>
              {pendingUpgrade ? "Upgrade request pending" : "Manage subscription"}
            </button>
            <span>Usage period</span>
            <strong>{formatDate(subscription.periodStart)} – {formatDate(subscription.periodEnd)}</strong>
            <small>Allowances reset at the start of the next period.</small>
          </div>
        </div>
      </section>

      {notice && <div className="lims-alert success">{notice}</div>}
      {pendingUpgrade && (
        <div className="tenant-upgrade-pending">
          <strong>{pendingUpgrade.packageName} Version 1 requested</strong>
          <span>Submitted {formatDate(pendingUpgrade.requestedAt)}. Your current package remains active until the request is approved.</span>
        </div>
      )}

      <div className="tenant-corporate-layout">
        <section className="module-card tenant-capacity-panel">
          <header className="tenant-corporate-panel-header">
            <div>
              <h2>Capacity &amp; resource utilization</h2>
              <p>Current consumption against the allowances in your package.</p>
            </div>
            <span>Current period</span>
          </header>
          <div className="tenant-capacity-list">
            {Object.entries(usage?.quotas || {}).map(([key, quota]) => {
              const percent = quota.unlimited ? 0 : Math.min(100, quota.utilizationPercent || 0);
              const tone = quota.remaining <= 0 ? "critical" : percent >= 90 ? "warning" : percent >= 80 ? "attention" : "healthy";
              return (
                <article className={`tenant-capacity-row ${tone}`} key={key}>
                  <div className="tenant-capacity-label">
                    <strong>{quotaLabels[key] || key}</strong>
                    <span>{quotaDescriptions[key] || "Package usage allowance"}</span>
                  </div>
                  {quota.unlimited ? (
                    <div className="tenant-capacity-unlimited">
                      <strong>Unlimited</strong>
                      <span>{quota.consumed || 0} currently active</span>
                    </div>
                  ) : (
                    <div className="tenant-capacity-metric">
                      <div className="tenant-capacity-values">
                        <strong>{quota.consumed} <span>/ {quota.effectiveLimit} used</span></strong>
                        <span>{quota.utilizationPercent || 0}%</span>
                      </div>
                      <div className="tenant-usage-track"><span style={{ width: `${percent}%` }} /></div>
                      <div className="tenant-capacity-foot">
                        <span>{quota.remaining} available</span>
                        <span>{tone === "critical" ? "Limit reached" : tone === "warning" ? "Approaching limit" : "Within allowance"}</span>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        <aside className="tenant-account-sidebar">
          <section className="module-card tenant-entitlements-panel">
            <header>
              <span>Service entitlements</span>
              <strong>{subscription.modules.length} modules</strong>
            </header>
            <div className="tenant-entitlement-list">
              {subscription.modules.map((moduleId) => (
                <div key={moduleId}><i>✓</i><span>{moduleNameById.get(moduleId) || moduleId}</span></div>
              ))}
            </div>
          </section>
          <section className="tenant-account-support">
            <span>Account support</span>
            <h2>Need additional capacity?</h2>
            <p>Request a higher package for more usage allowance and service modules. Your current service remains active during review.</p>
            <button type="button" onClick={() => { setUpgradeError(""); setNotice(""); setUpgradeOpen(true); }} disabled={Boolean(pendingUpgrade)}>
              {pendingUpgrade ? "Request under review" : "Review available packages"}
            </button>
          </section>
        </aside>
      </div>

      {upgradeOpen && (
        <div className="tenant-upgrade-modal" role="dialog" aria-modal="true" aria-labelledby="upgrade-plan-title">
          <button type="button" className="tenant-upgrade-backdrop" aria-label="Close upgrade plans" onClick={() => setUpgradeOpen(false)} />
          <section className="tenant-upgrade-dialog">
            <header className="tenant-upgrade-dialog-header">
              <div>
                <span className="tenant-subscription-eyebrow">Subscription management</span>
                <h2 id="upgrade-plan-title">Package upgrade workspace</h2>
                <p>Compare approved Version 1 packages and submit a change for administrative review.</p>
              </div>
              <button type="button" className="tenant-upgrade-close" onClick={() => setUpgradeOpen(false)} aria-label="Close">×</button>
            </header>

            <div className="tenant-upgrade-plan-grid">
              {upgradePlans.length === 0 && <div className="tenant-upgrade-empty">No Version 1 upgrade packages are currently available.</div>}
              {upgradePlans.map((plan) => {
                const current = plan.key === subscription.packageKey;
                const selected = plan.key === selectedPlanKey;
                const unavailable = !current && !plan.canUpgrade;
                return (
                  <button
                    type="button"
                    className={`tenant-upgrade-plan ${selected ? "selected" : ""} ${current ? "current" : ""}`}
                    key={plan.key}
                    disabled={current || unavailable}
                    aria-pressed={selected}
                    onClick={() => setSelectedPlanKey(plan.key)}
                  >
                    <span className="tenant-upgrade-plan-heading">
                      <span><strong>{plan.name}</strong><small>Version 1</small></span>
                      {current && <em>Current</em>}
                      {unavailable && <em className="unavailable">Lower plan</em>}
                      {selected && <em className="selected">Selected</em>}
                    </span>
                    <span className="tenant-upgrade-plan-prices">
                      <span>
                        <small>Monthly</small>
                        <strong>{formatMoney(plan.pricing?.monthlyAmountMinor, plan.pricing?.currency || "INR")}</strong>
                        <em>per month</em>
                      </span>
                      <span>
                        <small>Annual</small>
                        <strong>{formatMoney(plan.pricing?.annualAmountMinor, plan.pricing?.currency || "INR")}</strong>
                        <em>per year</em>
                      </span>
                    </span>
                    <span className="tenant-upgrade-plan-description">{plan.description || "Professional LIMS subscription package"}</span>
                    <span className="tenant-upgrade-plan-quotas">
                      <span><small>Patients</small><strong>{plan.quotas?.patientRegistrations ?? "Unlimited"}</strong></span>
                      <span><small>Bills</small><strong>{plan.quotas?.billingRecords ?? "Unlimited"}</strong></span>
                      <span><small>Staff</small><strong>{plan.quotas?.staffUsers ?? "Unlimited"}</strong></span>
                    </span>
                    <span className="tenant-upgrade-plan-modules"><i>✓</i>{plan.modules.length} included service modules</span>
                  </button>
                );
              })}
            </div>

            {upgradeError && <div className="lims-alert error tenant-upgrade-error">{upgradeError}</div>}
            <div className="tenant-upgrade-approval-note">
              <strong>Administrative approval required</strong>
              <span>Your current package remains active without interruption until the requested change is approved.</span>
            </div>
            <footer className="tenant-upgrade-dialog-footer">
              <div className="tenant-upgrade-selection-summary">
                <span>{selectedUpgradePlan ? "Selected package" : "No package selected"}</span>
                {selectedUpgradePlan && <strong>{selectedUpgradePlan.name} · Version 1</strong>}
              </div>
              <button type="button" className="tenant-upgrade-cancel" onClick={() => setUpgradeOpen(false)}>Dismiss</button>
              <button type="button" className="tenant-upgrade-submit" disabled={!selectedPlanKey || requesting} onClick={requestUpgrade}>
                {requesting ? "Submitting..." : "Confirm selection"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </section>
  );
}
