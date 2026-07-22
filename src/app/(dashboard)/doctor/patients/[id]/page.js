"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function DoctorPatientPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { fetch(`/api/doctor/portal/patients/${id}`, { cache: "no-store" }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setData(d); }).catch((e) => setError(e.message)); }, [id]);
  if (error) return <div className="lims-alert danger">{error}</div>;
  if (!data) return <div className="form-card" style={{ padding: 28 }}>Loading patient...</div>;
  return <div style={{ display: "grid", gap: 18 }}><div><Link href="/doctor/dashboard" className="btn-lims-secondary">Back to portal</Link></div><section className="form-card" style={{ padding: 20 }}><h4>{data.patient.name}</h4><p>{data.patient.patientId} · {data.patient.age} years · {data.patient.gender}</p><p>{data.patient.phone} {data.patient.email ? `· ${data.patient.email}` : ""}</p><p>{data.patient.address}</p></section><section className="form-card" style={{ padding: 20 }}><h5>Referral visits</h5>{data.referrals.map((bill) => <div key={bill._id} style={{ padding: "12px 0", borderBottom: "1px solid #e2e8f0" }}><strong>{bill.billId}</strong> · {new Date(bill.createdAt).toLocaleDateString("en-IN")}<br/><small>{bill.items.map((i) => i.testSnapshot?.name).filter(Boolean).join(", ")}</small></div>)}</section><section className="form-card" style={{ padding: 20 }}><h5>Released reports</h5>{data.reports.map((report) => <div key={report._id} style={{ padding: "14px 0", borderBottom: "1px solid #e2e8f0" }}><strong>{report.reportId} · {report.testSnapshot?.name}</strong><div style={{ marginTop: 8 }}>{report.results.map((r) => <span key={r.key} style={{ display: "inline-block", marginRight: 18 }}>{r.name}: <strong>{r.textValue || r.value || "-"} {r.unit || ""}</strong></span>)}</div>{report.remarks && <p>Remarks: {report.remarks}</p>}</div>)}{!data.reports.length && <p>No released reports yet.</p>}</section></div>;
}
