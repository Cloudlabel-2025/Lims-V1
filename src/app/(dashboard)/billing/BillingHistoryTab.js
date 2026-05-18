"use client";

export default function BillingHistoryTab({ billingRecords }) {
  return (
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
                  <span style={{ fontWeight: "700", color: "var(--brand-action, var(--primary))", fontSize: "13px" }}>{billingRecord.billId}</span>
                </td>
                <td style={{ padding: "14px 20px" }}>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontWeight: "600", color: "var(--text-primary)", fontSize: "14px" }}>{billingRecord.patient?.name || "N/A"}</span>
                    <small style={{ color: "var(--text-muted)", fontSize: "11px" }}>ID: {billingRecord.patient?.patientId || "—"}</small>
                  </div>
                </td>
                <td style={{ padding: "14px 20px", color: "var(--text-secondary)", fontSize: "13px" }}>
                  {new Date(billingRecord.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
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
  );
}
