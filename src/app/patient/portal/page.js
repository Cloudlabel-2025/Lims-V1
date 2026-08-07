"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const money = (v) => Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const date = (v) => v ? new Date(v).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" }) : "-";

export default function PatientPortalPage() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("timeline");

  useEffect(() => {
    fetch("/api/patient-portal/me", { cache: "no-store" })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error || "Unable to load patient records");
        setData(body);
      })
      .catch((e) => setError(e.message));
  }, []);

  function speak() {
    if (!data || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(
      new SpeechSynthesisUtterance(`Hello ${data.patient.name}. You have ${data.reports.length} ready test reports and ${data.bills.length} visit records.`)
    );
  }

  async function logout() {
    await fetch("/api/patient-portal/logout", { method: "POST" });
    router.replace("/patient/login");
  }

  if (error) {
    return (
      <main style={shell}>
        <div style={card}>
          <h2 style={{ color: "#991b1b" }}>Session Expired or Portal Access Restricted</h2>
          <p style={{ color: "#64748b" }}>{error}</p>
          <button style={primary} onClick={() => router.replace("/patient/login")}>
            Sign in to Patient Portal
          </button>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main style={shell}>
        <div style={card}>Loading your patient records and visit history...</div>
      </main>
    );
  }

  return (
    <main style={shell}>
      <div style={{ width: "100%", maxWidth: 900 }}>
        <header style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#0d9488", letterSpacing: "0.05em" }}>Patient Self-Service Portal</span>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Welcome, {data.patient.name}</h1>
            <p style={{ margin: "4px 0 0 0", color: "#64748b", fontSize: 13 }}>
              Patient ID: <strong>{data.patient.patientId}</strong> · Phone: +91 {data.patient.phone || "N/A"}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={secondary} onClick={speak}>
              🔊 Listen
            </button>
            <button style={secondary} onClick={logout}>
              Sign out
            </button>
          </div>
        </header>

        <nav style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
          {[
            ["timeline", "🗓️", "Visit Timeline"],
            ["reports", "📄", "Test Reports"],
            ["bills", "🧾", "Billing & Receipts"],
          ].map(([id, icon, label]) => (
            <button key={id} onClick={() => setTab(id)} style={tab === id ? primary : secondary}>
              <span style={{ fontSize: 20, display: "block" }}>{icon}</span>
              {label}
            </button>
          ))}
        </nav>

        {/* --- Tab 1: Visit History & Timeline --- */}
        {tab === "timeline" && (
          <section style={{ display: "grid", gap: 14 }}>
            <div style={card}>
              <h3 style={{ margin: "0 0 12px 0", fontSize: 18 }}>Patient Visit Timeline</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {data.bills.map((bill) => (
                  <div key={bill._id} style={{ display: "flex", gap: 16, borderLeft: "3px solid #0d9488", paddingLeft: 14, paddingTop: 4, paddingBottom: 4 }}>
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>{date(bill.createdAt)}</span>
                      <h4 style={{ margin: "2px 0", fontSize: 15 }}>Visit Ref: {bill.billId}</h4>
                      <p style={{ margin: 0, fontSize: 13, color: "#475569" }}>
                        Tests Requested: {bill.tests.join(", ") || "General Diagnostics"}
                      </p>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 12, background: bill.billingStatus === "paid" ? "#dcfce7" : "#fef3c7", color: bill.billingStatus === "paid" ? "#166534" : "#92400e", display: "inline-block", marginTop: 6 }}>
                        Billing Status: {bill.billingStatus || "pending"}
                      </span>
                    </div>
                  </div>
                ))}
                {!data.bills.length && <p style={{ color: "#64748b" }}>No recorded visits found.</p>}
              </div>
            </div>
          </section>
        )}

        {/* --- Tab 2: Test Reports & Direct Download --- */}
        {tab === "reports" && (
          <section style={{ display: "grid", gap: 14 }}>
            {data.reports.map((report) => (
              <article key={report._id} style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 12 }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 18 }}>{report.testSnapshot?.name || "Lab Diagnostic Report"}</h2>
                    <p style={{ margin: "2px 0 0 0", fontSize: 12, color: "#64748b" }}>
                      Report #{report.reportId} · Released on {date(report.releasedAt)}
                    </p>
                  </div>
                  <span style={{ color: "#166534", background: "#dcfce7", padding: "4px 10px", borderRadius: 12, fontWeight: 800, fontSize: 12 }}>
                    ✓ OFFICIAL RELEASED REPORT
                  </span>
                </div>

                <div style={{ overflowX: "auto", marginBottom: 12 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f8fafc" }}>
                        <th style={cell}>Test Parameter</th>
                        <th style={cell}>Observed Value</th>
                        <th style={cell}>Reference Range</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(report.results || []).map((r) => (
                        <tr key={r.key || r.name}>
                          <td style={cell}>{r.name}</td>
                          <td style={{ ...cell, fontWeight: 800, color: "#0f172a" }}>
                            {r.textValue || r.value || "-"} {r.unit || ""}
                          </td>
                          <td style={cell}>{r.normalMin ?? "-"} – {r.normalMax ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {report.remarks && (
                  <p style={{ fontSize: 13, background: "#f1f5f9", padding: 10, borderRadius: 6, margin: "0 0 12px 0" }}>
                    <strong>Pathologist Remarks:</strong> {report.remarks}
                  </p>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #e2e8f0", paddingTop: 12 }}>
                  <small style={{ color: "#64748b" }}>Diagnostic reference report. Consult your physician for medical advice.</small>
                  <button style={primary} onClick={() => window.print()}>
                    ⬇️ Download / Print Report PDF
                  </button>
                </div>
              </article>
            ))}
            {!data.reports.length && <div style={card}>No released diagnostic reports available.</div>}
          </section>
        )}

        {/* --- Tab 3: Billing & Receipts --- */}
        {tab === "bills" && (
          <section style={{ display: "grid", gap: 14 }}>
            {data.bills.map((bill) => (
              <article key={bill._id} style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <h3 style={{ margin: 0 }}>Invoice #{bill.billId}</h3>
                  <small style={{ color: "#64748b" }}>Date: {date(bill.createdAt)}</small>
                </div>
                <p style={{ fontSize: 13, color: "#475569", margin: "0 0 12px 0" }}>
                  Items: <strong>{bill.tests.join(", ")}</strong>
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 14, background: "#f8fafc", padding: 12, borderRadius: 8 }}>
                  <span>Invoice Subtotal:</span>
                  <strong style={{ textAlign: "right" }}>₹{money(bill.subtotalAmount || bill.totalAmount)}</strong>
                  <span>Paid Amount:</span>
                  <strong style={{ textAlign: "right", color: "#166534" }}>₹{money(bill.paidAmount)}</strong>
                  <span>Outstanding Balance:</span>
                  <strong style={{ textAlign: "right", color: "#b91c1c" }}>₹{money(Math.max(0, bill.totalAmount - bill.paidAmount))}</strong>
                </div>
              </article>
            ))}
            {!data.bills.length && <div style={card}>No billing history recorded.</div>}
          </section>
        )}
      </div>
    </main>
  );
}

const shell = { minHeight: "100vh", background: "#f8fafc", padding: "16px", display: "flex", justifyContent: "center", fontFamily: "Inter, Arial, sans-serif" };
const card = { background: "white", borderRadius: 12, padding: 20, boxShadow: "0 4px 12px rgba(0,0,0,0.05)", border: "1px solid #e2e8f0" };
const primary = { border: 0, borderRadius: 8, background: "#0d9488", color: "white", padding: "8px 16px", fontSize: 14, fontWeight: 700, cursor: "pointer" };
const secondary = { border: "1px solid #cbd5e1", borderRadius: 8, background: "white", padding: "8px 14px", fontSize: 14, fontWeight: 700, cursor: "pointer", color: "#334155" };
const cell = { borderBottom: "1px solid #e2e8f0", padding: "10px 8px", textAlign: "left", fontSize: 13 };
