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
  saving,
  createBill,
  billingRecords,
}) {
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
              placeholder="Search tests or packages..."
              options={investigationOptions}
              value={selectedTests}
              onChange={(e) => setSelectedTests(e.target.value)}
            />
          </label>

          <label className="module-full-label">
            Notes
            <textarea className="lims-input" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Clinical notes or billing remarks..." />
          </label>

          <div style={{
            background: "var(--surface)",
            padding: "20px",
            borderRadius: "var(--radius-md)",
            marginBottom: "20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <div>
              <span style={{ fontSize: "12px", color: "var(--text-muted)", display: "block" }}>Total Payable</span>
              <strong style={{ fontSize: "24px", color: "var(--brand-action, var(--primary))" }}>₹{selectedTotal}</strong>
            </div>
            <button type="submit" className="dash-btn-primary" disabled={!patient || selectedTests.length === 0 || saving}>
              {saving ? "Processing..." : "Generate Bill"}
            </button>
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
