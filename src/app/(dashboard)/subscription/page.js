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

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
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
  const [guiltTripOpen, setGuiltTripOpen] = useState(false);
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
      
      const { request } = payload;
      const { id: upgradeRequestId, rzpOrderId, amount, keyId } = request;

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error("Failed to load Razorpay SDK. Please check your internet connection.");
      }

      const options = {
        key: keyId,
        amount: amount,
        currency: "INR",
        name: "LIMS Plan Upgrade",
        description: `Upgrade to ${selectedUpgradePlan?.name || "Premium Plan"}`,
        order_id: rzpOrderId,
        handler: async function (paymentResponse) {
          setRequesting(true);
          try {
            const confirmRes = await fetch("/api/subscription/confirm", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                upgradeRequestId,
                razorpayOrderId: paymentResponse.razorpay_order_id,
                razorpayPaymentId: paymentResponse.razorpay_payment_id,
                razorpaySignature: paymentResponse.razorpay_signature,
              }),
            });
            const confirmPayload = await confirmRes.json();
            if (!confirmRes.ok) throw new Error(confirmPayload.error || "Payment verification failed");

            setNotice(confirmPayload.message);
            setUpgradeOpen(false);
            setSelectedPlanKey("");
            window.location.reload();
          } catch (err) {
            setUpgradeError(err.message);
          } finally {
            setRequesting(false);
          }
        },
        theme: {
          color: "var(--primary)",
        },
        modal: {
          ondismiss: function () {
            setRequesting(false);
          }
        }
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.open();
    } catch (requestError) {
      setUpgradeError(requestError.message);
      setUpgradeOpen(true);
      setRequesting(false);
    }
  }

  async function cancelUpgradeRequest() {
    setRequesting(true);
    setNotice("");
    try {
      const response = await fetch("/api/subscription", {
        method: "DELETE",
        credentials: "include",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to cancel request");
      
      setNotice(payload.message);
      setData((current) => ({ ...current, pendingUpgrade: null }));
    } catch (err) {
      setNotice("");
      alert(err.message);
    } finally {
      setRequesting(false);
    }
  }

  const [addonLoading, setAddonLoading] = useState(false);
  const [addonConfirmOpen, setAddonConfirmOpen] = useState(false);
  const [selectedQuotaKey, setSelectedQuotaKey] = useState("");
  const [addonSuccessMessage, setAddonSuccessMessage] = useState("");
  const [addonError, setAddonError] = useState("");
  const addonsConfig = data?.addons || {
    patientRegistrations: { units: 100, priceMinor: 10000 },
    billingRecords: { units: 250, priceMinor: 12500 },
    staffUsers: { units: 1, priceMinor: 20000 },
  };

  const currentCurrency = data?.subscription?.pricing?.currency || "INR";

  const addonPacks = {
    patientRegistrations: { 
      units: addonsConfig.patientRegistrations.units,
      cost: formatMoney(addonsConfig.patientRegistrations.priceMinor, currentCurrency) 
    },
    billingRecords: { 
      units: addonsConfig.billingRecords.units,
      cost: formatMoney(addonsConfig.billingRecords.priceMinor, currentCurrency) 
    },
    staffUsers: { 
      units: addonsConfig.staffUsers.units,
      cost: formatMoney(addonsConfig.staffUsers.priceMinor, currentCurrency) 
    },
  };

  function handleBuyAddon(quotaKey) {
    setSelectedQuotaKey(quotaKey);
    setAddonSuccessMessage("");
    setAddonError("");
    setAddonConfirmOpen(true);
  }

  useEffect(() => {
    if (!loading && data) {
      const params = new URLSearchParams(window.location.search);
      const buyKey = params.get("buy");
      if (buyKey && ["patientRegistrations", "billingRecords", "staffUsers"].includes(buyKey)) {
        handleBuyAddon(buyKey);
        const newUrl = window.location.pathname;
        window.history.replaceState({}, "", newUrl);
      }
    }
  }, [loading, data]);

  async function executeAddonPurchase(quotaKey) {
    setAddonLoading(true);
    setAddonError("");
    try {
      const response = await fetch("/api/subscription/addon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ quotaKey }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to request add-on");

      const { request } = payload;
      const { id: addonRequestId, rzpOrderId, amount, keyId, label } = request;

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error("Failed to load Razorpay SDK. Please check your internet connection.");
      }

      const options = {
        key: keyId,
        amount: amount,
        currency: "INR",
        name: "LIMS Quota Add-on",
        description: `Add-on purchase: ${label}`,
        order_id: rzpOrderId,
        handler: async function (paymentResponse) {
          try {
            const confirmRes = await fetch("/api/subscription/addon/confirm", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                addonRequestId,
                razorpayOrderId: paymentResponse.razorpay_order_id,
                razorpayPaymentId: paymentResponse.razorpay_payment_id,
                razorpaySignature: paymentResponse.razorpay_signature,
              }),
            });
            const confirmPayload = await confirmRes.json();
            if (!confirmRes.ok) throw new Error(confirmPayload.error || "Payment verification failed");

            setAddonSuccessMessage(confirmPayload.message);
          } catch (err) {
            setAddonError(err.message);
          } finally {
            setAddonLoading(false);
          }
        },
        theme: {
          color: "var(--primary)",
        },
        modal: {
          ondismiss: function () {
            setAddonLoading(false);
          }
        }
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.open();
    } catch (err) {
      setAddonError(err.message);
      setAddonLoading(false);
    }
  }

  if (loading) return <section className="module-page"><div className="module-card subscription-tenant-state">Loading subscription...</div></section>;
  if (error) return <section className="module-page"><div className="lims-alert error">{error}</div></section>;

  const { subscription, usage, upgradePlans = [], pendingUpgrade, addOnHistory = [] } = data;
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
        <div className="tenant-upgrade-pending" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <strong>{pendingUpgrade.packageName} Version 1 requested</strong>
            <span>Submitted {formatDate(pendingUpgrade.requestedAt)}. Your current package remains active until the request is approved.</span>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-outline-danger"
            style={{ color: "#ef4444", borderColor: "#ef4444", backgroundColor: "transparent", padding: "4px 10px", fontSize: "12px", borderRadius: "4px", fontWeight: "600" }}
            onClick={cancelUpgradeRequest}
            disabled={requesting}
          >
            {requesting ? "Cancelling..." : "Cancel Request"}
          </button>
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
                    <span>{quotaDescriptions[key] || "Package usage allowance"} (Add-on: +{addonPacks[key]?.units} Pack)</span>
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
                      <div className="tenant-capacity-foot" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span>{quota.remaining} available</span>
                        <span>{tone === "critical" ? "Limit reached" : tone === "warning" ? "Approaching limit" : "Within allowance"}</span>
                      </div>
                      <div style={{ marginTop: "8px", textAlign: "right" }}>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          style={{
                            fontSize: "11px",
                            padding: "2px 8px",
                            color: "var(--primary)",
                            borderColor: "var(--primary)",
                            backgroundColor: "transparent",
                            borderRadius: "4px",
                            fontWeight: "500",
                            cursor: "pointer"
                          }}
                          onClick={() => handleBuyAddon(key)}
                          disabled={addonLoading}
                        >
                          {addonLoading ? "Processing..." : `Buy Add-on (${addonPacks[key]?.cost || ""})`}
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        {addOnHistory.length > 0 && (
          <section className="module-card" style={{ marginTop: "24px", padding: "24px" }}>
            <header style={{ marginBottom: "16px", display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Transaction History
              </span>
              <h2 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-primary)", margin: 0 }}>
                Capacity Add-ons
              </h2>
            </header>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: "var(--surface)", borderBottom: "1px solid var(--border-light)" }}>
                    {["Date", "Resource", "Pack size", "Level change", "Cost", "Expiry"].map((h) => (
                      <th key={h} style={{ padding: "10px 12px", textAlign: "left", color: "var(--text-secondary)", fontWeight: "600" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {addOnHistory.map((item) => (
                    <tr key={item.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                      <td style={{ padding: "12px 12px", color: "var(--text-primary)", whiteSpace: "nowrap" }}>
                        {new Date(item.purchasedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td style={{ padding: "12px 12px", fontWeight: "600", color: "var(--text-primary)" }}>
                        {quotaLabels[item.quotaKey] || item.quotaKey}
                      </td>
                      <td style={{ padding: "12px 12px", color: "var(--primary)", fontWeight: "700" }}>
                        {item.quotaKey === "patientRegistrations" ? "+100" : item.quotaKey === "billingRecords" ? "+250" : "+1"}
                      </td>
                      <td style={{ padding: "12px 12px", color: "var(--text-secondary)" }}>
                        {item.initialLimit !== undefined && item.newLimit !== undefined ? (
                          <span>{item.initialLimit} → <strong>{item.newLimit}</strong></span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td style={{ padding: "12px 12px", fontWeight: "700", color: "var(--text-primary)" }}>
                        {formatMoney(item.amountMinor, "INR")}
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
          </section>
        )}

        <aside className="tenant-account-sidebar">
          <section className="module-card tenant-entitlements-panel">
            <header>
              <span>Service entitlements</span>
              <strong>{subscription.modules.length} modules</strong>
            </header>
            <div className="tenant-entitlement-list">
              {subscription.modules.map((moduleId) => {
                const supportsDelete = ["patients", "accounts", "doctors", "billing", "reports", "samples", "tests"].includes(moduleId);
                const feats = subscription.features || [];
                const hasFullDelete = feats.includes("record-deletion:all") || feats.includes(`record-deletion:${moduleId}`);
                const has5MinDelete = feats.includes("record-deletion") || feats.includes("record-deletion:5min");

                return (
                  <div key={moduleId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <i>✓</i>
                      <span>{moduleNameById.get(moduleId) || moduleId}</span>
                    </div>
                    {supportsDelete && (
                      hasFullDelete ? (
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "#166534", backgroundColor: "#dcfce7", padding: "2px 8px", borderRadius: "12px" }}>
                          🔓 Full Delete
                        </span>
                      ) : has5MinDelete ? (
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "#92400e", backgroundColor: "#fef3c7", padding: "2px 8px", borderRadius: "12px" }}>
                          ⏱️ 5m Delete
                        </span>
                      ) : (
                        <span style={{ fontSize: "11px", color: "#64748b", backgroundColor: "#f1f5f9", padding: "2px 8px", borderRadius: "12px" }}>
                          No Delete
                        </span>
                      )
                    )}
                  </div>
                );
              })}
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
                return (
                  <button
                    type="button"
                    className={`tenant-upgrade-plan ${selected ? "selected" : ""} ${current ? "current" : ""}`}
                    key={plan.key}
                    disabled={current}
                    aria-pressed={selected}
                    onClick={() => setSelectedPlanKey(plan.key)}
                  >
                    <span className="tenant-upgrade-plan-heading">
                      <span><strong>{plan.name}</strong><small>Version 1</small></span>
                      {current && <em>Current</em>}
                      {plan.isDowngrade && <em className="downgrade" style={{ backgroundColor: "#ef4444", color: "#fff", padding: "2px 6px", borderRadius: "4px", fontSize: "10px", textTransform: "none", fontStyle: "normal" }}>Downgrade</em>}
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
              <button
                type="button"
                className="tenant-upgrade-submit"
                disabled={!selectedPlanKey || requesting}
                onClick={() => {
                  if (selectedUpgradePlan?.isDowngrade) {
                    setUpgradeOpen(false);
                    setGuiltTripOpen(true);
                  } else {
                    requestUpgrade();
                  }
                }}
              >
                {requesting ? "Submitting..." : "Confirm selection"}
              </button>
            </footer>
          </section>
        </div>
      )}

      {guiltTripOpen && selectedUpgradePlan && (
        <div className="tenant-upgrade-modal" role="dialog" aria-modal="true" style={{ zIndex: 1100 }}>
          <button type="button" className="tenant-upgrade-backdrop" onClick={() => setGuiltTripOpen(false)} />
          <section className="tenant-upgrade-dialog" style={{ maxWidth: "500px", border: "2px solid #ef4444" }}>
            <header className="tenant-upgrade-dialog-header" style={{ borderBottom: "1px solid var(--border-light)" }}>
              <div style={{ textAlign: "center", width: "100%" }}>
                <span style={{ fontSize: "40px" }}>😢</span>
                <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#ef4444", marginTop: "10px" }}>Are you sure you want to break their hearts?</h2>
                <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "4px" }}>
                  Your patients and staff will miss the premium superpowers of <strong>{subscription.packageName}</strong>.
                </p>
              </div>
            </header>

            <div style={{ padding: "20px" }}>
              <h4 style={{ fontSize: "14px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: "12px", textAlign: "center" }}>
                What you will lose by degrading to {selectedUpgradePlan.name}:
              </h4>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px", background: "var(--surface)", borderRadius: "6px" }}>
                  <span style={{ fontSize: "20px" }}>📉</span>
                  <div style={{ textAlign: "left" }}>
                    <strong style={{ fontSize: "13px", display: "block" }}>Drastic Quota Reductions</strong>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)", display: "block" }}>
                      Your monthly patient registrations allowance drops to <strong>{selectedUpgradePlan.quotas?.patientRegistrations || "Unlimited"}</strong> (down from {subscription.pricing?.patientRegistrations || "5,000"}).
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px", background: "var(--surface)", borderRadius: "6px" }}>
                  <span style={{ fontSize: "20px" }}>🔒</span>
                  <div style={{ textAlign: "left" }}>
                    <strong style={{ fontSize: "13px", display: "block" }}>Disabled Doctor & Patient Portals</strong>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)", display: "block" }}>
                      Portals, custom branding, and online report downloading will be locked for your referring doctors and patients.
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px", background: "var(--surface)", borderRadius: "6px" }}>
                  <span style={{ fontSize: "20px" }}>💔</span>
                  <div style={{ textAlign: "left" }}>
                    <strong style={{ fontSize: "13px", display: "block" }}>Staff Member lockouts</strong>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)", display: "block" }}>
                      Active accounts limit reduces to <strong>{selectedUpgradePlan.quotas?.staffUsers || "Unlimited"}</strong>. Some staff members might lose dashboard access.
                    </span>
                  </div>
                </div>
              </div>
              
              <p style={{ fontStyle: "italic", fontSize: "12px", color: "#ef4444", marginTop: "20px", textAlign: "center", lineHeight: "1.4" }}>
                &quot;Portals keep referring labs and doctors connected. Downgrading might slow down your business growth...&quot;
              </p>
            </div>

            <footer className="tenant-upgrade-dialog-footer" style={{ borderTop: "1px solid var(--border-light)", display: "flex", flexDirection: "column", gap: "10px", padding: "20px" }}>
              <button 
                type="button" 
                className="tenant-upgrade-submit w-100" 
                style={{ height: "45px", fontWeight: "700", backgroundColor: "var(--primary)", color: "#fff", border: "none" }}
                onClick={() => {
                  setGuiltTripOpen(false);
                  setUpgradeOpen(true);
                }}
              >
                Nevermind, keep my Premium plan!
              </button>
              <button 
                type="button" 
                className="tenant-upgrade-cancel w-100" 
                style={{ color: "#ef4444", borderColor: "#ef4444", fontSize: "12px", fontWeight: "600", border: "1px solid #ef4444", background: "transparent" }}
                onClick={() => {
                  setGuiltTripOpen(false);
                  requestUpgrade();
                }}
              >
                Yes, degrade my plan anyway 💔
              </button>
            </footer>
          </section>
        </div>
      )}
      {addonConfirmOpen && selectedQuotaKey && (
        <div className="tenant-upgrade-modal" role="dialog" aria-modal="true" style={{ zIndex: 1100 }}>
          <button type="button" className="tenant-upgrade-backdrop" aria-label="Close" onClick={() => setAddonConfirmOpen(false)} />
          <section className="tenant-upgrade-dialog" style={{ maxWidth: "480px", width: "100%", margin: "0 auto" }}>
            {addonSuccessMessage ? (
              <div style={{ padding: "32px 24px", textAlign: "center" }}>
                <div style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "50%",
                  backgroundColor: "#dcfce7",
                  color: "#15803d",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "28px",
                  fontWeight: "bold",
                  margin: "0 auto 16px"
                }}>
                  ✓
                </div>
                <h2 style={{ fontSize: "20px", color: "var(--text)", margin: "0 0 8px" }}>Capacity Added</h2>
                <p style={{ fontSize: "14px", color: "var(--text-secondary)", margin: "0 0 24px", lineHeight: 1.5 }}>
                  {addonSuccessMessage}
                </p>
                <button
                  type="button"
                  className="tenant-upgrade-submit"
                  onClick={() => {
                    setAddonConfirmOpen(false);
                    setAddonSuccessMessage("");
                    window.location.reload();
                  }}
                  style={{ minHeight: "40px", width: "100%", fontWeight: "700", padding: "8px 16px", borderRadius: "8px", fontSize: "13px", cursor: "pointer" }}
                >
                  Continue
                </button>
              </div>
            ) : (
              <>
                <header className="tenant-upgrade-dialog-header" style={{ padding: "20px 24px 14px", borderBottom: "1px solid var(--border-light)" }}>
                  <div>
                    <span className="tenant-subscription-eyebrow">Capacity Add-on</span>
                    <h2 style={{ fontSize: "19px", margin: "4px 0", color: "var(--text)" }}>Confirm Purchase</h2>
                    <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "12px" }}>Add capacity to your laboratory workspace immediately.</p>
                  </div>
                  <button type="button" className="tenant-upgrade-close" onClick={() => setAddonConfirmOpen(false)} aria-label="Close">×</button>
                </header>

                <div style={{ padding: "20px 24px" }}>
                  {addonError && (
                    <div className="lims-alert error" style={{ marginBottom: "16px" }}>
                      {addonError}
                    </div>
                  )}
                  <div style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                    padding: "16px",
                    border: "1px solid var(--border-light)",
                    borderRadius: "12px",
                    backgroundColor: "var(--surface)",
                    marginBottom: "20px"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "13px", color: "var(--text-secondary)", fontWeight: "600" }}>Resource</span>
                      <strong style={{ fontSize: "14px", color: "var(--text)" }}>{quotaLabels[selectedQuotaKey]}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "13px", color: "var(--text-secondary)", fontWeight: "600" }}>Add-on Pack</span>
                      <strong style={{ fontSize: "14px", color: "var(--primary)" }}>
                        {selectedQuotaKey === "patientRegistrations" ? `+${addonPacks.patientRegistrations.units} Patients` : selectedQuotaKey === "billingRecords" ? `+${addonPacks.billingRecords.units} Bills` : `+${addonPacks.staffUsers.units} Staff User`}
                      </strong>
                    </div>
                    <div style={{ height: "1px", backgroundColor: "var(--border-light)", margin: "4px 0" }} />
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "14px", color: "var(--text)", fontWeight: "700" }}>Total Cost</span>
                      <strong style={{ fontSize: "18px", color: "var(--primary)", fontWeight: "850" }}>{addonPacks[selectedQuotaKey]?.cost}</strong>
                    </div>
                  </div>
                  <p style={{ margin: 0, fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                    Secure payment will be processed via Razorpay. Once payment is successful, your resource capacity will be updated instantly.
                  </p>
                </div>

                <footer className="tenant-upgrade-dialog-footer" style={{ padding: "14px 24px 20px", borderTop: "1px solid var(--border-light)" }}>
                  <button
                    type="button"
                    className="tenant-upgrade-cancel"
                    onClick={() => setAddonConfirmOpen(false)}
                    disabled={addonLoading}
                    style={{ minHeight: "38px", padding: "8px 16px", borderRadius: "8px", fontSize: "12px", cursor: "pointer", fontWeight: "700" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="tenant-upgrade-submit"
                    onClick={() => executeAddonPurchase(selectedQuotaKey)}
                    disabled={addonLoading}
                    style={{ minHeight: "38px", padding: "8px 16px", borderRadius: "8px", fontSize: "12px", cursor: "pointer", fontWeight: "700" }}
                  >
                    {addonLoading ? "Processing..." : "Pay Now"}
                  </button>
                </footer>
              </>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
