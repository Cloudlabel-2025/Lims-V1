"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Icons } from "@/app/components/Icons";
import { hasPermission } from "@/app/lib/client-rbac";
import { useCurrentUser } from "@/app/lib/use-current-user";
import MultiSelect from "@/app/components/MultiSelect";

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

  const canCreateBilling = hasPermission(user, "billing.create");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [patientRes, testRes, pkgRes, billingRes] = await Promise.all([
        fetch("/api/patient", { credentials: "include" }),
        fetch("/api/tests/definitions?status=active", { credentials: "include" }),
        fetch("/api/tests/packages", { credentials: "include" }),
        fetch("/api/billing", { credentials: "include" }),
      ]);
      
      const [patientData, testData, pkgData, billingData] = await Promise.all([
        patientRes.json(),
        testRes.json(),
        pkgRes.json(),
        billingRes.json(),
      ]);

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
        gap: "24px", 
        borderBottom: "1px solid var(--border-light)", 
        marginBottom: "24px" 
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
              borderBottom: activeTab === tab.id ? "2px solid var(--primary)" : "2px solid transparent",
              color: activeTab === tab.id ? "var(--primary)" : "var(--text-muted)",
              fontWeight: activeTab === tab.id ? "700" : "500",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px"
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
          <div className="test-card-list" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: "20px" }}>
            {pendingBills.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px", color: "var(--text-muted)", gridColumn: "1 / -1" }}>
                {Icons.checkCircle}
                <p style={{ marginTop: "12px" }}>No pending payments. All clear!</p>
              </div>
            ) : (
              pendingBills.map((billingRecord) => (
                <article key={billingRecord._id} className="form-card" style={{ padding: "0", overflow: "hidden" }}>
                  <div className="form-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
                            <span style={{ color: "var(--primary-700)", fontWeight: "500" }}>Referral Commission</span>
                            <span style={{ color: "var(--primary-700)", fontWeight: "700" }}>₹{billingRecord.commissionAmount}</span>
                          </div>
                          <div style={{ fontSize: "10px", color: "var(--primary-600)", marginTop: "2px" }}>
                            Payable to Dr. {billingRecord.referralDoctor?.name}
                          </div>
                        </div>
                      )}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <small style={{ color: "var(--text-muted)", display: "block" }}>Total Amount</small>
                          <strong style={{ fontSize: "18px", color: "var(--primary-dark)" }}>₹{billingRecord.totalAmount || 0}</strong>
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
        <div className="module-grid">
          <section className="module-panel">
            <div className="module-panel-header">
              <h2>New Investigation Bill</h2>
              <p>Register tests for existing patients.</p>
            </div>
            <form className="module-form" onSubmit={createBill}>
              <div className="module-form-grid">
                <label>
                  Select Patient <span className="required">*</span>
                  <select className="lims-select" value={patient} onChange={(e) => setPatient(e.target.value)} required>
                    <option value="">Choose patient...</option>
                    {patients.map((item) => (
                      <option key={item._id} value={item._id}>{item.name} ({item.patientId})</option>
                    ))}
                  </select>
                </label>
                <label>
                  Priority
                  <select className="lims-select" value={priority} onChange={(e) => setPriority(e.target.value)}>
                    <option value="routine">Routine</option>
                    <option value="urgent">Urgent (STAT)</option>
                  </select>
                </label>
              </div>

              <label className="module-full-label">
                Select Investigations <span className="required">*</span>
                <MultiSelect 
                  name="selectedTests"
                  placeholder="Search tests or packages..."
                  options={[
                    ...packages.map(p => ({ value: `pkg_${p._id}`, label: p.name, sublabel: `Package · ₹${p.price}` })),
                    ...tests.map(t => ({ value: `test_${t._id}`, label: t.name, sublabel: `${t.category?.name} · ₹${t.price}` }))
                  ]}
                  value={selectedTests}
                  onChange={(e) => setSelectedTests(e.target.value)}
                />
              </label>

              <label className="module-full-label">
                Notes
                <textarea className="lims-input" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Clinical notes or billing remarks..." />
              </label>

              <div style={{ 
                background: "var(--surface)", 
                padding: "20px", 
                borderRadius: "var(--radius-md)", 
                marginBottom: "20px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <div>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)", display: "block" }}>Total Payable</span>
                  <strong style={{ fontSize: "24px", color: "var(--primary)" }}>₹{selectedTotal}</strong>
                </div>
                <button type="submit" className="dash-btn-primary" disabled={!patient || selectedTests.length === 0 || saving}>
                  {saving ? "Processing..." : "Generate Bill"}
                </button>
              </div>
            </form>
          </section>
          
          <aside className="module-panel">
             <div className="module-panel-header">
               <h2>Recently Created</h2>
               <p>Quick view of latest bills</p>
             </div>
             <div className="test-card-list">
               {billingRecords.slice(0, 5).map((billingRecord) => (
                 <article key={billingRecord._id} className="test-card">
                   <div>
                     <h3>{billingRecord.patient?.name}</h3>
                     <span>{billingRecord.billId} · ₹{billingRecord.totalAmount}</span>
                   </div>
                   <strong className={billingRecord.billingStatus}>{billingRecord.billingStatus}</strong>
                 </article>
               ))}
             </div>
          </aside>
        </div>
      )}

      {activeTab === "history" && (
        <div className="form-card" style={{ padding: "0", overflow: "hidden" }}>
          <div className="form-card-header">
            <h6 style={{ margin: 0 }}>Billing History</h6>
            <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--text-muted)", fontWeight: "400" }}>All laboratory bills and payment statuses.</p>
          </div>
          <div className="lims-table-container">
            <table className="lims-table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
                  <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)" }}>Bill ID</th>
                  <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)" }}>Patient Details</th>
                  <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)" }}>Date</th>
                  <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)" }}>Investigation(s)</th>
                  <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)" }}>Bill Amount</th>
                  <th style={{ padding: "14px 20px", textAlign: "center", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {billingRecords.map((billingRecord) => (
                  <tr key={billingRecord._id} style={{ borderBottom: "1px solid var(--border-light)", transition: "background 0.2s" }}>
                    <td style={{ padding: "14px 20px" }}>
                      <span style={{ fontWeight: "700", color: "var(--primary)", fontSize: "13px" }}>{billingRecord.billId}</span>
                    </td>
                    <td style={{ padding: "14px 20px" }}>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontWeight: "600", color: "var(--text-primary)", fontSize: "14px" }}>{billingRecord.patient?.name || "N/A"}</span>
                        <small style={{ color: "var(--text-muted)", fontSize: "11px" }}>ID: {billingRecord.patient?.patientId || "—"}</small>
                      </div>
                    </td>
                    <td style={{ padding: "14px 20px", color: "var(--text-secondary)", fontSize: "13px" }}>
                      {new Date(billingRecord.createdAt).toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td style={{ padding: "14px 20px", color: "var(--text-secondary)", fontSize: "13px" }}>
                      <span style={{ background: "var(--border-light)", padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: "600" }}>
                        {billingRecord.items?.length || 0} Tests
                      </span>
                    </td>
                    <td style={{ padding: "14px 20px" }}>
                      <strong style={{ color: "var(--text-primary)", fontSize: "14px" }}>₹{billingRecord.totalAmount || 0}</strong>
                    </td>
                    <td style={{ padding: "14px 20px", textAlign: "center" }}>
                      <span style={{ 
                        display: "inline-block",
                        padding: "4px 10px", 
                        borderRadius: "6px", 
                        fontSize: "11px", 
                        fontWeight: "700",
                        background: billingRecord.billingStatus === "paid" ? "var(--success-50)" : "var(--warning-50)",
                        color: billingRecord.billingStatus === "paid" ? "var(--success-700)" : "var(--warning-700)",
                        textTransform: "uppercase"
                      }}>
                        {billingRecord.billingStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {showCloseModal && selectedBillingRecord && (() => {
        const netPayable = selectedBillingRecord.totalAmount || 0;
        const totalPaid = Number(payment.cash) + Number(payment.card) + Number(payment.online);
        const remaining = netPayable - totalPaid;
        return (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "820px", textAlign: "left", padding: 0, overflow: "hidden", animation: "modalSlideUp 0.3s var(--ease-spring)" }}>

            {/* Header */}
            <div style={{ padding: "24px 28px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h4 style={{ margin: 0, fontSize: "18px" }}>Finalize Settlement</h4>
                <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--text-muted)" }}>{selectedBillingRecord.billId} · {selectedBillingRecord.patient?.name} · {selectedBillingRecord.items?.length || 0} investigations</p>
              </div>
              <button onClick={() => setShowCloseModal(false)} style={{ width: "32px", height: "32px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", transition: "all var(--duration-fast)" }}>{Icons.close}</button>
            </div>

            <div style={{ padding: "24px 28px", maxHeight: "70vh", overflowY: "auto" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>

                {/* ── LEFT: Payment ── */}
                <div>
                  <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "14px" }}>Payment Breakdown</div>

                  {/* Bill Summary */}
                  <div style={{ background: "var(--primary-50)", border: "1px solid var(--primary-100)", borderRadius: "var(--radius-md)", padding: "16px", marginBottom: "18px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: "14px" }}>
                      <span style={{ fontWeight: "700", color: "var(--text-primary)" }}>Total Amount</span>
                      <span style={{ fontWeight: "800", fontSize: "20px", color: "var(--primary-dark)" }}>₹{netPayable}</span>
                    </div>
                    {selectedBillingRecord.commissionAmount > 0 && (
                      <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px dashed var(--primary-200)", fontSize: "11px", color: "var(--primary-700)" }}>
                        Includes internal commission of <strong>₹{selectedBillingRecord.commissionAmount}</strong> for Dr. {selectedBillingRecord.referralDoctor?.name}
                      </div>
                    )}
                  </div>

                  {/* Split Payments */}
                  <div style={{ display: "grid", gap: "10px" }}>
                    {[
                      { key: "cash", label: "Cash" },
                      { key: "card", label: "Card" },
                      { key: "online", label: "UPI / Online" },
                    ].map(m => (
                      <label key={m.key} className="lims-label" style={{ margin: 0 }}>
                        <span style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)", marginBottom: "4px", display: "block" }}>{m.label}</span>
                        <input 
                          type="number" 
                          className="lims-input" 
                          style={{ height: "38px", fontWeight: "600" }}
                          value={payment[m.key]} 
                          onChange={(e) => setPayment(p => ({ ...p, [m.key]: Number(e.target.value) }))} 
                        />
                      </label>
                    ))}
                  </div>

                  {/* Balance Status */}
                  <div style={{ 
                    marginTop: "12px", 
                    padding: "10px 14px", 
                    borderRadius: "var(--radius-sm)", 
                    background: remaining === 0 ? "var(--primary-50)" : "#fffbeb",
                    border: `1px solid ${remaining === 0 ? "var(--primary-200)" : "#fde68a"}`,
                    display: "flex", 
                    justifyContent: "space-between", 
                    alignItems: "center",
                    fontSize: "12px",
                    fontWeight: "600"
                  }}>
                    <span style={{ color: remaining === 0 ? "var(--primary-dark)" : "#d97706" }}>
                      {remaining === 0 ? "✓ Fully settled" : remaining > 0 ? "Balance due" : "Overpaid"}
                    </span>
                    {remaining !== 0 && <span style={{ color: remaining > 0 ? "#d97706" : "#dc2626" }}>₹{Math.abs(remaining)}</span>}
                  </div>
                </div>

                {/* ── RIGHT: Test Results ── */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                    <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Test Results</span>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", background: "var(--surface)", padding: "2px 8px", borderRadius: "var(--radius-sm)" }}>Optional</span>
                  </div>

                  <div style={{ maxHeight: "380px", overflowY: "auto", paddingRight: "4px" }}>
                    {(selectedBillingRecord.items || []).map((item) => (
                      <div key={item._id} style={{ marginBottom: "14px", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
                        <div style={{ padding: "10px 14px", background: "var(--surface)", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)" }}>
                          <span style={{ fontWeight: "700", fontSize: "12px", color: "var(--text-primary)" }}>{item.testSnapshot?.name}</span>
                          <span style={{ fontSize: "11px", fontWeight: "600", color: item.testSnapshot?.price > 0 ? "var(--primary)" : "var(--text-muted)" }}>
                            {item.testSnapshot?.price > 0 ? `₹${item.testSnapshot.price}` : "Included"}
                          </span>
                        </div>
                        <div style={{ padding: "10px 14px", display: "grid", gap: "8px" }}>
                          {(testDetails[item.testDefinition] || []).map((param) => (
                            <div key={param.key} style={{ display: "grid", gridTemplateColumns: "1fr 100px", alignItems: "center", gap: "8px" }}>
                              <div>
                                <div style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: "500" }}>{param.name} <span style={{ color: "var(--text-muted)", fontSize: "10px" }}>({param.unit})</span></div>
                                {(param.normalMin != null || param.normalMax != null) && (
                                  <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>{param.normalMin ?? "—"} – {param.normalMax ?? "—"}</div>
                                )}
                              </div>
                              <input 
                                type="text" 
                                className="lims-input" 
                                style={{ height: "30px", fontSize: "12px", fontWeight: "600", textAlign: "center", padding: "0 8px" }}
                                placeholder="—"
                                value={results[item._id]?.[param.key] || ""}
                                onChange={(e) => setResults(prev => ({
                                  ...prev,
                                  [item._id]: { ...prev[item._id], [param.key]: e.target.value }
                                }))}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: "16px 28px", borderTop: "1px solid var(--border)", display: "flex", gap: "12px" }}>
              <button className="btn-modal-cancel" onClick={() => setShowCloseModal(false)}>Cancel</button>
              <button 
                className="btn-modal-confirm" 
                onClick={handleCloseBill}
                disabled={closing}
                style={closing ? { opacity: 0.6, cursor: "not-allowed" } : {}}
              >
                {closing ? "Processing..." : `Complete Settlement · ₹${totalPaid}`}
              </button>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
}


