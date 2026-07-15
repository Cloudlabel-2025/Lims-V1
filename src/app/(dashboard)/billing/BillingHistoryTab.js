"use client";

import { useState, useMemo } from "react";

const SORT_OPTIONS = [
  { value: "recent", label: "Recent Transaction" },
  { value: "oldest", label: "Oldest First" },
  { value: "billId-asc", label: "Bill ID (Ascending)" },
  { value: "billId-desc", label: "Bill ID (Descending)" },
  { value: "patient-asc", label: "Patient Name (A–Z)" },
  { value: "patient-desc", label: "Patient Name (Z–A)" },
  { value: "amount-desc", label: "Amount (High to Low)" },
  { value: "amount-asc", label: "Amount (Low to High)" },
];

const METHOD_LABEL = { cash: "Cash", card: "Card", upi: "UPI", "corporate-credit": "Corporate", cheque: "Cheque" };
function formatMethod(method) {
  if (!method) return "—";
  return METHOD_LABEL[method] || method;
}

function formatMethods(methods, fallbackMethod) {
  const uniqueMethods = Array.isArray(methods)
    ? methods.filter(Boolean).filter((method, index, list) => list.indexOf(method) === index)
    : [];
  if (uniqueMethods.length === 0) return formatMethod(fallbackMethod);
  return uniqueMethods.map((method) => METHOD_LABEL[method] || method).join(" + ");
}

function sortRecords(records, sortBy) {
  const sorted = [...records];
  switch (sortBy) {
    case "recent":
      return sorted.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    case "oldest":
      return sorted.sort((a, b) => new Date(a.updatedAt) - new Date(b.updatedAt));
    case "billId-asc":
      return sorted.sort((a, b) => (a.billId || "").localeCompare(b.billId || "", undefined, { numeric: true }));
    case "billId-desc":
      return sorted.sort((a, b) => (b.billId || "").localeCompare(a.billId || "", undefined, { numeric: true }));
    case "patient-asc":
      return sorted.sort((a, b) => (a.patient?.name || "").localeCompare(b.patient?.name || ""));
    case "patient-desc":
      return sorted.sort((a, b) => (b.patient?.name || "").localeCompare(a.patient?.name || ""));
    case "amount-desc":
      return sorted.sort((a, b) => (Number(b.totalAmount) || 0) - (Number(a.totalAmount) || 0));
    case "amount-asc":
      return sorted.sort((a, b) => (Number(a.totalAmount) || 0) - (Number(b.totalAmount) || 0));
    default:
      return sorted;
  }
}

function filterRecords(records, search) {
  if (!search.trim()) return records;
  const q = search.trim().toLowerCase();
  return records.filter((r) => {
    if (r.billId && r.billId.toLowerCase().includes(q)) return true;
    if (r.patient?.name && r.patient.name.toLowerCase().includes(q)) return true;
    if (r.patient?.patientId && r.patient.patientId.toLowerCase().includes(q)) return true;
    return false;
  });
}

export default function BillingHistoryTab({ billingRecords, pagination, loading, onPageChange }) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("recent");

  const displayedRecords = useMemo(() => {
    const seen = new Set();
    const unique = billingRecords.filter((r) => {
      if (seen.has(r._id)) return false;
      seen.add(r._id);
      return true;
    });
    return sortRecords(filterRecords(unique, search), sortBy);
  }, [billingRecords, search, sortBy]);

  return (
    <div className="form-card" style={{ padding: "0", overflowX: "auto" }}>
      <div className="form-card-header">
        <h6 style={{ margin: 0 }}>Billing History</h6>
        <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--text-muted)", fontWeight: "400" }}>All laboratory bills and payment statuses.</p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 20px", borderBottom: "1px solid var(--border-light)", flexWrap: "wrap" }}>
        <input
          className="lims-input"
          placeholder="Search by bill ID, patient name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: "1 1 220px", height: "36px", fontSize: "13px" }}
        />
        <select
          className="lims-select"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          style={{ flex: "0 0 auto", height: "36px", fontSize: "13px", padding: "0 28px 0 10px" }}
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div className="lims-table-container" style={{ overflowX: "auto" }}>
        <table className="lims-table" style={{ width: "100%", minWidth: "900px", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
              <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)" }}>Bill ID</th>
              <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)" }}>Patient Details</th>
              <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)" }}>Date</th>
              <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)" }}>Investigation(s)</th>
              <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)" }}>Bill Amount</th>
              <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)" }}>Total Amount Paid</th>
              <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)" }}>Amount Paid Now</th>
              <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)" }}>Remaining</th>
              <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)" }}>Paid On</th>
              <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)" }}>Payment Mode</th>
              <th style={{ padding: "14px 20px", textAlign: "center", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {displayedRecords.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ padding: "32px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
                  {search.trim() ? "No bills match your search." : "No billing records found."}
                </td>
              </tr>
            ) : (
              displayedRecords.map((billingRecord) => (
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
                  <td style={{ padding: "14px 20px" }}>
                    <span style={{ color: "var(--success)", fontSize: "14px", fontWeight: "600" }}>
                      ₹
                      {(() => {
                        const pb = billingRecord.paymentBreakdown || {};
                        const paid = Number(pb.cash || 0) + Number(pb.card || 0) + Number(pb.online || 0) + Number(pb.corporate || 0);
                        return paid || 0;
                      })()}
                    </span>
                  </td>
                  <td style={{ padding: "14px 20px" }}>
                    <span style={{ color: "var(--brand-action, var(--primary))", fontSize: "14px", fontWeight: "600" }}>
                      {billingRecord.lastPaymentAmount ? `₹${billingRecord.lastPaymentAmount}` : "—"}
                    </span>
                  </td>
                  <td style={{ padding: "14px 20px" }}>
                    <span style={{
                      color: billingRecord.billingStatus === "paid" ? "var(--success)" : "var(--warning-700)",
                      fontSize: "14px",
                      fontWeight: "600"
                    }}>
                      ₹
                      {(() => {
                        const pb = billingRecord.paymentBreakdown || {};
                        const paid = Number(pb.cash || 0) + Number(pb.card || 0) + Number(pb.online || 0) + Number(pb.corporate || 0);
                        const remaining = Math.max(0, Number(billingRecord.totalAmount || 0) - paid);
                        return remaining;
                      })()}
                    </span>
                  </td>
                  <td style={{ padding: "14px 20px", color: "var(--text-secondary)", fontSize: "13px" }}>
                    {billingRecord.billingStatus === "paid" || billingRecord.billingStatus === "partial"
                      ? new Date(billingRecord.lastPaymentDate || billingRecord.firstPaymentDate || billingRecord.updatedAt).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })
                      : "—"}
                  </td>
                  <td style={{ padding: "14px 20px", color: "var(--text-secondary)", fontSize: "13px" }}>
                    {formatMethods(billingRecord.lastPaymentModes, billingRecord.lastPaymentMethod)}
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
              ))
            )}
          </tbody>
        </table>
      </div>
      <PaginationControls pagination={pagination} loading={loading} onPageChange={onPageChange} />
    </div>
  );
}

function PaginationControls({ pagination, loading, onPageChange }) {
  if (!pagination || pagination.totalPages <= 1) return null;

  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", padding: "14px 20px", borderTop: "1px solid var(--border-light)", flexWrap: "wrap" }}>
      <span style={{ color: "var(--text-muted)", fontSize: "13px", fontWeight: 600 }}>
        Page {pagination.page} of {pagination.totalPages}
      </span>
      <div style={{ display: "flex", gap: "8px" }}>
        <button type="button" className="btn-lims-secondary" disabled={loading || pagination.page <= 1} onClick={() => onPageChange(Math.max(1, pagination.page - 1))} style={{ height: "36px", padding: "0 12px" }}>Previous</button>
        <button type="button" className="btn-lims-secondary" disabled={loading || pagination.page >= pagination.totalPages} onClick={() => onPageChange(Math.min(pagination.totalPages, pagination.page + 1))} style={{ height: "36px", padding: "0 12px" }}>Next</button>
      </div>
    </div>
  );
}
