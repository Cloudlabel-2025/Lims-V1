"use client";

import dynamic from "next/dynamic";

const MultiSelect = dynamic(() => import("@/app/components/MultiSelect"), {
  ssr: false,
  loading: () => <div className="lims-input">Loading options...</div>,
});

const s = {
  label: {
    display: "block",
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--text-secondary)",
    marginBottom: "6px",
  },
  input: {
    width: "100%",
    height: "48px",
    padding: "0 14px",
    fontSize: "14px",
    border: "1.5px solid var(--border)",
    borderRadius: "8px",
    background: "#fff",
    color: "var(--text-primary)",
    outline: "none",
    fontFamily: "var(--font-main)",
    boxSizing: "border-box",
    MozAppearance: "textfield",
  },
  textarea: {
    width: "100%",
    minHeight: "48px",
    padding: "12px 14px",
    fontSize: "14px",
    border: "1.5px solid var(--border)",
    borderRadius: "8px",
    background: "#fff",
    color: "var(--text-primary)",
    outline: "none",
    fontFamily: "var(--font-main)",
    boxSizing: "border-box",
    resize: "vertical",
  },
  row: {
    display: "flex",
    flexWrap: "wrap",
    margin: "0 -9px",
  },
  col6: {
    flex: "1 1 0%",
    minWidth: "250px",
    padding: "0 9px",
  },
  col12: {
    flex: "0 0 100%",
    padding: "0 9px",
  },
  field: {
    marginBottom: "18px",
  },
};

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
  canDiscountBilling = true,
}) {
  const discountPct = Math.min(95, Math.max(0, Number(discountAmount) || 0));
  const taxPct = Math.min(95, Math.max(0, Number(taxAmount) || 0));
  const discountValue = Math.min(selectedTotal, Math.round((selectedTotal * discountPct) / 100 * 100) / 100);
  const taxValue = Math.round((selectedTotal * taxPct) / 100 * 100) / 100;
  const netPayable = Math.max(0, selectedTotal - discountValue + taxValue);
  return (
    <div className="module-grid" style={{ gridTemplateColumns: "1fr" }}>
      <section className="module-panel" style={{ padding: "24px" }}>
        <div style={{ marginBottom: "20px" }}>
          <h2 style={{ margin: "0 0 4px", fontSize: "17px", fontWeight: 800, color: "var(--text-primary)" }}>New Investigation Bill</h2>
          <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)" }}>Register tests for existing patients.</p>
        </div>
        <form onSubmit={createBill}>
          <div style={s.row}>
            <div style={{ ...s.col6, ...s.field }}>
              <label style={s.label}>
                Select Patient <span className="required">*</span>
              </label>
              <select style={s.input} value={patient} onChange={(e) => setPatient(e.target.value)} required>
                <option value="">Choose patient...</option>
                {patients.map((item) => (
                  <option key={item._id} value={item._id}>{item.name} ({item.patientId})</option>
                ))}
              </select>
            </div>
            <div style={{ ...s.col6, ...s.field }}>
              <label style={s.label}>Priority</label>
              <select style={s.input} value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="routine">Routine</option>
                <option value="urgent">Urgent (STAT)</option>
              </select>
            </div>
          </div>

          <div style={{ ...s.col12, ...s.field, padding: 0 }}>
            <label style={s.label}>
              Select Investigations <span className="required">*</span>
            </label>
            <MultiSelect
              name="selectedTests"
              placeholder="Search tests or packages"
              options={investigationOptions}
              value={selectedTests}
              onChange={(e) => setSelectedTests(e.target.value)}
            />
          </div>

          {canDiscountBilling && (
            <div style={s.row}>
              <div style={{ ...s.col6, ...s.field }}>
                <label style={s.label}>Discount (%)</label>
                <input
                  type="number"
                  style={s.input}
                  className="lims-input"
                  min="0"
                  max="95"
                  step="0.01"
                  value={discountAmount}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "" || (Number(v) >= 0 && Number(v) <= 95)) setDiscountAmount(v);
                  }}
                  placeholder="0"
                />
              </div>
              <div style={{ ...s.col6, ...s.field }}>
                <label style={s.label}>Tax (%)</label>
                <input
                  type="number"
                  style={s.input}
                  className="lims-input"
                  min="0"
                  max="95"
                  step="0.01"
                  value={taxAmount}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "" || (Number(v) >= 0 && Number(v) <= 95)) setTaxAmount(v);
                  }}
                  placeholder="0"
                />
              </div>
            </div>
          )}

          {!canDiscountBilling && (
            <div style={{ ...s.col12, ...s.field, padding: 0 }}>
              <label style={s.label}>Tax (%)</label>
              <input
                type="number"
                style={s.input}
                className="lims-input"
                min="0"
                max="95"
                step="0.01"
                value={taxAmount}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "" || (Number(v) >= 0 && Number(v) <= 95)) setTaxAmount(v);
                }}
                placeholder="0"
              />
            </div>
          )}

          <div style={{ ...s.col12, ...s.field, padding: 0 }}>
            <label style={s.label}>Notes</label>
            <textarea
              style={s.textarea}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Enter notes (optional)"
            />
          </div>

          <div style={{
            background: "var(--surface)",
            padding: "16px",
            borderRadius: "8px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "6px", color: "var(--text-muted)" }}>
              <span>Subtotal</span><span>₹{selectedTotal}</span>
            </div>
            {discountPct > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "6px", color: "var(--success)" }}>
                <span>Discount ({discountPct}%)</span><span>− ₹{discountValue}</span>
              </div>
            )}
            {taxPct > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "6px", color: "var(--text-secondary)" }}>
                <span>Tax ({taxPct}%)</span><span>+ ₹{taxValue}</span>
              </div>
            )}
            <div style={{ borderTop: "1px dashed var(--border)", paddingTop: "10px", marginTop: "6px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <span style={{ fontSize: "12px", color: "var(--text-muted)", display: "block" }}>Net Payable</span>
                <strong style={{ fontSize: "24px", color: "var(--brand-action, var(--primary))" }}>₹{netPayable}</strong>
              </div>
              <button type="submit" className="dash-btn-primary" disabled={!patient || selectedTests.length === 0 || saving} style={{ height: "48px", padding: "0 28px", fontSize: "14px", fontWeight: 700, borderRadius: "8px", border: "none", cursor: "pointer", background: saving ? "var(--primary-60)" : "var(--brand-action, var(--primary))", color: "#fff" }}>
                {saving ? "Processing..." : "Generate Bill"}
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}
