"use client";

import { useEffect, useMemo, useState } from "react";

const money = (value) => Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const date = (value) => value ? new Date(value).toLocaleDateString("en-IN") : "-";

function Card({ label, value, tone = "#0d9488" }) {
  return (
    <div className="form-card" style={{ padding: 18, borderTop: `3px solid ${tone}` }}>
      <div style={{ color: "var(--text-muted)", fontSize: 12, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, marginTop: 6 }}>{value}</div>
    </div>
  );
}

export default function DoctorDashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("patients");
  const [viewMode, setViewMode] = useState("practice"); // "practice" | "investor"

  // Modals state
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [patientForm, setPatientForm] = useState({ name: "", phone: "", age: "", dob: "", gender: "Male", address: "", email: "" });
  const [savingPatient, setSavingPatient] = useState(false);

  const [showTestRequest, setShowTestRequest] = useState(false);
  const [availablePackages, setAvailablePackages] = useState([]);
  const [availableTests, setAvailableTests] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [selectedPackages, setSelectedPackages] = useState([]);
  const [selectedTests, setSelectedTests] = useState([]);
  const [vitals, setVitals] = useState({ bp: "", height: "", weight: "", pulse: "", temperature: "", sugar: "" });
  const [notes, setNotes] = useState("");
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [actionSuccess, setActionSuccess] = useState("");

  const loadData = async () => {
    try {
      const response = await fetch("/api/doctor/portal", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to load doctor portal");
      setData(body);
      if (body.doctor?.doctorType === "Investor") {
        setViewMode("investor");
        setTab("analytics");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadCatalog = async () => {
    try {
      const response = await fetch("/api/doctor/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "fetch_packages" }),
      });
      const body = await response.json();
      if (response.ok) {
        setAvailablePackages(body.packages || []);
        setAvailableTests(body.tests || []);
      }
    } catch {}
  };

  const handleRegisterPatient = async (e) => {
    e.preventDefault();
    setSavingPatient(true);
    setError("");
    try {
      const response = await fetch("/api/doctor/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "register_patient", ...patientForm }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Failed to register patient");
      setActionSuccess(`Patient "${body.patient.name}" registered successfully.`);
      setShowAddPatient(false);
      setPatientForm({ name: "", phone: "", age: "", dob: "", gender: "Male", address: "", email: "" });
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingPatient(false);
    }
  };

  const handleOpenTestRequest = (patientId = "") => {
    setSelectedPatientId(patientId);
    setShowTestRequest(true);
    loadCatalog();
  };

  const handleSubmitTestRequest = async (e) => {
    e.preventDefault();
    setSubmittingRequest(true);
    setError("");
    try {
      const response = await fetch("/api/doctor/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit_test_request",
          patientId: selectedPatientId,
          testPackages: selectedPackages,
          tests: selectedTests,
          vitals,
          notes,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Failed to submit test request");
      setActionSuccess(body.message || "Test request sent directly to Lab Admin.");
      setShowTestRequest(false);
      setSelectedPackages([]);
      setSelectedTests([]);
      setVitals({ bp: "", height: "", weight: "", pulse: "", temperature: "", sugar: "" });
      setNotes("");
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmittingRequest(false);
    }
  };

  const shareVitalsWhatsApp = (patientName, bp, weight, pulse) => {
    const text = encodeURIComponent(
      `*Patient Health Summary*\nPatient: ${patientName}\nBP: ${bp || "N/A"}\nWeight: ${weight || "N/A"}\nPulse: ${pulse || "N/A"}\nReferral Doctor: Dr. ${data?.doctor?.name || ""}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
  };

  const filteredPatients = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = data?.registeredPatients || [];
    if (!term) return list;
    return list.filter((p) =>
      [p.name, p.patientId, p.phone, p.email, p.address].some((v) =>
        String(v || "").toLowerCase().includes(term)
      )
    );
  }, [data, search]);

  const filteredRequests = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = data?.testRequests || [];
    if (!term) return list;
    return list.filter((r) =>
      [r.requestId, r.patient?.name, r.patient?.patientId, r.patient?.phone, r.status].some((v) =>
        String(v || "").toLowerCase().includes(term)
      )
    );
  }, [data, search]);

  const referrals = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return data?.referrals || [];
    return (data?.referrals || []).filter((item) =>
      [item.billId, item.patient?.name, item.patient?.patientId, item.patient?.phone].some((v) =>
        String(v || "").toLowerCase().includes(term)
      )
    );
  }, [data, search]);

  if (loading) return <div className="form-card" style={{ padding: 30 }}>Loading doctor portal...</div>;
  if (error) return <div className="lims-alert danger" style={{ margin: 20 }}>{error}</div>;
  const summary = data.summary;

  return (
    <div style={{ paddingBottom: 40 }}>
      {actionSuccess && (
        <div style={{ padding: "12px 16px", background: "#dcfce7", border: "1px solid #86efac", color: "#166534", borderRadius: 8, marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
          <span>{actionSuccess}</span>
          <button type="button" onClick={() => setActionSuccess("")} style={{ border: "none", background: "transparent", cursor: "pointer", fontWeight: 700 }}>✕</button>
        </div>
      )}

      <div className="page-header" style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h4 style={{ margin: 0 }}>Welcome, Dr. {data.doctor.name}</h4>
          <small style={{ color: "#64748b" }}>{data.doctor.doctorId} · {data.doctor.speciality} · {data.doctor.clinicName || "Private Clinic"}</small>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className="btn-lims-secondary" onClick={() => setShowAddPatient(true)}>
            + Add New Patient
          </button>
          <button type="button" className="btn-lims-primary" onClick={() => handleOpenTestRequest()}>
            📋 Assign Test Package to Lab
          </button>
        </div>
      </div>

      {viewMode === "practice" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12, marginBottom: 22 }}>
          <Card label="Registered Patients" value={summary.patientCount || 0} tone="#0d9488" />
          <Card label="Test Requests Sent" value={summary.testRequestCount || 0} tone="#8b5cf6" />
          <Card label="Referred Bills" value={summary.referralCount || 0} tone="#2563eb" />
          <Card label="Released Reports" value={summary.releasedReportCount || 0} tone="#16a34a" />
          <Card label="Earned Commission" value={`₹${money(summary.earnedCommission)}`} tone="#059669" />
          <Card label="Pending Payout" value={`₹${money(summary.pendingPayout)}`} tone="#dc2626" />
        </div>
      )}

      {data.doctor.doctorType === "Investor" && (
        <div style={{ display: "flex", background: "#f1f5f9", padding: 4, borderRadius: 10, width: "fit-content", marginBottom: 16 }}>
          <button
            type="button"
            onClick={() => { setViewMode("practice"); setTab("patients"); }}
            style={{
              padding: "8px 16px",
              border: 0,
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
              background: viewMode === "practice" ? "#ffffff" : "transparent",
              color: viewMode === "practice" ? "#0f766e" : "#64748b",
              boxShadow: viewMode === "practice" ? "0 2px 4px rgba(0,0,0,0.05)" : "none"
            }}
          >
            🩺 Practice Dashboard
          </button>
          <button
            type="button"
            onClick={() => { setViewMode("investor"); setTab("analytics"); }}
            style={{
              padding: "8px 16px",
              border: 0,
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
              background: viewMode === "investor" ? "#ffffff" : "transparent",
              color: viewMode === "investor" ? "#0f766e" : "#64748b",
              boxShadow: viewMode === "investor" ? "0 2px 4px rgba(0,0,0,0.05)" : "none"
            }}
          >
            💼 Investor Dashboard
          </button>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {viewMode === "practice" ? (
          [
            ["patients", `Registered Patients (${data?.registeredPatients?.length || 0})`],
            ["requests", `Sent Test Requests (${data?.testRequests?.length || 0})`],
            ["referrals", `Lab Bills (${data?.referrals?.length || 0})`],
            ["results", "Released Reports"],
            ["commissions", "Commissions & Payouts"],
          ].map(([id, label]) => (
            <button key={id} className={tab === id ? "btn-lims-primary" : "btn-lims-secondary"} onClick={() => setTab(id)}>
              {label}
            </button>
          ))
        ) : (
          [
            ["analytics", "📈 Lab Analytics"],
            ["lab-billings", "🧾 Lab Billings"],
            ["lab-accounts", "🏦 Lab Accounts"],
            ["all-patients", "👥 All Patients"],
          ].map(([id, label]) => (
            <button key={id} className={tab === id ? "btn-lims-primary" : "btn-lims-secondary"} onClick={() => setTab(id)}>
              {label}
            </button>
          ))
        )}
      </div>

      {/* --- TAB 1: Registered Patients --- */}
      {tab === "patients" && (
        <section className="form-card" style={{ padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 12 }}>
            <input className="lims-input" style={{ maxWidth: 380 }} placeholder="Search patient name, ID, phone..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <button type="button" className="btn-lims-secondary" onClick={() => setShowAddPatient(true)}>
              + Register Patient
            </button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Patient ID</th>
                  <th>Patient Name</th>
                  <th>Age / Gender</th>
                  <th>Phone Number</th>
                  <th>Address</th>
                  <th>Registered On</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredPatients.map((p) => (
                  <tr key={p._id}>
                    <td><strong>{p.patientId}</strong></td>
                    <td><strong>{p.name}</strong></td>
                    <td>{p.age ? `${p.age} yrs` : "-"} / {p.gender || "Male"}</td>
                    <td>{p.phone}</td>
                    <td>{p.address || "N/A"}</td>
                    <td>{date(p.createdAt)}</td>
                    <td>
                      <button
                        type="button"
                        className="btn-lims-primary"
                        style={{ fontSize: 12, padding: "6px 12px" }}
                        onClick={() => handleOpenTestRequest(p._id)}
                      >
                        📋 Order Tests &amp; Send to Lab
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filteredPatients.length && <p style={{ color: "#64748b", marginTop: 12 }}>No registered patients found.</p>}
          </div>
        </section>
      )}

      {/* --- TAB 2: Sent Test Requests --- */}
      {tab === "requests" && (
        <section className="form-card" style={{ padding: 18 }}>
          <input className="lims-input" style={{ maxWidth: 380, marginBottom: 14 }} placeholder="Search request ID, patient..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Request ID</th>
                  <th>Patient Details</th>
                  <th>Requested Test Packages / Tests</th>
                  <th>Vitals / Clinical Notes</th>
                  <th>Status</th>
                  <th>Date Sent</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((req) => {
                  const statusColors = {
                    pending: { bg: "#fef3c7", color: "#92400e", label: "🟡 Pending Lab Reception" },
                    received: { bg: "#dcfce7", color: "#166534", label: "🟢 Accepted & Billed" },
                    completed: { bg: "#e0f2fe", color: "#0369a1", label: "🔵 Completed" },
                    cancelled: { bg: "#fee2e2", color: "#991b1b", label: "🔴 Cancelled" },
                  };
                  const st = statusColors[req.status] || statusColors.pending;
                  const packagesList = (req.testPackages || []).map((p) => p.name).join(", ");
                  const testsList = (req.tests || []).map((t) => t.name).join(", ");
                  const itemsText = [packagesList, testsList].filter(Boolean).join(" · ") || "General Diagnostics";

                  return (
                    <tr key={req._id}>
                      <td><strong>{req.requestId}</strong></td>
                      <td>
                        <strong>{req.patient?.name}</strong>
                        <br />
                        <small>{req.patient?.patientId} · {req.patient?.phone}</small>
                      </td>
                      <td>{itemsText}</td>
                      <td>
                        {req.vitals?.bp ? `BP: ${req.vitals.bp} · ` : ""}
                        {req.vitals?.pulse ? `Pulse: ${req.vitals.pulse} · ` : ""}
                        {req.notes || "None"}
                      </td>
                      <td>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 12, background: st.bg, color: st.color }}>
                          {st.label}
                        </span>
                      </td>
                      <td>{date(req.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!filteredRequests.length && <p style={{ color: "#64748b", marginTop: 12 }}>No test requests submitted yet.</p>}
          </div>
        </section>
      )}

      {/* --- TAB 3: Lab Referral Bills --- */}
      {tab === "referrals" && (
        <section className="form-card" style={{ padding: 18 }}>
          <input className="lims-input" style={{ maxWidth: 380, marginBottom: 14 }} placeholder="Search patient, ID, phone or bill" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Referral Bill</th>
                  <th>Tests</th>
                  <th>Payment Status</th>
                  <th>Commission</th>
                  <th>WhatsApp Share</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((item) => (
                  <tr key={item._id}>
                    <td>
                      <strong>{item.patient?.name}</strong>
                      <br />
                      <small>{item.patient?.patientId} · {item.patient?.phone}</small>
                    </td>
                    <td>
                      {item.billId}
                      <br />
                      <small>{date(item.referredAt)}</small>
                    </td>
                    <td>{item.tests.join(", ") || "-"}</td>
                    <td>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 12, background: item.billingStatus === "paid" ? "#dcfce7" : "#fef3c7", color: item.billingStatus === "paid" ? "#166534" : "#92400e" }}>
                        {item.billingStatus || "pending"}
                      </span>
                    </td>
                    <td>
                      ₹{money(item.commissionAmount)}
                      <br />
                      <small>{item.commissionStatus}</small>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-lims-secondary"
                        style={{ fontSize: 11, padding: "4px 8px" }}
                        onClick={() => shareVitalsWhatsApp(item.patient?.name, "120/80 mmHg", "68 kg", "72 bpm")}
                      >
                        📲 Share Vitals
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!referrals.length && <p style={{ color: "#64748b", marginTop: 12 }}>No referral patients found.</p>}
          </div>
        </section>
      )}

      {/* --- TAB 4: Released Results --- */}
      {tab === "results" && (
        <section className="form-card" style={{ padding: 18 }}>
          <p style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
            🔒 Note: Diagnostic test reports are reference copies visible here strictly after the patient completes payment at the laboratory.
          </p>
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Report ID</th>
                  <th>Patient</th>
                  <th>Test</th>
                  <th>Released Date</th>
                  <th>Result Findings</th>
                </tr>
              </thead>
              <tbody>
                {data.reports.map((report) => (
                  <tr key={report._id}>
                    <td><strong>{report.reportId}</strong></td>
                    <td>
                      {report.patient?.name}
                      <br />
                      <small>{report.patient?.patientId}</small>
                    </td>
                    <td>{report.testSnapshot?.name}</td>
                    <td>{date(report.releasedAt)}</td>
                    <td>
                      {(report.results || []).map((r) => `${r.name}: ${r.textValue || r.value || "-"} ${r.unit || ""}`).join(" · ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.reports.length && <p style={{ color: "#64748b", marginTop: 12 }}>No released &amp; paid reports available yet.</p>}
          </div>
        </section>
      )}

      {/* --- TAB 5: Commissions --- */}
      {tab === "commissions" && (
        <section style={{ display: "grid", gap: 18 }}>
          <div className="form-card" style={{ padding: 18 }}>
            <h5>Commission by referral</h5>
            <div style={{ overflowX: "auto" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Bill</th>
                    <th>Patient</th>
                    <th>Bill amount</th>
                    <th>Commission</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.referrals.map((item) => (
                    <tr key={item._id}>
                      <td>{item.billId}</td>
                      <td>{item.patient?.name}</td>
                      <td>₹{money(item.totalAmount)}</td>
                      <td>₹{money(item.commissionAmount)}</td>
                      <td>{item.commissionStatus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
      {/* --- TAB 6: Lab Analytics --- */}
      {tab === "analytics" && data.investorData && (
        <section style={{ display: "grid", gap: 20 }}>
          {/* Financial Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            <Card label="Total Revenue" value={`₹${money(data.investorData.analytics.totalRevenue)}`} tone="#0d9488" />
            <Card label="Total Expenses" value={`₹${money(data.investorData.analytics.totalExpenses)}`} tone="#dc2626" />
            <Card label="Net Profit" value={`₹${money(data.investorData.analytics.netProfit)}`} tone={data.investorData.analytics.netProfit >= 0 ? "#10b981" : "#ef4444"} />
            <Card label="Profit Margin" value={`${money(data.investorData.analytics.profitMargin)}%`} tone="#8b5cf6" />
            <Card label="Total Assets" value={`₹${money(data.investorData.analytics.totalAssets)}`} tone="#2563eb" />
            <Card label="Total Liabilities" value={`₹${money(data.investorData.analytics.totalLiabilities)}`} tone="#f59e0b" />
          </div>

          {/* Monthly Trends */}
          <div className="form-card" style={{ padding: 18 }}>
            <h5 style={{ margin: "0 0 16px 0" }}>Monthly Performance Trends (Last 12 Months)</h5>
            <div style={{ overflowX: "auto" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Revenue</th>
                    <th>Expense</th>
                    <th>Net Profit</th>
                    <th style={{ width: "350px" }}>Visual Performance</th>
                  </tr>
                </thead>
                <tbody>
                  {data.investorData.analytics.monthlyTrends.map((trend) => {
                    const total = trend.revenue + trend.expense;
                    const revPct = total > 0 ? (trend.revenue / total) * 100 : 0;
                    const expPct = total > 0 ? (trend.expense / total) * 100 : 0;
                    return (
                      <tr key={trend.month}>
                        <td><strong>{trend.month}</strong></td>
                        <td style={{ color: "#0d9488" }}>₹{money(trend.revenue)}</td>
                        <td style={{ color: "#dc2626" }}>₹{money(trend.expense)}</td>
                        <td style={{ color: trend.netProfit >= 0 ? "#10b981" : "#ef4444", fontWeight: 700 }}>
                          ₹{money(trend.netProfit)}
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 4, alignItems: "center", width: "100%", height: 16 }}>
                            <div style={{ height: "100%", width: `${revPct}%`, background: "#0d9488", borderRadius: 4 }} title={`Revenue: ${money(revPct)}%`} />
                            <div style={{ height: "100%", width: `${expPct}%`, background: "#dc2626", borderRadius: 4 }} title={`Expense: ${money(expPct)}%`} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!data.investorData.analytics.monthlyTrends.length && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", color: "#64748b" }}>No monthly trend data found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* --- TAB 7: Lab Billings --- */}
      {tab === "lab-billings" && data.investorData && (
        <section className="form-card" style={{ padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 12 }}>
            <input className="lims-input" style={{ maxWidth: 380 }} placeholder="Search bills by ID, patient, status..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Bill ID</th>
                  <th>Patient Details</th>
                  <th>Total Amount</th>
                  <th>Paid Amount</th>
                  <th>Balance Due</th>
                  <th>Billing Status</th>
                  <th>Status</th>
                  <th>Billing Date</th>
                </tr>
              </thead>
              <tbody>
                {data.investorData.billings
                  .filter(b => [b.billId, b.patientName, b.patientId, b.phone, b.billingStatus, b.status].some(v => String(v || "").toLowerCase().includes(search.trim().toLowerCase())))
                  .map((b) => (
                    <tr key={b._id}>
                      <td><strong>{b.billId}</strong></td>
                      <td>
                        <strong>{b.patientName}</strong>
                        <br />
                        <small>{b.patientId} · {b.age} yrs · {b.gender}</small>
                      </td>
                      <td style={{ fontWeight: 700 }}>₹{money(b.totalAmount)}</td>
                      <td style={{ color: "#0d9488" }}>₹{money(b.totalPaid)}</td>
                      <td style={{ color: b.balanceDue > 0 ? "#dc2626" : "#166534" }}>₹{money(b.balanceDue)}</td>
                      <td>
                        <span style={{
                          padding: "2px 8px",
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 700,
                          background: b.billingStatus === "paid" ? "#dcfce7" : b.billingStatus === "partial" ? "#fef3c7" : "#fee2e2",
                          color: b.billingStatus === "paid" ? "#166534" : b.billingStatus === "partial" ? "#92400e" : "#991b1b",
                        }}>
                          {b.billingStatus}
                        </span>
                      </td>
                      <td>{b.status}</td>
                      <td>{date(b.createdAt)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* --- TAB 8: Lab Accounts --- */}
      {tab === "lab-accounts" && data.investorData && (
        <section className="form-card" style={{ padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 12 }}>
            <input className="lims-input" style={{ maxWidth: 380 }} placeholder="Search accounts by code, name, type..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <div style={{ background: "#f8fafc", padding: "8px 16px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
              <small style={{ color: "#64748b", fontWeight: 700 }}>Assets/Liabilities Ratio: </small>
              <strong>{(data.investorData.analytics.totalAssets / (data.investorData.analytics.totalLiabilities || 1)).toFixed(2)}x</strong>
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Account Name</th>
                  <th>Type</th>
                  <th>Subtype</th>
                  <th style={{ textAlign: "right" }}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {data.investorData.accounts
                  .filter(a => [a.code, a.name, a.type, a.subtype].some(v => String(v || "").toLowerCase().includes(search.trim().toLowerCase())))
                  .map((a) => (
                    <tr key={a._id}>
                      <td><strong>{a.code}</strong></td>
                      <td><strong>{a.name}</strong></td>
                      <td>
                        <span style={{
                          padding: "2px 8px",
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          background: a.type === "asset" ? "#e0f2fe" : a.type === "liability" ? "#fef3c7" : a.type === "revenue" ? "#dcfce7" : a.type === "expense" ? "#fecaca" : "#f1f5f9",
                          color: a.type === "asset" ? "#0369a1" : a.type === "liability" ? "#92400e" : a.type === "revenue" ? "#166534" : a.type === "expense" ? "#991b1b" : "#475569"
                        }}>
                          {a.type}
                        </span>
                      </td>
                      <td>{a.subtype || "-"}</td>
                      <td style={{ textAlign: "right", fontWeight: 700 }}>₹{money(a.balance)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* --- TAB 9: All Patients --- */}
      {tab === "all-patients" && data.investorData && (
        <section className="form-card" style={{ padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 12 }}>
            <input className="lims-input" style={{ maxWidth: 380 }} placeholder="Search patients by name, phone, ref doctor..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Patient ID</th>
                  <th>Patient Name</th>
                  <th>Age / Gender</th>
                  <th>Phone Number</th>
                  <th>Address</th>
                  <th>Referral Doctor</th>
                  <th>Registered On</th>
                </tr>
              </thead>
              <tbody>
                {data.investorData.patients
                  .filter(p => [p.name, p.patientId, p.phone, p.email, p.address, p.refDoctorName].some(v => String(v || "").toLowerCase().includes(search.trim().toLowerCase())))
                  .map((p) => (
                    <tr key={p._id}>
                      <td><strong>{p.patientId}</strong></td>
                      <td><strong>{p.name}</strong></td>
                      <td>{p.age ? `${p.age} yrs` : "-"} / {p.gender || "Male"}</td>
                      <td>{p.phone}</td>
                      <td>{p.address || "N/A"}</td>
                      <td>{p.refDoctorName || "Direct / Self"}</td>
                      <td>{date(p.createdAt)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* --- Modal: Add Patient --- */}
      {showAddPatient && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
          <div className="form-card" style={{ maxWidth: 440, width: "100%", padding: 24, background: "#fff" }}>
            <h4 style={{ margin: "0 0 16px 0" }}>Register New Patient</h4>
            <form onSubmit={handleRegisterPatient} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700 }}>Patient Full Name *</label>
                <input required className="lims-input" value={patientForm.name} onChange={(e) => setPatientForm({ ...patientForm, name: e.target.value })} placeholder="John Doe" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700 }}>Phone Number *</label>
                <input required className="lims-input" value={patientForm.phone} onChange={(e) => setPatientForm({ ...patientForm, phone: e.target.value })} placeholder="9876543210" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Date of Birth *</label>
                  <input required type="date" className="lims-input" value={patientForm.dob} onChange={(e) => setPatientForm({ ...patientForm, dob: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Age</label>
                  <input type="number" className="lims-input" value={patientForm.age} onChange={(e) => setPatientForm({ ...patientForm, age: e.target.value })} placeholder="35" />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700 }}>Gender</label>
                <select className="lims-input" value={patientForm.gender} onChange={(e) => setPatientForm({ ...patientForm, gender: e.target.value })}>
                  <option>Male</option>
                  <option>Female</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700 }}>Address (Optional)</label>
                <input className="lims-input" value={patientForm.address} onChange={(e) => setPatientForm({ ...patientForm, address: e.target.value })} placeholder="Street / City" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700 }}>Email Address (Optional)</label>
                <input type="email" className="lims-input" value={patientForm.email} onChange={(e) => setPatientForm({ ...patientForm, email: e.target.value })} placeholder="patient@example.com" />
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
                <button type="button" className="btn-lims-secondary" onClick={() => setShowAddPatient(false)}>Cancel</button>
                <button type="submit" className="btn-lims-primary" disabled={savingPatient}>{savingPatient ? "Registering..." : "Register Patient"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Modal: Assign Test Package --- */}
      {showTestRequest && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
          <div className="form-card" style={{ maxWidth: 540, width: "100%", padding: 24, background: "#fff", maxHeight: "90vh", overflowY: "auto" }}>
            <h4 style={{ margin: "0 0 16px 0" }}>Assign Test Package &amp; Send to Lab</h4>
            <form onSubmit={handleSubmitTestRequest} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700 }}>Select Patient *</label>
                <select required className="lims-input" value={selectedPatientId} onChange={(e) => setSelectedPatientId(e.target.value)}>
                  <option value="">-- Choose Patient --</option>
                  {(data?.registeredPatients || []).map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name} ({p.patientId || p.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700 }}>Available Test Packages</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 140, overflowY: "auto", border: "1px solid #e2e8f0", padding: 8, borderRadius: 6 }}>
                  {availablePackages.map((pkg) => (
                    <label key={pkg._id || pkg.code} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                      <span>
                        <input
                          type="checkbox"
                          checked={selectedPackages.some((p) => p.packageId === pkg._id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedPackages([...selectedPackages, { packageId: pkg._id, name: pkg.name, price: pkg.price }]);
                            } else {
                              setSelectedPackages(selectedPackages.filter((p) => p.packageId !== pkg._id));
                            }
                          }}
                        />{" "}
                        {pkg.name}
                      </span>
                      <strong>₹{pkg.price}</strong>
                    </label>
                  ))}
                  {!availablePackages.length && <small style={{ color: "#64748b" }}>No active test packages configured.</small>}
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700 }}>Individual Tests</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 140, overflowY: "auto", border: "1px solid #e2e8f0", padding: 8, borderRadius: 6 }}>
                  {availableTests.map((t) => (
                    <label key={t._id || t.code} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                      <span>
                        <input
                          type="checkbox"
                          checked={selectedTests.some((item) => item.testId === t._id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTests([...selectedTests, { testId: t._id, name: t.name, price: t.price }]);
                            } else {
                              setSelectedTests(selectedTests.filter((item) => item.testId !== t._id));
                            }
                          }}
                        />{" "}
                        {t.name}
                      </span>
                      <strong>₹{t.price}</strong>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700 }}>Patient Vitals (Optional)</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  <input className="lims-input" placeholder="BP (120/80)" value={vitals.bp} onChange={(e) => setVitals({ ...vitals, bp: e.target.value })} />
                  <input className="lims-input" placeholder="Pulse (72 bpm)" value={vitals.pulse} onChange={(e) => setVitals({ ...vitals, pulse: e.target.value })} />
                  <input className="lims-input" placeholder="Weight (kg)" value={vitals.weight} onChange={(e) => setVitals({ ...vitals, weight: e.target.value })} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700 }}>Doctor Clinical Notes</label>
                <textarea className="lims-input" rows={2} placeholder="Fasting required, special instructions..." value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
                <button type="button" className="btn-lims-secondary" onClick={() => setShowTestRequest(false)}>Cancel</button>
                <button type="submit" className="btn-lims-primary" disabled={submittingRequest}>{submittingRequest ? "Sending..." : "Submit Test Request to Lab"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
