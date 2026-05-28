"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Icons } from "@/app/components/Icons";
import { hasPermission } from "@/app/lib/client-rbac";
import { cachedJsonFetch, clearCachedApi, useCurrentUser } from "@/app/lib/use-current-user";

const CreateBillTab = dynamic(() => import("./CreateBillTab"), {
  ssr: false,
  loading: () => <div className="module-panel">Loading bill form...</div>,
});
const BillingHistoryTab = dynamic(() => import("./BillingHistoryTab"), {
  ssr: false,
  loading: () => <div className="module-panel">Loading billing history...</div>,
});
const SettlementModal = dynamic(() => import("./SettlementModal"), {
  ssr: false,
  loading: () => null,
});

export default function BillingPage() {
  const user = useCurrentUser();
  const [activeTab, setActiveTab] = useState("pending");
  const [patients, setPatients] = useState([]);
  const [tests, setTests] = useState([]);
  const [packages, setPackages] = useState([]);
  const [billingRecords, setBillingRecords] = useState([]);
  const [patient, setPatient] = useState("");
  const [selectedTests, setSelectedTests] = useState([]);
  const [priority, setPriority] = useState("routine");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState("");
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [selectedBillingRecord, setSelectedBillingRecord] = useState(null);
  const [payment, setPayment] = useState({ cash: 0, card: 0, online: 0 });
  const [results, setResults] = useState({}); // { [billingItemId]: { [paramKey]: value } }
  const [testDetails, setTestDetails] = useState({}); // { [testDefId]: parameters }

  const pendingBills = useMemo(
    () => billingRecords.filter((billingRecord) => billingRecord.billingStatus !== "paid"),
    [billingRecords]
  );
  
  const selectedTotal = useMemo(() => {
    let total = 0;
    selectedTests.forEach(itemKey => {
      if (itemKey.startsWith("test_")) {
        const t = tests.find(t => t._id === itemKey.replace("test_", ""));
        total += Number(t?.price || 0);
      } else if (itemKey.startsWith("pkg_")) {
        const p = packages.find(p => p._id === itemKey.replace("pkg_", ""));
        total += Number(p?.price || 0);
      }
    });
    return total;
  }, [tests, packages, selectedTests]);
  const investigationOptions = useMemo(
    () => [
      ...packages.map((pkg) => ({ value: `pkg_${pkg._id}`, label: pkg.name, sublabel: `Package · ₹${pkg.price}` })),
      ...tests.map((test) => ({ value: `test_${test._id}`, label: test.name, sublabel: `${test.category?.name} · ₹${test.price}` })),
    ],
    [packages, tests]
  );

  const canCreateBilling = hasPermission(user, "billing.create");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [patientRes, testRes, pkgRes, billingRes] = await Promise.all([
        cachedJsonFetch("/api/patient", { ttl: 15_000 }),
        cachedJsonFetch("/api/tests/definitions?status=active", { ttl: 30_000 }),
        cachedJsonFetch("/api/tests/packages", { ttl: 30_000 }),
        cachedJsonFetch("/api/billing", { ttl: 10_000 }),
      ]);

      const patientData = patientRes.data;
      const testData = testRes.data;
      const pkgData = pkgRes.data;
      const billingData = billingRes.data;

      if (!patientRes.response.ok) throw new Error(patientData.error || "Unable to load patients");
      if (!testRes.response.ok) throw new Error(testData.error || "Unable to load tests");
      if (!pkgRes.response.ok) throw new Error(pkgData.error || "Unable to load packages");
      if (!billingRes.response.ok) throw new Error(billingData.error || "Unable to load billing records");

      setPatients(Array.isArray(patientData) ? patientData : []);
      setTests(testData.tests || []);
      setPackages(pkgData.packages || []);
      setBillingRecords(billingData.billingRecords || []);
    } catch (err) {
      setError("Failed to load data. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function createBill(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patient, tests: selectedTests, priority, notes }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to create bill");

      clearCachedApi("/api/billing");
      clearCachedApi("/api/dashboard/stats");
      clearCachedApi("/api/samples?status=all");
      setBillingRecords((current) => [data.billingRecord, ...current]);
      setPatient("");
      setSelectedTests([]);
      setPriority("routine");
      setNotes("");
      setActiveTab("pending");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const openCloseModal = async (billingRecord) => {
    setSelectedBillingRecord(billingRecord);
    const netPayable = billingRecord.totalAmount || 0;
    setPayment({ cash: netPayable, card: 0, online: 0 });
    
    // Initialize results structure
    const initialResults = {};
    const details = { ...testDetails };

    for (const item of billingRecord.items || []) {
      const defId = item.testDefinition;
      if (!details[defId]) {
        try {
          const res = await fetch(`/api/tests/definitions/${defId}`, { credentials: "include" });
          if (!res.ok) continue;
          const data = await res.json();
          if (data.test) details[defId] = data.test.parameters || [];
        } catch (err) { console.error(err); }
      }
      
      initialResults[item._id] = {};
      (details[defId] || []).forEach(p => {
        initialResults[item._id][p.key] = "";
      });
    }
    
    setTestDetails(details);
    setResults(initialResults);
    setShowCloseModal(true);
  };

  const handleCloseBill = async () => {
    const totalPaid = Number(payment.cash) + Number(payment.card) + Number(payment.online);
    if (totalPaid < selectedBillingRecord.totalAmount) {
      if (!confirm(`Total paid (₹${totalPaid}) is less than bill amount (₹${selectedBillingRecord.totalAmount}). Proceed?`)) return;
    }

    setClosing(true);
    try {
      const res = await fetch("/api/billing/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ 
          billingRecordId: selectedBillingRecord._id,
          payment,
          results
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to close bill");

      clearCachedApi("/api/billing");
      clearCachedApi("/api/dashboard/stats");
      clearCachedApi("/api/samples?status=all");
      clearCachedApi("/api/reports");
      setBillingRecords((current) =>
        current.map((billingRecord) =>
          billingRecord._id === selectedBillingRecord._id
            ? { ...billingRecord, billingStatus: "paid" }
            : billingRecord
        )
      );
      setShowCloseModal(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setClosing(false);
    }
  };

  const closeSettlementModal = useCallback(() => {
    setShowCloseModal(false);
  }, []);

  const updateSettlementPayment = useCallback((key, value) => {
    setPayment((current) => ({ ...current, [key]: value }));
  }, []);

  const updateSettlementResult = useCallback((billingItemId, parameterKey, value) => {
    setResults((current) => ({
      ...current,
      [billingItemId]: { ...current[billingItemId], [parameterKey]: value },
    }));
  }, []);

  if (loading) return <div className="module-page">Loading...</div>;

  return (
    <div className="module-page">
      <div className="module-header">
        <div>
          <p className="module-kicker">Billing & Revenue</p>
          <h1>Billing Center</h1>
          <span>Manage patient payments, commissions, and billing workflow.</span>
        </div>
        <div className="module-actions">
          <button className="dash-btn-secondary" onClick={loadData}>
            {Icons.refresh || "↻"} Refresh
          </button>
        </div>
      </div>

      <div className="module-tabs" style={{ 
        display: "flex", 
        gap: "16px", 
        borderBottom: "1px solid var(--border-light)", 
        marginBottom: "24px",
        overflowX: "auto",
        WebkitOverflowScrolling: "touch"
      }}>
        {[
          { id: "pending", label: "Pending Payments", count: pendingBills.length },
          { id: "create", label: "Create New Bill", hide: !canCreateBilling },
          { id: "history", label: "Billing History" }
        ].map(tab => !tab.hide && (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{ 
              padding: "12px 4px", 
              background: "none", 
              border: "none", 
              borderBottom: activeTab === tab.id ? "2px solid var(--brand-action, var(--primary))" : "2px solid transparent",
              color: activeTab === tab.id ? "var(--brand-action, var(--primary))" : "var(--text-muted)",
              fontWeight: activeTab === tab.id ? "700" : "500",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              whiteSpace: "nowrap",
              flexShrink: 0
            }}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span style={{ 
                background: tab.count > 0 ? "var(--danger-50)" : "var(--surface)", 
                color: tab.count > 0 ? "var(--danger)" : "var(--text-muted)",
                padding: "2px 6px",
                borderRadius: "10px",
                fontSize: "11px"
              }}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {error && <div className="lims-alert danger" style={{ marginBottom: "20px" }}>{error}</div>}

      {activeTab === "pending" && (
        <div className="module-grid" style={{ gridTemplateColumns: "1fr" }}>
          <div className="test-card-list" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 350px), 1fr))", gap: "20px" }}>
            {pendingBills.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px", color: "var(--text-muted)", gridColumn: "1 / -1" }}>
                {Icons.checkCircle}
                <p style={{ marginTop: "12px" }}>No pending payments. All clear!</p>
              </div>
            ) : (
              pendingBills.map((billingRecord) => (
                <article key={billingRecord._id} className="form-card" style={{ padding: "0", overflow: "hidden" }}>
                  <div className="form-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                    <div>
                      <h6 style={{ marginBottom: "2px" }}>{billingRecord.patient?.name || "Unknown Patient"}</h6>
                      <small style={{ color: "var(--text-muted)" }}>{billingRecord.billId} · {billingRecord.patient?.patientId}</small>
                    </div>
                    <span style={{ 
                      background: "var(--warning-50)", 
                      color: "var(--warning-700)", 
                      padding: "4px 8px", 
                      borderRadius: "6px", 
                      fontSize: "11px", 
                      fontWeight: "700" 
                    }}>UNPAID</span>
                  </div>
                  <div className="form-card-body" style={{ padding: "16px" }}>
                    <div style={{ marginBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <small style={{ color: "var(--text-muted)", fontWeight: "600" }}>INVESTIGATIONS</small>
                        <span style={{ 
                            fontSize: "11px", 
                            color: billingRecord.items?.every(i => i.status === "completed") ? "var(--success)" : "var(--primary)",
                            fontWeight: "700"
                        }}>
                            {billingRecord.items?.filter(i => i.status === "completed").length || 0} / {billingRecord.items?.length || 0} READY
                        </span>
                    </div>
                    <div style={{ marginBottom: "16px" }}>
                      {billingRecord.items?.map((item, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "4px" }}>
                          <span style={{ color: "var(--text)", display: "flex", alignItems: "center", gap: "6px" }}>
                            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: item.status === "completed" ? "var(--success)" : "var(--border)" }}></div>
                            {item.testSnapshot?.name}
                          </span>
                          <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                            {item.testSnapshot?.price > 0 ? `₹${item.testSnapshot.price}` : <span style={{ fontStyle: "italic", opacity: 0.7 }}>Included</span>}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div style={{ 
                      borderTop: "1px dashed var(--border)", 
                      paddingTop: "12px"
                    }}>
                      {billingRecord.referralDoctor && billingRecord.commissionAmount > 0 && (
                        <div style={{ 
                          background: "var(--primary-50)", 
                          padding: "8px 12px", 
                          borderRadius: "8px", 
                          marginBottom: "12px",
                          fontSize: "12px",
                          border: "1px solid var(--primary-100)"
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ color: "var(--brand-action, var(--primary))", fontWeight: "500" }}>Referral Commission</span>
                            <span style={{ color: "var(--brand-action, var(--primary))", fontWeight: "700" }}>₹{billingRecord.commissionAmount}</span>
                          </div>
                          <div style={{ fontSize: "10px", color: "var(--brand-action, var(--primary))", marginTop: "2px" }}>
                            Payable to Dr. {billingRecord.referralDoctor?.name}
                          </div>
                        </div>
                      )}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                        <div>
                          <small style={{ color: "var(--text-muted)", display: "block" }}>Total Amount</small>
                          <strong style={{ fontSize: "18px", color: "var(--brand-action, var(--primary))" }}>₹{billingRecord.totalAmount || 0}</strong>
                        </div>
                        <button 
                          className="dash-btn-primary" 
                          onClick={() => openCloseModal(billingRecord)}
                          disabled={closing}
                          style={{ padding: "8px 20px" }}
                        >
                          {closing ? "Processing..." : "Close Bill"}
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === "create" && (
        <CreateBillTab
          patients={patients}
          patient={patient}
          setPatient={setPatient}
          priority={priority}
          setPriority={setPriority}
          selectedTests={selectedTests}
          setSelectedTests={setSelectedTests}
          investigationOptions={investigationOptions}
          notes={notes}
          setNotes={setNotes}
          selectedTotal={selectedTotal}
          saving={saving}
          createBill={createBill}
          billingRecords={billingRecords}
        />
      )}

      {activeTab === "history" && <BillingHistoryTab billingRecords={billingRecords} />}
      {showCloseModal && selectedBillingRecord && (
        <SettlementModal
          billingRecord={selectedBillingRecord}
          closing={closing}
          payment={payment}
          results={results}
          testDetails={testDetails}
          onClose={closeSettlementModal}
          onPaymentChange={updateSettlementPayment}
          onResultChange={updateSettlementResult}
          onSubmit={handleCloseBill}
        />
      )}
    </div>
  );
}


