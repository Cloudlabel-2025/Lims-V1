"use client";

import { memo, useCallback, useState, useEffect, useRef } from "react";
import { Icons } from "@/app/components/Icons";
import { useTenantShell } from "@/app/lib/use-current-user";
import QRCode from "qrcode";

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
  onExternalSettle,
}) {
  const { theme } = useTenantShell();
  const [upiSubMode, setUpiSubMode] = useState("razorpay"); // 'razorpay' or 'direct'
  const [directQrUrl, setDirectQrUrl] = useState("");
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState("");
  const [qrCode, setQrCode] = useState(null);
  const [isPolling, setIsPolling] = useState(false);

  useEffect(() => {
    if (upiSubMode === "direct" && theme?.upiId && payment.amount > 0) {
      const upiUri = `upi://pay?pa=${theme.upiId}&pn=${encodeURIComponent(theme.labName || "LIMS")}&am=${payment.amount}&cu=INR&tn=${encodeURIComponent(billingRecord.billId)}`;
      QRCode.toDataURL(upiUri, { margin: 1, width: 300 })
        .then((url) => setDirectQrUrl(url))
        .catch((err) => console.error("QR generation error:", err));
    }
  }, [upiSubMode, theme, payment.amount, billingRecord.billId]);

  const pollingRef = useRef(null);

  useEffect(() => {
    if (!isPolling || !qrCode?.id) return;

    const pollStatus = async () => {
      try {
        const res = await fetch(
          `/api/billing/razorpay/status?qrCodeId=${qrCode.id}&billingRecordId=${billingRecord._id}`
        );
        const data = await res.json();
        if (res.ok && data.paid) {
          setIsPolling(false);
          if (onExternalSettle) {
            onExternalSettle(data.result);
          }
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    };

    pollingRef.current = setInterval(pollStatus, 3000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [isPolling, qrCode, billingRecord, onExternalSettle]);

  const handleGenerateQR = async () => {
    setQrLoading(true);
    setQrError("");
    setQrCode(null);
    try {
      const res = await fetch("/api/billing/razorpay/qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billingRecordId: billingRecord._id,
          amount: payment.amount,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate QR");
      setQrCode({ id: data.qrCodeId, imageUrl: data.imageUrl });
      setIsPolling(true);
    } catch (err) {
      setQrError(err.message);
    } finally {
      setQrLoading(false);
    }
  };

  const handleCancelQR = () => {
    setIsPolling(false);
    setQrCode(null);
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }
  };
  const netPayable = billingRecord?.totalAmount || 0;
  const alreadyPaid =
    Number(billingRecord?.paymentBreakdown?.cash || 0) +
    Number(billingRecord?.paymentBreakdown?.card || 0) +
    Number(billingRecord?.paymentBreakdown?.online || 0) +
    Number(billingRecord?.paymentBreakdown?.corporate || 0);
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

  if (!billingRecord) return null;

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
                  disabled={closing || qrCode}
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
                  disabled={closing || qrCode}
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

              {payment.method === "upi" && (
                <div style={{ marginTop: "6px", padding: "14px", border: "1.5px dashed var(--border)", borderRadius: "var(--radius-md)", background: "var(--surface)" }}>
                  {theme?.upiId && (
                    <div className="btn-group w-100 mb-3" role="group">
                      <button
                        type="button"
                        className={`btn btn-sm ${upiSubMode === "razorpay" ? "btn-primary" : "btn-outline-primary"}`}
                        onClick={() => { setUpiSubMode("razorpay"); handleCancelQR(); }}
                        disabled={qrCode}
                        style={{ flex: 1 }}
                      >
                        Razorpay Auto-Track
                      </button>
                      <button
                        type="button"
                        className={`btn btn-sm ${upiSubMode === "direct" ? "btn-primary" : "btn-outline-primary"}`}
                        onClick={() => { setUpiSubMode("direct"); handleCancelQR(); }}
                        disabled={qrCode}
                        style={{ flex: 1 }}
                      >
                        Direct UPI (GPay)
                      </button>
                    </div>
                  )}

                  {upiSubMode === "razorpay" ? (
                    <>
                      {qrError && <div style={{ color: "var(--error)", fontSize: "13px", marginBottom: "8px" }}>{qrError}</div>}
                      
                      {!qrCode ? (
                        <button
                          type="button"
                          onClick={handleGenerateQR}
                          disabled={qrLoading || totalPaid <= 0 || totalPaid > remainingDue}
                          className="btn-lims-primary"
                          style={{ width: "100%", height: "40px" }}
                        >
                          {qrLoading ? "Generating payment QR..." : "Generate Razorpay payment QR"}
                        </button>
                      ) : (
                        <div style={{ textAlign: "center", padding: "5px 0" }}>
                          <div style={{ fontWeight: "700", fontSize: "14px", color: "var(--brand-action, var(--primary))", marginBottom: "10px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                            <span className="spinner-border spinner-border-sm text-primary" role="status" aria-hidden="true" style={{ width: "14px", height: "14px" }}></span>
                            <span>Waiting for payment...</span>
                          </div>
                          
                          {qrCode.imageUrl && (
                            <div style={{ background: "#fff", padding: "12px", display: "inline-block", borderRadius: "8px", border: "1.5px solid var(--border)", marginBottom: "10px" }}>
                              <img src={qrCode.imageUrl} alt="Razorpay UPI Payment QR" style={{ width: "160px", height: "160px", display: "block", margin: "0 auto" }} />
                            </div>
                          )}
                          
                          <p style={{ margin: "4px 0 12px", fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.4" }}>
                            Scan using GPay, PhonePe, Paytm, or any UPI app to pay <strong>₹{Number(totalPaid).toLocaleString("en-IN")}</strong>.
                          </p>
                          
                          <button
                            type="button"
                            onClick={handleCancelQR}
                            className="btn-lims-secondary"
                            style={{ height: "32px", padding: "0 12px", fontSize: "12px" }}
                          >
                            Cancel QR Code
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ textAlign: "center", padding: "5px 0" }}>
                      <div style={{ fontWeight: "700", fontSize: "14px", color: "var(--success)", marginBottom: "10px" }}>
                        Direct Scanner Payment (Opens GPay)
                      </div>
                      
                      {directQrUrl && (
                        <div style={{ background: "#fff", padding: "12px", display: "inline-block", borderRadius: "8px", border: "1.5px solid var(--border)", marginBottom: "10px" }}>
                          <img src={directQrUrl} alt="Direct UPI Payment QR" style={{ width: "160px", height: "160px", display: "block", margin: "0 auto" }} />
                        </div>
                      )}
                      
                      <p style={{ margin: "4px 0 8px", fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.4" }}>
                        UPI VPA: <code>{theme?.upiId}</code>
                      </p>
                      
                      <p style={{ margin: "4px 0 12px", fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.4" }}>
                        Scanning this QR code will open Google Pay directly on the patient&apos;s phone. Once payment is confirmed on your device, click <strong>Collect balance</strong> below to settle manually.
                      </p>
                    </div>
                  )}
                </div>
              )}
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
          {payment.method === "upi" && upiSubMode === "razorpay" ? (
            qrCode ? (
              <button
                type="button"
                disabled
                className="btn-lims-primary"
                style={{ height: "40px", padding: "0 24px", opacity: 0.7 }}
              >
                Waiting for scan...
              </button>
            ) : (
              <button
                type="button"
                disabled
                className="btn-lims-primary"
                style={{ height: "40px", padding: "0 24px", opacity: 0.5 }}
              >
                Use Razorpay button above
              </button>
            )
          ) : (
            <button
              type="button"
              onClick={onSubmit}
              disabled={closing || totalPaid <= 0 || totalPaid > remainingDue}
              className="btn-lims-primary"
              style={{ height: "40px", padding: "0 24px" }}
            >
              {closing ? "Recording payment…" : remaining > 0 ? "Record partial payment" : "Collect full balance"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(SettlementModal);
