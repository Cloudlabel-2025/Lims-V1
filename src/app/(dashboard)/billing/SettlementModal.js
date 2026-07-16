"use client";

import { memo, useState, useCallback } from "react";
import { Icons } from "@/app/components/Icons";

const paymentMethods = [
  { key: "cash", label: "Cash" },
  { key: "card", label: "Card" },
  { key: "upi", label: "UPI" },
  { key: "corporate-credit", label: "Corporate Credit" },
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
  const totalPaid = Number(payment.amount);
  const remaining = remainingDue - totalPaid;

  const handleAmountChange = useCallback(
    (e) => {
      let value = e.target.value;
      // Allow only numbers and decimal point
      value = value.replace(/[^0-9.]/g, "");
      // Ensure only one decimal point
      const parts = value.split(".");
      if (parts.length > 2) {
        value = parts[0] + "." + parts.slice(1).join("");
      }
      // Limit to 10 characters max
      if (value.length > 10) {
        value = value.slice(0, 10);
      }
      const numValue = value === "" ? 0 : Number(value) || 0;
      onPaymentChange("amount", numValue);
    },
    [onPaymentChange]
  );

  const handleMethodChange = useCallback(
    (e) => {
      onPaymentChange("method", e.target.value);
    },
    [onPaymentChange]
  );

  return (
    <div className="modal-overlay">
      <div
        className="modal-content"
        style={{
          maxWidth: "520px",
          width: "95%",
          textAlign: "left",
          padding: 0,
          overflow: "hidden",
          animation: "modalSlideUp 0.3s var(--ease-spring)",
        }}
      >
        <div
          style={{
            padding: "20px 20px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h4 style={{ margin: 0, fontSize: "18px" }}>Finalize Settlement</h4>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--text-muted)" }}>
              {billingRecord.billId} · {billingRecord.patient?.name} · {billingRecord.items?.length || 0} investigations
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
              background: "#fff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-muted)",
              transition: "all var(--duration-fast)",
            }}
          >
            {Icons.close}
          </button>
        </div>

        <div style={{ padding: "20px 20px", maxHeight: "70vh", overflowY: "auto" }}>
          <div>
            <div
              style={{
                fontSize: "12px",
                fontWeight: "700",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "14px",
              }}
            >
              Payment Breakdown
            </div>

            <div
              style={{
                background: "var(--primary-50)",
                border: "1px solid var(--primary-100)",
                borderRadius: "var(--radius-md)",
                padding: "16px",
                marginBottom: "18px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: "14px" }}>
                <span>Bill Amount</span>
                <strong>₹{Number(netPayable).toLocaleString("en-IN")}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: "14px" }}>
                <span>Already Paid</span>
                <strong style={{ color: "var(--success)" }}>₹{Number(alreadyPaid).toLocaleString("en-IN")}</strong>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "6px 0",
                  fontSize: "14px",
                  borderTop: "1px solid var(--primary-200)",
                  marginTop: "4px",
                  paddingTop: "10px",
                }}
              >
                <span>Remaining Due</span>
                <strong style={{ color: remainingDue > 0 ? "var(--warning-700)" : "var(--success)" }}>
                  ₹{Number(remainingDue).toLocaleString("en-IN")}
                </strong>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "var(--text-secondary)",
                    marginBottom: "6px",
                  }}
                >
                  Amount <span style={{ color: "var(--error)" }}>*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  max={remainingDue}
                  step="0.01"
                  value={payment.amount || ""}
                  onChange={handleAmountChange}
                  disabled={closing}
                  className="lims-input"
                  style={{ height: "42px", fontSize: "16px" }}
                  placeholder="Enter amount"
                  maxLength={10}
                />
                {remainingDue > 0 && (
                  <p style={{ margin: "6px 0 0", fontSize: "12px", color: "var(--text-muted)" }}>
                    Max: ₹{Number(remainingDue).toLocaleString("en-IN")}
                  </p>
                )}
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "var(--text-secondary)",
                    marginBottom: "6px",
                  }}
                >
                  Payment Mode <span style={{ color: "var(--error)" }}>*</span>
                </label>
                <select
                  value={payment.method || "cash"}
                  onChange={handleMethodChange}
                  disabled={closing}
                  className="lims-select"
                  style={{ height: "42px", fontSize: "14px", width: "100%" }}
                >
                  {paymentMethods.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div
              style={{
                marginTop: "18px",
                padding: "12px",
                background: remaining < 0 ? "var(--error-50)" : "var(--surface)",
                border: remaining < 0 ? "1px solid var(--error-200)" : "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
                <span style={{ fontWeight: "600" }}>This Payment</span>
                <span
                  style={{
                    fontWeight: "700",
                    color: "var(--brand-action, var(--primary))",
                    fontSize: "16px",
                  }}
                >
                  ₹{Number(totalPaid).toLocaleString("en-IN")}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", marginTop: "4px" }}>
                <span style={{ fontWeight: "600" }}>Remaining After This</span>
                <span
                  style={{
                    fontWeight: "700",
                    color: remaining < 0 ? "var(--error)" : remaining > 0 ? "var(--warning-700)" : "var(--success)",
                    fontSize: "16px",
                  }}
                >
                  ₹{Number(Math.max(0, remaining)).toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            padding: "16px 20px",
            borderTop: "1px solid var(--border-light)",
            display: "flex",
            justifyContent: "flex-end",
            gap: "10px",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={closing}
            className="btn-lims-secondary"
            style={{ height: "40px", padding: "0 20px" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={closing || totalPaid <= 0 || totalPaid > remainingDue}
            className="btn-lims-primary"
            style={{ height: "40px", padding: "0 24px" }}
          >
            {closing ? "Processing..." : remaining > 0 ? "Record Partial Payment" : "Close Bill"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(SettlementModal);