"use client";

import dynamic from "next/dynamic";

const MultiSelect = dynamic(() => import("@/app/components/MultiSelect"), {
  ssr: false,
  loading: () => <div className="lims-input">Loading options...</div>,
});

export default function CreateBillTab({
  patients,
  patient,
  setPatient,
  priority,
  setPriority,
  selectedTests,
  setSelectedTests,
  investigationOptions,
  notes,
  setNotes,
  selectedTotal,
  discountAmount,
  setDiscountAmount,
  taxAmount,
  setTaxAmount,
  saving,
  createBill,
  billingRecords,
  canDiscountBilling = true,
}) {
  const netPayable = Math.max(0, selectedTotal - Number(discountAmount || 0) + Number(taxAmount || 0));
  return (
    <div className="module-grid">
      <section className="module-panel">
        <div className="module-panel-header">
          <h2>New Investigation Bill</h2>
          <p>Register tests for existing patients.</p>
        </div>
        <form className="module-form" onSubmit={createBill}>
          <div className="module-form-grid">
            <label>
              Select Patient <span className="required">*</span>
              <select className="lims-select" value={patient} onChange={(e) => setPatient(e.target.value)} required>
                <option value="">Choose patient...</option>
                {patients.map((item) => (
                  <option key={item._id} value={item._id}>{item.name} ({item.patientId})</option>
                ))}
              </select>
            </label>
            <label>
              Priority
              <select className="lims-select" value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="routine">Routine</option>
                <option value="urgent">Urgent (STAT)</option>
              </select>
            </label>
          </div>

          <label className="module-full-label">
            Select Investigations <span className="required">*</span>
            <MultiSelect
              name="selectedTests"
              placeholder="Search tests or packages"
              options={investigationOptions}
              value={selectedTests}
              onChange={(e) => setSelectedTests(e.target.value)}
            />
          </label>

          <label className="module-full-label">
            Notes
            <textarea className="lims-input" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Enter notes" />
          </label>

          <div className="module-form-grid">
            {canDiscountBilling && (
              <label>
                Discount (₹) <span className="required">*</span>
                <input
                  type="number"
                  className="lims-input"
                  min="0"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                  placeholder="0"
                />
              </label>
            )}
            <label>
              Tax (₹) <span className="required">*</span>
              <input
                type="number"
                className="lims-input"
                min="0"
                value={taxAmount}
                onChange={(e) => setTaxAmount(e.target.value)}
                placeholder="0"
              />
            </label>
          </div>

          <div style={{
            background: "var(--surface)",
            padding: "20px",
            borderRadius: "var(--radius-md)",
            marginBottom: "20px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "6px", color: "var(--text-muted)" }}>
              <span>Subtotal</span><span>₹{selectedTotal}</span>
            </div>
            {Number(discountAmount) > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "6px", color: "var(--success)" }}>
                <span>Discount</span><span>− ₹{discountAmount}</span>
              </div>
            )}
            {Number(taxAmount) > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "6px", color: "var(--text-secondary)" }}>
                <span>Tax</span><span>+ ₹{taxAmount}</span>
              </div>
            )}
            <div style={{ borderTop: "1px dashed var(--border)", paddingTop: "10px", marginTop: "6px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <span style={{ fontSize: "12px", color: "var(--text-muted)", display: "block" }}>Net Payable</span>
                <strong style={{ fontSize: "24px", color: "var(--brand-action, var(--primary))" }}>₹{netPayable}</strong>
              </div>
              <button type="submit" className="dash-btn-primary" disabled={!patient || selectedTests.length === 0 || saving}>
                {saving ? "Processing..." : "Generate Bill"}
              </button>
            </div>
          </div>
        </form>
      </section>

      <aside className="module-panel">
        <div className="module-panel-header">
          <h2>Recently Created</h2>
          <p>Quick view of latest bills</p>
        </div>
        <div className="test-card-list">
          {billingRecords.slice(0, 5).map((billingRecord) => (
            <article key={billingRecord._id} className="test-card">
              <div>
                <h3>{billingRecord.patient?.name}</h3>
                <span>{billingRecord.billId} · ₹{billingRecord.totalAmount}</span>
              </div>
              <strong className={billingRecord.billingStatus}>{billingRecord.billingStatus}</strong>
            </article>
          ))}
        </div>
      </aside>
    </div>
  );
}
