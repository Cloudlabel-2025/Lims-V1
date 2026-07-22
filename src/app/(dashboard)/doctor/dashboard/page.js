"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const money = (value) => Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const date = (value) => value ? new Date(value).toLocaleDateString("en-IN") : "-";

function Card({ label, value, tone = "#0d9488" }) {
  return <div className="form-card" style={{ padding: 18, borderTop: `3px solid ${tone}` }}><div style={{ color: "var(--text-muted)", fontSize: 12, fontWeight: 700 }}>{label}</div><div style={{ fontSize: 24, fontWeight: 800, marginTop: 6 }}>{value}</div></div>;
}

export default function DoctorDashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("patients");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/doctor/portal", { cache: "no-store" }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to load portal");
      if (!cancelled) setData(body);
    }).catch((err) => !cancelled && setError(err.message)).finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  const referrals = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return data?.referrals || [];
    return (data?.referrals || []).filter((item) => [item.billId, item.patient?.name, item.patient?.patientId, item.patient?.phone].some((v) => String(v || "").toLowerCase().includes(term)));
  }, [data, search]);

  if (loading) return <div className="form-card" style={{ padding: 30 }}>Loading doctor portal...</div>;
  if (error) return <div className="lims-alert danger">{error}</div>;
  const summary = data.summary;

  return <div style={{ paddingBottom: 40 }}>
    <div className="page-header" style={{ marginBottom: 20 }}><div><h4 style={{ margin: 0 }}>Welcome, {data.doctor.name}</h4><small>{data.doctor.doctorId} · {data.doctor.speciality} · {data.doctor.clinicName}</small></div></div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12, marginBottom: 22 }}>
      <Card label="Referred patients" value={summary.referralCount} />
      <Card label="Released reports" value={summary.releasedReportCount} tone="#2563eb" />
      <Card label="Estimated commission" value={`₹${money(summary.estimatedCommission)}`} tone="#d97706" />
      <Card label="Earned commission" value={`₹${money(summary.earnedCommission)}`} tone="#16a34a" />
      <Card label="Pending payout" value={`₹${money(summary.pendingPayout)}`} tone="#7c3aed" />
      <Card label="Paid commission" value={`₹${money(summary.paidCommission)}`} tone="#0891b2" />
    </div>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
      {[['patients','Referral patients'],['results','Released results'],['commissions','Commissions & payouts']].map(([id,label]) => <button key={id} className={tab === id ? "btn-lims-primary" : "btn-lims-secondary"} onClick={() => setTab(id)}>{label}</button>)}
    </div>
    {tab === "patients" && <section className="form-card" style={{ padding: 18 }}>
      <input className="lims-input" style={{ maxWidth: 380, marginBottom: 14 }} placeholder="Search patient, ID, phone or bill" value={search} onChange={(e) => setSearch(e.target.value)} />
      <div style={{ overflowX: "auto" }}><table className="table"><thead><tr><th>Patient</th><th>Referral</th><th>Tests</th><th>Payment</th><th>Commission</th><th></th></tr></thead><tbody>{referrals.map((item) => <tr key={item._id}><td><strong>{item.patient?.name}</strong><br/><small>{item.patient?.patientId} · {item.patient?.phone}</small></td><td>{item.billId}<br/><small>{date(item.referredAt)}</small></td><td>{item.tests.join(", ") || "-"}</td><td>{item.billingStatus}</td><td>₹{money(item.commissionAmount)}<br/><small>{item.commissionStatus}</small></td><td><Link href={`/doctor/patients/${item.patient?._id}`} className="btn-lims-secondary">View</Link></td></tr>)}</tbody></table>{!referrals.length && <p>No referral patients found.</p>}</div>
    </section>}
    {tab === "results" && <section className="form-card" style={{ padding: 18 }}><div style={{ overflowX: "auto" }}><table className="table"><thead><tr><th>Report</th><th>Patient</th><th>Test</th><th>Released</th><th>Result</th></tr></thead><tbody>{data.reports.map((report) => <tr key={report._id}><td>{report.reportId}</td><td>{report.patient?.name}<br/><small>{report.patient?.patientId}</small></td><td>{report.testSnapshot?.name}</td><td>{date(report.releasedAt)}</td><td>{(report.results || []).map((r) => `${r.name}: ${r.textValue || r.value || '-' } ${r.unit || ''}`).join(" · ")}</td></tr>)}</tbody></table>{!data.reports.length && <p>No released results yet.</p>}</div></section>}
    {tab === "commissions" && <section style={{ display: "grid", gap: 18 }}><div className="form-card" style={{ padding: 18 }}><h5>Commission by referral</h5><div style={{ overflowX: "auto" }}><table className="table"><thead><tr><th>Bill</th><th>Patient</th><th>Bill amount</th><th>Commission</th><th>Status</th></tr></thead><tbody>{data.referrals.map((item) => <tr key={item._id}><td>{item.billId}</td><td>{item.patient?.name}</td><td>₹{money(item.totalAmount)}</td><td>₹{money(item.commissionAmount)}</td><td>{item.commissionStatus}</td></tr>)}</tbody></table></div></div><div className="form-card" style={{ padding: 18 }}><h5>Payout history</h5><div style={{ overflowX: "auto" }}><table className="table"><thead><tr><th>Reference</th><th>Date</th><th>Amount</th><th>Description</th></tr></thead><tbody>{data.payouts.map((p) => <tr key={p._id}><td>{p.entryNumber}</td><td>{date(p.date)}</td><td>₹{money(p.amount)}</td><td>{p.description}</td></tr>)}</tbody></table>{!data.payouts.length && <p>No payouts recorded yet.</p>}</div></div></section>}
  </div>;
}
