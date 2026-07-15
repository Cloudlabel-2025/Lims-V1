"use client";

import { memo } from "react";
import { Icons } from "@/app/components/Icons";

const paymentMethods = [
  { key: "cash", label: "Cash" },
  { key: "card", label: "Card" },
  { key: "online", label: "UPI / Online" },
];

function SettlementModal({
  billingRecord,
  closing,
  payment,
  onClose,
  onPaymentChange,
  onSubmit,
}) {
  if (!billingRecord) return null;

  const netPayable = billingRecord.totalAmount || 0;
  const alreadyPaid =
    Number(billingRecord.paymentBreakdown?.cash || 0) +
    Number(billingRecord.paymentBreakdown?.card || 0) +
    Number(billingRecord.paymentBreakdown?.online || 0) +
    Number(billingRecord.paymentBreakdown?.corporate || 0);
  const remainingDue = Math.max(0, netPayable - alreadyPaid);
  const totalPaid = Number(payment.cash) + Number(payment.card) + Number(payment.online);
  const remaining = remainingDue - totalPaid;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: "520px", width: "95%", textAlign: "left", padding: 0, overflow: "hidden", animation: "modalSlideUp 0.3s var(--ease-spring)" }}>
        <div style={{ padding: "20px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <div>
            <h4 style={{ margin: 0, fontSize: "18px" }}>Finalize Settlement</h4>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--text-muted)" }}>
              {billingRecord.billId} · {billingRecord.patient?.name} · {billingRecord.items?.length || 0} investigations
            </p>
          </div>
          <button onClick={onClose} style={{ width: "32px", height: "32px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", transition: "all var(--duration-fast)" }}>{Icons.close}</button>
        </div>

        <div style={{ padding: "20px 20px", maxHeight: "70vh", overflowY: "auto" }}>
          <div>
            <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "14px" }}>Payment Breakdown</div>

            <div style={{ background: "var(--primary-50)", border: "1px solid var(--primary-100)", borderRadius: "var(--radius-md)", padding: "16px", marginBottom: "18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: "14px" }}>
                <span style={{ fontWeight: "700", color: "var(--text-primary)" }}>Total Amount</span>
                <span style={{ fontWeight: "800", fontSize: "20px", color: "var(--brand-action, var(--primary))" }}>₹{netPayable}</span>
              </div>
              {alreadyPaid > 0 && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: "13px", color: "var(--text-secondary)" }}>
                    <span>Already Paid</span>
                    <strong>₹{alreadyPaid}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: "13px", color: "var(--text-primary)" }}>
                    <span>Remaining Due</span>
                    <strong>₹{remainingDue}</strong>
                  </div>
                </>
              )}
              {billingRecord.commissionAmount > 0 && (
                <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px dashed var(--primary-200)", fontSize: "11px", color: "var(--brand-action, var(--primary))" }}>
                  Includes internal commission of <strong>₹{billingRecord.commissionAmount}</strong> for Dr. {billingRecord.referralDoctor?.name}
                </div>
              )}
            </div>

            <div style={{ display: "grid", gap: "10px" }}>
              {paymentMethods.map((method) => (
                <label key={method.key} className="lims-label" style={{ margin: 0 }}>
                  <span style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)", marginBottom: "4px", display: "block" }}>{method.label}</span>
                  <input
                    type="number"
                    className="lims-input"
                    style={{ height: "38px", fontWeight: "600" }}
                    value={payment[method.key]}
                    min="0"
                    max={remainingDue}
                    step="0.01"
                    onChange={(event) => {
                      const val = Number(event.target.value);
                      if (val < 0) return;
                      onPaymentChange(method.key, val);
                    }}
                  />
                </label>
              ))}
            </div>
            {remaining < 0 && (
              <div style={{
                marginTop: "8px",
                padding: "8px 12px",
                borderRadius: "var(--radius-sm)",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#dc2626",
                fontSize: "12px",
                fontWeight: "600",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}>
                <span>⚠</span>
                <span>Overpaid by ₹{Math.abs(remaining)}. Payment cannot exceed remaining balance.</span>
              </div>
            )}

            <div style={{
              marginTop: "12px",
              padding: "10px 14px",
              borderRadius: "var(--radius-sm)",
              background: remaining === 0 ? "var(--primary-50)" : "#fffbeb",
              border: `1px solid ${remaining === 0 ? "var(--primary-200)" : "#fde68a"}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "12px",
              fontWeight: "600"
            }}>
              <span style={{ color: remaining === 0 ? "var(--primary-dark)" : "#d97706" }}>
                {remaining === 0 ? "✓ Fully settled" : remaining > 0 ? "Balance due" : "Overpaid"}
              </span>
              {remaining !== 0 && <span style={{ color: remaining > 0 ? "#d97706" : "#dc2626" }}>₹{Math.abs(remaining)}</span>}
            </div>
          </div>
        </div>

        <div style={{ padding: "16px 20px", borderTop: "1px solid var(--border)", display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <button className="btn-modal-cancel" onClick={onClose}>Cancel</button>
          <button
            className="btn-modal-confirm"
            onClick={onSubmit}
            disabled={closing}
            style={closing ? { opacity: 0.6, cursor: "not-allowed" } : {}}
          >
            {closing ? "Processing..." : `Complete Settlement · ₹${totalPaid}`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(SettlementModal);
