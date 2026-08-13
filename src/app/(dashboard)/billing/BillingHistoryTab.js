"use client";

import { useMemo, useState } from "react";
import { Icons } from "@/app/components/Icons";
import styles from "./Billing.module.css";
import { formatCurrency } from "./formatters";

const SORT_OPTIONS = [
  { value: "recent", label: "Most recent payment" },
  { value: "oldest", label: "Oldest payment" },
  { value: "billId-asc", label: "Bill ID · ascending" },
  { value: "billId-desc", label: "Bill ID · descending" },
  { value: "patient-asc", label: "Patient · A to Z" },
  { value: "patient-desc", label: "Patient · Z to A" },
  { value: "amount-desc", label: "Payment · high to low" },
  { value: "amount-asc", label: "Payment · low to high" },
];

const METHOD_LABEL = { cash: "Cash", card: "Card", upi: "UPI", "corporate-credit": "Corporate", cheque: "Cheque" };
function formatMethod(method) {
  if (!method) return "—";
  return METHOD_LABEL[method] || method;
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function sortTransactions(transactions, sortBy) {
  const sorted = [...transactions];
  switch (sortBy) {
    case "recent": return sorted.sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt));
    case "oldest": return sorted.sort((a, b) => new Date(a.receivedAt) - new Date(b.receivedAt));
    case "billId-asc": return sorted.sort((a, b) => (a.billId || "").localeCompare(b.billId || "", undefined, { numeric: true }));
    case "billId-desc": return sorted.sort((a, b) => (b.billId || "").localeCompare(a.billId || "", undefined, { numeric: true }));
    case "patient-asc": return sorted.sort((a, b) => (a.patientName || "").localeCompare(b.patientName || ""));
    case "patient-desc": return sorted.sort((a, b) => (b.patientName || "").localeCompare(a.patientName || ""));
    case "amount-desc": return sorted.sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0));
    case "amount-asc": return sorted.sort((a, b) => (Number(a.amount) || 0) - (Number(b.amount) || 0));
    default: return sorted;
  }
}

function filterTransactions(transactions, search) {
  if (!search.trim()) return transactions;
  const query = search.trim().toLowerCase();
  return transactions.filter((transaction) =>
    [transaction.billId, transaction.patientName, transaction.patientId]
      .some((value) => value?.toLowerCase().includes(query))
  );
}

export default function BillingHistoryTab({
  paymentTransactions,
  pagination,
  loading,
  onPageChange,
  onViewHistory,
  onRevert,
  canRefundBilling,
  reverting,
}) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("recent");

  const displayedTransactions = useMemo(() => {
    const seen = new Set();
    const unique = paymentTransactions.filter((transaction) => {
      if (seen.has(transaction._id)) return false;
      seen.add(transaction._id);
      return true;
    });
    return sortTransactions(filterTransactions(unique, search), sortBy);
  }, [paymentTransactions, search, sortBy]);

  return (
    <section className={styles.historyPanel} aria-labelledby="transaction-ledger-title">
      <div className={styles.historyHeader}>
        <div>
          <p className={styles.eyebrow}>Audit trail</p>
          <h2 id="transaction-ledger-title">Payment transactions</h2>
          <p>Every collection is recorded individually. Open a bill to review its complete payment timeline.</p>
        </div>
        <div className={styles.historyCount}>{displayedTransactions.length} transactions on this page</div>
      </div>

      <div className={styles.historyToolbar}>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>{Icons.search}</span>
          <input
            className={styles.historyInput}
            aria-label="Search transactions"
            placeholder="Search bill ID, patient name, or patient ID"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <select
          className={styles.historySelect}
          aria-label="Sort transactions"
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value)}
        >
          {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.historyTable}>
          <thead>
            <tr>
              <th>Invoice / patient</th>
              <th>Payment date</th>
              <th className={styles.money}>Bill total</th>
              <th className={styles.money}>This payment</th>
              <th className={styles.money}>Total paid</th>
              <th className={styles.money}>Balance due</th>
              <th>Method</th>
              <th>Status</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {displayedTransactions.length === 0 ? (
              <tr>
                <td colSpan={9} className={styles.historyEmpty}>
                  {search.trim() ? "No transactions match this search." : "No payment transactions have been recorded."}
                </td>
              </tr>
            ) : displayedTransactions.map((transaction) => (
              <tr key={transaction._id}>
                <td>
                  <div className={styles.patientCell}>
                    <strong>{transaction.patientName || "Unknown patient"}</strong>
                    <span><span className={styles.billLink}>{transaction.billId}</span> · {transaction.patientId || "No patient ID"} · {transaction.investigationCount || 0} tests</span>
                  </div>
                </td>
                <td className={styles.dateCell}>{formatDate(transaction.receivedAt)}</td>
                <td className={`${styles.money} ${styles.moneyValue}`}>{formatCurrency(transaction.invoiceTotalAmount)}</td>
                <td className={`${styles.money} ${styles.moneyValue}`}>{formatCurrency(transaction.amount)}</td>
                <td className={`${styles.money} ${styles.moneyValue} ${styles.moneyPaid}`}>{formatCurrency(transaction.cumulativePaid)}</td>
                <td className={`${styles.money} ${styles.moneyValue} ${Number(transaction.remaining || 0) > 0 ? styles.moneyDue : styles.moneyPaid}`}>
                  {formatCurrency(transaction.remaining)}
                </td>
                <td><span className={styles.methodBadge}>{formatMethod(transaction.method)}</span></td>
                <td>
                  <span className={`${styles.status} ${transaction.billingStatus === "paid" ? styles.statusPaid : styles.statusPartial}`}>
                    {transaction.billingStatus || "partial"}
                  </span>
                </td>
                <td>
                  <div className={styles.rowActions}>
                    <button
                      type="button"
                      className={styles.rowAction}
                      onClick={() => onViewHistory?.(transaction.invoiceId)}
                    >
                      View bill
                    </button>
                    {canRefundBilling && transaction.canRevert && typeof onRevert === "function" && (
                      <button
                        type="button"
                        className={`${styles.rowAction} ${styles.rowActionDanger}`}
                        onClick={() => onRevert?.(transaction.invoiceId)}
                        disabled={reverting}
                      >
                        {reverting ? "Reverting…" : "Revert"}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PaginationControls pagination={pagination} loading={loading} onPageChange={onPageChange} />
    </section>
  );
}

function PaginationControls({ pagination, loading, onPageChange }) {
  if (!pagination || pagination.totalPages <= 1) return null;
  return (
    <div className={styles.historyPagination}>
      <span className={styles.paginationText}>
        Page {pagination.page} of {pagination.totalPages} · {pagination.total || 0} transactions
      </span>
      <div className={styles.cardActions}>
        <button
          type="button"
          className={styles.secondaryButton}
          disabled={loading || pagination.page <= 1}
          onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
        >
          Previous
        </button>
        <button
          type="button"
          className={styles.secondaryButton}
          disabled={loading || pagination.page >= pagination.totalPages}
          onClick={() => onPageChange(Math.min(pagination.totalPages, pagination.page + 1))}
        >
          Next
        </button>
      </div>
    </div>
  );
}
