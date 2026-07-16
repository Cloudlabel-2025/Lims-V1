"use client";

import { useState, useMemo } from "react";

const SORT_OPTIONS = [
  { value: "recent", label: "Recent Payment" },
  { value: "oldest", label: "Oldest First" },
  { value: "billId-asc", label: "Bill ID (Ascending)" },
  { value: "billId-desc", label: "Bill ID (Descending)" },
  { value: "patient-asc", label: "Patient Name (A–Z)" },
  { value: "patient-desc", label: "Patient Name (Z–A)" },
  { value: "amount-desc", label: "Amount Paid (High to Low)" },
  { value: "amount-asc", label: "Amount Paid (Low to High)" },
];

const METHOD_LABEL = { cash: "Cash", card: "Card", upi: "UPI", "corporate-credit": "Corporate", cheque: "Cheque" };
function formatMethod(method) {
  if (!method) return "—";
  return METHOD_LABEL[method] || method;
}

function sortTransactions(transactions, sortBy) {
  const sorted = [...transactions];
  switch (sortBy) {
    case "recent":
      return sorted.sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt));
    case "oldest":
      return sorted.sort((a, b) => new Date(a.receivedAt) - new Date(b.receivedAt));
    case "billId-asc":
      return sorted.sort((a, b) => (a.billId || "").localeCompare(b.billId || "", undefined, { numeric: true }));
    case "billId-desc":
      return sorted.sort((a, b) => (b.billId || "").localeCompare(a.billId || "", undefined, { numeric: true }));
    case "patient-asc":
      return sorted.sort((a, b) => (a.patientName || "").localeCompare(b.patientName || ""));
    case "patient-desc":
      return sorted.sort((a, b) => (b.patientName || "").localeCompare(a.patientName || ""));
    case "amount-desc":
      return sorted.sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0));
    case "amount-asc":
      return sorted.sort((a, b) => (Number(a.amount) || 0) - (Number(b.amount) || 0));
    default:
      return sorted;
  }
}

function filterTransactions(transactions, search) {
  if (!search.trim()) return transactions;
  const q = search.trim().toLowerCase();
  return transactions.filter((t) => {
    if (t.billId && t.billId.toLowerCase().includes(q)) return true;
    if (t.patientName && t.patientName.toLowerCase().includes(q)) return true;
    if (t.patientId && t.patientId.toLowerCase().includes(q)) return true;
    return false;
  });
}

export default function BillingHistoryTab({
  paymentTransactions,
  pagination,
  loading,
  onPageChange,
  onViewHistory,
}) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("recent");

  const displayedTransactions = useMemo(() => {
    const seen = new Set();
    const unique = paymentTransactions.filter((t) => {
      if (seen.has(t._id)) return false;
      seen.add(t._id);
      return true;
    });
    return sortTransactions(filterTransactions(unique, search), sortBy);
  }, [paymentTransactions, search, sortBy]);

  return (
    <div className="form-card" style={{ padding: "0", overflowX: "auto" }}>
      <div className="form-card-header">
        <h6 style={{ margin: 0 }}>Billing History</h6>
        <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--text-muted)", fontWeight: "400" }}>
          Individual payment transactions. Click &ldquo;View History&rdquo; to see all payments for a bill.
        </p>
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
        <table className="lims-table" style={{ width: "100%", minWidth: "1100px", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
              <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)" }}>Bill ID</th>
              <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)" }}>Patient Details</th>
              <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)" }}>Payment Date</th>
              <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)" }}>Investigation(s)</th>
              <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)" }}>Bill Amount</th>
              <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)" }}>Amount Paid Now</th>
              <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)" }}>Total Paid</th>
              <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)" }}>Remaining</th>
              <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)" }}>Payment Mode</th>
              <th style={{ padding: "14px 20px", textAlign: "center", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)" }}>Status</th>
              <th style={{ padding: "14px 20px", textAlign: "center", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {displayedTransactions.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ padding: "32px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
                  {search.trim() ? "No transactions match your search." : "No payment transactions found."}
                </td>
              </tr>
            ) : (
              displayedTransactions.map((txn) => (
                <tr
                  key={txn._id}
                  className="payment-history-row"
                  style={{
                    borderBottom: "1px solid var(--border-light)",
                    transition: "background 0.2s",
                    cursor: "pointer",
                  }}
                >
                  <td style={{ padding: "14px 20px" }}>
                    <span
                      style={{
                        fontWeight: "700",
                        color: "var(--brand-action, var(--primary))",
                        fontSize: "13px",
                      }}
                    >
                      {txn.billId}
                    </span>
                  </td>
                  <td style={{ padding: "14px 20px" }}>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontWeight: "600", color: "var(--text-primary)", fontSize: "14px" }}>{txn.patientName}</span>
                      <small style={{ color: "var(--text-muted)", fontSize: "11px" }}>ID: {txn.patientId}</small>
                    </div>
                  </td>
                  <td style={{ padding: "14px 20px", color: "var(--text-secondary)", fontSize: "13px" }}>
                    {new Date(txn.receivedAt).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    })}
                  </td>
                  <td style={{ padding: "14px 20px", color: "var(--text-secondary)", fontSize: "13px" }}>
                    <span style={{ background: "var(--border-light)", padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: "600" }}>
                      {txn.investigationCount || 0} Tests
                    </span>
                  </td>
                  <td style={{ padding: "14px 20px" }}>
                    <strong style={{ color: "var(--text-primary)", fontSize: "14px" }}>₹{Number(txn.invoiceTotalAmount || 0).toLocaleString("en-IN")}</strong>
                  </td>
                  <td style={{ padding: "14px 20px" }}>
                    <span style={{ color: "var(--brand-action, var(--primary))", fontSize: "14px", fontWeight: "600" }}>
                      ₹{Number(txn.amount || 0).toLocaleString("en-IN")}
                    </span>
                  </td>
                  <td style={{ padding: "14px 20px" }}>
                    <span style={{ color: "var(--success)", fontSize: "14px", fontWeight: "600" }}>
                      ₹{Number(txn.cumulativePaid || 0).toLocaleString("en-IN")}
                    </span>
                  </td>
                  <td style={{ padding: "14px 20px" }}>
                    <span
                      style={{
                        color: Number(txn.remaining || 0) > 0 ? "var(--warning-700)" : "var(--success)",
                        fontSize: "14px",
                        fontWeight: "600",
                      }}
                    >
                      ₹{Number(txn.remaining || 0).toLocaleString("en-IN")}
                    </span>
                  </td>
                  <td style={{ padding: "14px 20px", color: "var(--text-secondary)", fontSize: "13px" }}>
                    {formatMethod(txn.method)}
                  </td>
                  <td style={{ padding: "14px 20px", textAlign: "center" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "4px 10px",
                        borderRadius: "6px",
                        fontSize: "11px",
                        fontWeight: "700",
                        background: txn.billingStatus === "paid" ? "var(--success-50)" : "var(--warning-50)",
                        color: txn.billingStatus === "paid" ? "var(--success-700)" : "var(--warning-700)",
                        textTransform: "uppercase",
                      }}
                    >
                      {txn.billingStatus}
                    </span>
                  </td>
                  <td style={{ padding: "14px 20px", textAlign: "center" }}>
                    <button
                      type="button"
                      className="view-history-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewHistory?.(txn.invoiceId);
                      }}
                      title="View payment history for this bill"
                    >
                      View History
                    </button>
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
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "12px",
        padding: "14px 20px",
        borderTop: "1px solid var(--border-light)",
        flexWrap: "wrap",
      }}
    >
      <span style={{ color: "var(--text-muted)", fontSize: "13px", fontWeight: 600 }}>
        Page {pagination.page} of {pagination.totalPages}
      </span>
      <div style={{ display: "flex", gap: "8px" }}>
        <button
          type="button"
          className="btn-lims-secondary"
          disabled={loading || pagination.page <= 1}
          onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
          style={{ height: "36px", padding: "0 12px" }}
        >
          Previous
        </button>
        <button
          type="button"
          className="btn-lims-secondary"
          disabled={loading || pagination.page >= pagination.totalPages}
          onClick={() => onPageChange(Math.min(pagination.totalPages, pagination.page + 1))}
          style={{ height: "36px", padding: "0 12px" }}
        >
          Next
        </button>
      </div>
    </div>
  );
}