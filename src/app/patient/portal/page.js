"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icons } from "@/app/components/Icons";
import { applyTheme } from "@/app/components/ThemeProvider";

const money = (v) => Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const date = (v) => v ? new Date(v).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" }) : "-";

function rangeText(result) {
  const hasMin = Number.isFinite(result.normalMin);
  const hasMax = Number.isFinite(result.normalMax);
  if (hasMin && hasMax) return `${result.normalMin} – ${result.normalMax}`;
  if (hasMin) return `≥ ${result.normalMin}`;
  if (hasMax) return `≤ ${result.normalMax}`;
  return "—";
}

export default function PatientPortalPage() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [labConfig, setLabConfig] = useState(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("timeline");
  const [activePrintId, setActivePrintId] = useState(null);

  useEffect(() => {
    async function init() {
      try {
        const tenantId = new URLSearchParams(window.location.search).get("tenantId");
        const themeUrl = tenantId ? `/api/theme?tenantId=${encodeURIComponent(tenantId)}` : "/api/theme";
        const [portalRes, themeRes] = await Promise.all([
          fetch("/api/patient-portal/me", { cache: "no-store" }).then(r => r.json()),
          fetch(themeUrl, { credentials: "include" }).then(r => r.json()).catch(() => ({}))
        ]);
        if (portalRes.error) throw new Error(portalRes.error);
        setData(portalRes);
        if (themeRes.theme) {
          setLabConfig(themeRes.theme);
          applyTheme(themeRes.theme);
        }
      } catch (e) {
        setError(e.message);
      }
    }
    init();
  }, []);

  async function logout() {
    await fetch("/api/patient-portal/logout", { method: "POST" });
    router.replace("/patient/login");
  }

  const handlePrint = (reportId) => {
    setActivePrintId(reportId);
    setTimeout(() => {
      window.print();
    }, 150);
  };

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

  function renderReport(report, isPrint = false) {
    const labName = labConfig?.labName || "Diagnostic Lab";
    const labLogo = labConfig?.logo;
    const templateLabel = "Diagnostic Test Report";
    const now = new Date();
    
    const totalParams = report.results?.length || 0;

    return (
      <div 
        className={`corporate-report-document clinical-report-v2`}
        style={{
          background: "white",
          color: "#182230",
          boxShadow: isPrint ? "none" : "0 4px 20px rgba(0,0,0,0.08)",
          border: isPrint ? "none" : "1px solid var(--brand-border)",
          borderRadius: isPrint ? 0 : 12,
          margin: isPrint ? "0" : "20px auto",
          width: "100%",
          maxWidth: isPrint ? "none" : 800,
          boxSizing: "border-box",
          padding: "24px 42px 34px",
          textAlign: "left"
        }}
      >
        <div className="clinical-report-accent" />
        <header className="clinical-letterhead" style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #9ba9b8", paddingBottom: 16 }}>
          <div className="clinical-letterhead-brand" style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span className="clinical-letterhead-logo" style={{ width: 58, height: 58, display: "inline-flex", alignItems: "center", justify: "center", overflow: "hidden", border: "1px solid var(--primary-200)", borderRadius: 8, background: "var(--primary)", color: "var(--on-primary, #fff)" }}>
              {labLogo ? <img src={labLogo} alt={labName} style={{ width: "100%", height: "100%", objectFit: "contain", background: "#fff" }} /> : Icons.logo}
            </span>
            <div>
              <strong style={{ display: "block", fontSize: 21, fontWeight: 850 }}>{labName}</strong>
              <span style={{ display: "block", color: "#475569", fontSize: 11.5, fontWeight: 700 }}>Diagnostic Laboratory Services</span>
              <small style={{ display: "block", color: "var(--brand-action, var(--primary-dark))", fontSize: 9.5, fontWeight: 700 }}>Accurate results · Responsible care</small>
            </div>
          </div>
          <div className="clinical-document-title" style={{ textAlign: "right" }}>
            <small style={{ display: "block", color: "#64748b", fontSize: 9.5, fontWeight: 800, textTransform: "uppercase" }}>Confidential medical record</small>
            <h2 style={{ margin: "4px 0 8px", fontSize: 17 }}>{templateLabel}</h2>
            <span className="clinical-document-status released" style={{ display: "inline-flex", border: "1px solid var(--primary-200)", background: "#ecfdf5", color: "#047857", padding: "4px 7px", fontSize: 9.5, fontWeight: 850, borderRadius: 4 }}>
              Released
            </span>
          </div>
        </header>

        <section className="clinical-report-identifiers corporate-report-section" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, padding: "16px 0", borderBottom: "1px solid #e2e8f0" }}>
          <div><small style={{ display: "block", color: "#64748b", fontSize: 9.5 }}>Report ID</small><strong>{report.reportId || "—"}</strong></div>
          <div><small style={{ display: "block", color: "#64748b", fontSize: 9.5 }}>Sample ID</small><strong>{report.sampleId || "—"}</strong></div>
          <div><small style={{ display: "block", color: "#64748b", fontSize: 9.5 }}>Registered</small><strong>{date(report.createdAt)}</strong></div>
          <div><small style={{ display: "block", color: "#64748b", fontSize: 9.5 }}>Document version</small><strong>Version {report.version || 1}</strong></div>
        </section>

        <section className="clinical-patient-registry corporate-report-section" style={{ padding: "16px 0", borderBottom: "1px solid #e2e8f0" }}>
          <header style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <small style={{ display: "block", color: "#64748b", fontSize: 9.5 }}>Patient details</small>
              <h2 style={{ margin: 0, fontSize: 18 }}>{data.patient?.name}</h2>
            </div>
            <strong>{data.patient?.patientId}</strong>
          </header>
          <div className="clinical-patient-fields" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px 24px" }}>
            <div><span style={{ display: "block", color: "#64748b", fontSize: 11, marginBottom: 2 }}>Age</span><strong style={{ fontSize: 14 }}>{data.patient?.age ? `${data.patient.age} years` : "—"}</strong></div>
            <div><span style={{ display: "block", color: "#64748b", fontSize: 11, marginBottom: 2 }}>Gender</span><strong style={{ fontSize: 14 }}>{data.patient?.gender || "—"}</strong></div>
            <div><span style={{ display: "block", color: "#64748b", fontSize: 11, marginBottom: 2 }}>Contact number</span><strong style={{ fontSize: 14 }}>{data.patient?.phone || "Not recorded"}</strong></div>
            <div style={{ gridColumn: "1 / -1" }}><span style={{ display: "block", color: "#64748b", fontSize: 11, marginBottom: 2 }}>Address</span><strong style={{ fontSize: 14 }}>{data.patient?.address || "Not recorded"}</strong></div>
          </div>
        </section>

        <section className="clinical-investigation-summary corporate-report-section" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12, padding: "16px 0", borderBottom: "1px solid #e2e8f0" }}>
          <div className="clinical-investigation-name">
            <small style={{ display: "block", color: "#64748b", fontSize: 9.5 }}>Investigation requested</small>
            <h2 style={{ margin: 0, fontSize: 15 }}>{report.testSnapshot?.name || "Diagnostic investigation"}</h2>
            <span style={{ color: "#64748b", fontSize: 12 }}>{report.testSnapshot?.categoryName || "Laboratory test"}</span>
          </div>
          <div><small style={{ display: "block", color: "#64748b", fontSize: 9.5 }}>Test code</small><strong>{report.testSnapshot?.code || "—"}</strong></div>
          <div><small style={{ display: "block", color: "#64748b", fontSize: 9.5 }}>Specimen</small><strong>{report.testSnapshot?.sampleType || "—"}</strong></div>
        </section>

        <section className="clinical-results-block corporate-report-section" style={{ padding: "16px 0" }}>
          <header style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <div><small style={{ display: "block", color: "#64748b", fontSize: 9.5 }}>Laboratory findings</small><h2 style={{ margin: 0, fontSize: 16 }}>Result summary</h2></div>
            <span style={{ color: "#64748b", fontSize: 13 }}>{totalParams} parameter{totalParams === 1 ? "" : "s"}</span>
          </header>
          <div className="corporate-results-table clinical-results-table" style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="corporate-result-head" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 2fr 1fr", padding: "8px 12px", background: "#f8fafc", fontWeight: 700, fontSize: 12, borderBottom: "2px solid #e2e8f0" }}>
              <span>Parameter</span><span>Value</span><span>Unit</span><span>Reference range</span><span>Flag</span>
            </div>
            {(report.results || []).map((result) => (
              <div key={result.key || result.name} className={`corporate-result-row ${result.flag || "normal"}`} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 2fr 1fr", padding: "10px 12px", borderBottom: "1px solid #e2e8f0", fontSize: 13, background: result.flag === "high" || result.flag === "low" ? "#fef2f2" : "transparent" }}>
                <span>{result.name}</span>
                <strong style={{ color: result.flag === "high" || result.flag === "low" ? "#b91c1c" : "#0f172a" }}>{result.textValue || result.value || "—"}</strong>
                <span>{result.unit || "—"}</span>
                <span>{rangeText(result)}</span>
                <span className="corporate-result-flag" style={{ color: result.flag === "high" || result.flag === "low" ? "#b91c1c" : "#64748b", fontWeight: result.flag !== "normal" ? 700 : 400 }}>
                  {result.flag === "normal" ? "Normal" : result.flag === "high" ? "↑ High" : "↓ Low"}
                </span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11, color: "#64748b", marginTop: 12, fontStyle: "italic" }}>
            Reference intervals may vary with age, gender, clinical condition, and analytical method. Please correlate results clinically.
          </p>
        </section>

        {report.remarks && (
          <section className="clinical-report-remarks corporate-report-section" style={{ padding: "16px 0", borderTop: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0" }}>
            <header><small style={{ display: "block", color: "#64748b", fontSize: 9.5 }}>Laboratory comment</small><h2 style={{ margin: 0, fontSize: 14 }}>Interpretation / Remarks</h2></header>
            <p style={{ margin: "6px 0 0 0", fontSize: 13, color: "#334155" }}>{report.remarks}</p>
          </section>
        )}

        <section className="clinical-authorization corporate-report-section" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 16, padding: "20px 0" }}>
          <div className="clinical-auth-note" style={{ display: "flex", gap: 8, background: "#f8fafc", padding: 12, borderRadius: 8, border: "1px solid #edf2f7" }}>
            <span style={{ fontSize: 18 }}>🛡️</span>
            <div>
              <strong style={{ display: "block", fontSize: 12 }}>Electronically generated report</strong>
              <p style={{ margin: 0, fontSize: 10.5, color: "#64748b" }}>Validation and release events are recorded in the laboratory audit trail.</p>
            </div>
          </div>
          <div className="corporate-signature">
            <small style={{ display: "block", color: "#64748b", fontSize: 9.5 }}>Reviewed by</small>
            <strong style={{ display: "block", fontSize: 13, marginTop: 4 }}>{report.reviewedBy || "Pending review"}</strong>
            <span style={{ display: "block", fontSize: 11, color: "#64748b", marginTop: 2 }}>{date(report.reviewedAt)}</span>
          </div>
          <div className="corporate-signature">
            <small style={{ display: "block", color: "#64748b", fontSize: 9.5 }}>Authorized by</small>
            <strong style={{ display: "block", fontSize: 13, marginTop: 4 }}>{report.releasedBy || report.approvedBy || "Pending authorization"}</strong>
            <span style={{ display: "block", fontSize: 11, color: "#64748b", marginTop: 2 }}>{date(report.releasedAt || report.approvedAt)}</span>
          </div>
        </section>

        <footer className="clinical-report-footer" style={{ borderTop: "2px solid var(--primary)", paddingTop: 12, marginTop: 20, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div><strong style={{ display: "block", fontSize: 13 }}>{labName}</strong><span style={{ fontSize: 11, color: "#64748b" }}>{report.reportId} · Diagnostic Test Report</span></div>
          <p style={{ margin: 0, fontSize: 10, color: "#64748b", flex: "1 1 100%" }}>
            This report relates only to the specimen tested. It is confidential and intended for the patient and authorized healthcare professionals.
          </p>
          <div style={{ display: "flex", justifyContent: "space-between", width: "100%", fontSize: 10, color: "#64748b", marginTop: 8 }}>
            <span>Generated {now.toLocaleDateString("en-IN")}</span>
            <span>End of report</span>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body > * {
            display: none !important;
          }
          #print-root-wrapper {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: white !important;
          }
        }
      ` }} />

      {activePrintId && (
        <div id="print-root-wrapper" style={{ display: "none" }}>
          {renderReport(data.reports.find(r => r._id === activePrintId), true)}
        </div>
      )}

      <main style={shell}>
        <div style={{ width: "100%", maxWidth: 900 }}>
          <header style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            <div>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--brand-action, var(--primary))", letterSpacing: "0.05em" }}>Patient Self-Service Portal</span>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Welcome, {data.patient.name}</h1>
              <p style={{ margin: "4px 0 0 0", color: "#64748b", fontSize: 13 }}>
                Patient ID: <strong>{data.patient.patientId}</strong> · Phone: +91 {data.patient.phone || "N/A"}
              </p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
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
                    <div key={bill._id} style={{ display: "flex", gap: 16, borderLeft: "3px solid var(--primary)", paddingLeft: 14, paddingTop: 4, paddingBottom: 4 }}>
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
            <section style={{ display: "grid", gap: 20 }}>
              {data.reports.map((report) => (
                <article key={report._id} style={{ background: "white", borderRadius: 12, padding: 16, boxShadow: "0 4px 12px rgba(0,0,0,0.05)", border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <small style={{ color: "#64748b", fontWeight: 700 }}>{report.reportId} · Released {date(report.releasedAt)}</small>
                    <button style={primary} onClick={() => handlePrint(report._id)}>
                      ⬇️ Download / Print Report PDF
                    </button>
                  </div>
                  
                  {/* Inline preview that looks exactly like the official A4 document */}
                  {renderReport(report, false)}
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
    </>
  );
}

const shell = { minHeight: "100vh", background: "#f8fafc", padding: "16px", display: "flex", justifyContent: "center", fontFamily: "Inter, Arial, sans-serif" };
const card = { background: "white", borderRadius: 12, padding: 20, boxShadow: "0 4px 12px rgba(0,0,0,0.05)", border: "1px solid #e2e8f0" };
const primary = { border: 0, borderRadius: 8, background: "var(--primary)", color: "var(--on-primary, white)", padding: "8px 16px", fontSize: 14, fontWeight: 700, cursor: "pointer" };
const secondary = { border: "1px solid #cbd5e1", borderRadius: 8, background: "white", padding: "8px 14px", fontSize: 14, fontWeight: 700, cursor: "pointer", color: "#334155" };
