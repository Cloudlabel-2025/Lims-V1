"use client";

import { memo, useEffect, useState } from "react";
import { Icons } from "@/app/components/Icons";
import { cachedJsonFetch, clearCachedApi } from "@/app/lib/use-current-user";

const METHOD_LABEL = { cash: "Cash", card: "Card", upi: "UPI", "corporate-credit": "Corporate", cheque: "Cheque" };

function formatMethod(method) {
  if (!method) return "—";
  return METHOD_LABEL[method] || method;
}

function PaymentHistoryModal({ billId, isOpen, onClose, onRefresh }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen || !billId) return;
    let cancelled = false;

    async function fetchReceipts() {
      setLoading(true);
      setError("");
      try {
        const res = await cachedJsonFetch(`/api/billing/${billId}/receipts`, { force: true });
        if (!cancelled) {
          if (res.response.ok) {
            setData(res.data);
          } else {
            setError(res.data.error || "Failed to load payment history");
          }
        }
      } catch (err) {
        if (!cancelled) setError("Failed to load payment history");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchReceipts();
    return () => { cancelled = true; };
  }, [isOpen, billId]);

  if (!isOpen) return null;

  const bill = data?.billSummary;
  const receipts = data?.receipts || [];
  const totalPaid = receipts.length > 0 ? receipts[0].runningTotal : 0;
  const remaining = bill?.totalAmount ? Math.max(0, bill.totalAmount - totalPaid) : 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "640px", width: "95%", padding: 0, overflow: "hidden", animation: "modalSlideUp 0.3s var(--ease-spring)" }}
      >
        <div style={{ padding: "20px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <div>
            <h4 style={{ margin: 0, fontSize: "18px" }}>Payment History</h4>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--text-muted)" }}>
              {bill?.billId} · {bill?.patient?.name} · {bill?.investigationCount || 0} investigations
            </p>
          </div>
          <button onClick={onClose} style={{ width: "32px", height: "32px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", transition: "all var(--duration-fast)" }}>{Icons.close}</button>
        </div>

        <div style={{ padding: "20px 20px", maxHeight: "70vh", overflowY: "auto" }}>
          {error && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "var(--radius-md)", padding: "14px", marginBottom: "16px", color: "#dc2626", fontSize: "13px", fontWeight: "600", display: "flex", alignItems: "center", gap: "8px" }}>
              {Icons.alertCircle}
              <span>{error}</span>
            </div>
          )}

          <div style={{ background: "var(--primary-50)", border: "1px solid var(--primary-100)", borderRadius: "var(--radius-md)", padding: "16px", marginBottom: "18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: "14px" }}>
              <span style={{ fontWeight: "700", color: "var(--text-primary)" }}>Total Amount</span>
              <span style={{ fontWeight: "800", fontSize: "20px", color: "var(--brand-action, var(--primary))" }}>₹{Number(bill?.totalAmount || 0).toLocaleString("en-IN")}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: "13px", color: "var(--text-secondary)" }}>
              <span>Total Paid</span>
              <strong style={{ color: "var(--success)", fontSize: "18px" }}>₹{Number(totalPaid).toLocaleString("en-IN")}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: "13px", color: "var(--text-primary)" }}>
              <span>Remaining</span>
              <strong style={{ color: remaining > 0 ? "#d97706" : "var(--success)", fontSize: "18px" }}>₹{Number(remaining).toLocaleString("en-IN")}</strong>
            </div>
            <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px dashed var(--primary-200)", fontSize: "11px", color: "var(--brand-action, var(--primary))" }}>
              Bill Status: <strong>{bill?.billingStatus?.toUpperCase() || "UNPAID"}</strong>
            </div>
          </div>

          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 16px", color: "var(--text-muted)", fontSize: "13px", fontWeight: "500", gap: "10px" }}>
              <span className="lims-spinner" style={{ width: 20, height: 20 }} />
              Loading payment history...
            </div>
          ) : receipts.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "56px 16px", textAlign: "center", color: "var(--text-muted)" }}>
              {Icons.noResults}
              <p style={{ marginTop: "12px", fontSize: "16px", fontWeight: "700", color: "var(--text-secondary)" }}>No payments recorded</p>
              <p style={{ fontSize: "13px", marginTop: "4px" }}>This bill has no payment transactions yet.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {receipts.map((receipt, index) => (
                <div key={receipt._id} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "16px", transition: "box-shadow 0.2s" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap", marginBottom: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ width: "28px", height: "28px", borderRadius: "50%", background: "var(--primary-50)", color: "var(--brand-action, var(--primary))", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", fontSize: "12px", flexShrink: 0 }}>{index + 1}</span>
                      <div>
                        <div style={{ fontWeight: "700", fontSize: "14px", color: "var(--text-primary)" }}>₹{Number(receipt.amount).toLocaleString("en-IN")}</div>
                        <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em" }}>{formatMethod(receipt.method)}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right", minWidth: "120px" }}>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "2px" }}>{new Date(receipt.receivedAt).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}</div>
                      <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>by {receipt.receivedBy}</div>
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px", paddingTop: "8px", borderTop: "1px solid var(--border-light)" }}>
                    <div style={{ display: "flex", gap: "16px", fontSize: "12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--text-secondary)" }}>
                        {Icons.clock}
                        <span>Running Total: <strong style={{ color: "var(--text-primary)" }}>₹{Number(receipt.runningTotal).toLocaleString("en-IN")}</strong></span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--text-secondary)" }}>
                        {Icons.clock}
                        <span>Remaining: <strong style={{ color: Number(receipt.remaining) > 0 ? "#d97706" : "var(--success)" }}>₹{Number(receipt.remaining).toLocaleString("en-IN")}</strong></span>
                      </div>
                    </div>
                    {receipt.isRefunded && (
                      <span style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "var(--radius-sm)", padding: "4px 10px", fontSize: "11px", fontWeight: "600", color: "#dc2626", display: "flex", alignItems: "center", gap: "4px" }}>
                        {Icons.alertCircle}
                        Refunded
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: "16px 20px", borderTop: "1px solid var(--border)", display: "flex", gap: "12px", justifyContent: "flex-end" }}>
          <button className="btn-modal-cancel" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default memo(PaymentHistoryModal);