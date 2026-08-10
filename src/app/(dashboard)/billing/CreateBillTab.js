"use client";

import dynamic from "next/dynamic";
import styles from "./Billing.module.css";

const MultiSelect = dynamic(() => import("@/app/components/MultiSelect"), {
  ssr: false,
  loading: () => <div className={styles.control}>Loading investigations…</div>,
});

const SearchableSelect = dynamic(() => import("@/app/components/SearchableSelect"), {
  ssr: false,
  loading: () => <div className={styles.control}>Loading patients…</div>,
});

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

function formatCurrency(value) {
  return currency.format(Number(value) || 0);
}

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
  activeDoctorRequest,
}) {
  const discountPct = Math.min(95, Math.max(0, Number(discountAmount) || 0));
  const taxPct = Math.min(95, Math.max(0, Number(taxAmount) || 0));
  const discountValue = Math.min(selectedTotal, Math.round((selectedTotal * discountPct) / 100 * 100) / 100);
  const taxValue = Math.round((selectedTotal * taxPct) / 100 * 100) / 100;
  const netPayable = Math.max(0, selectedTotal - discountValue + taxValue);
  const selectedPatient = patients.find((item) => item._id === patient);

  return (
    <form onSubmit={createBill} className={styles.composerGrid}>
      <section className={styles.panel} aria-labelledby="bill-details-title">
        {activeDoctorRequest && (
          <div style={{ background: "#f0fdf4", border: "1px solid #86efac", padding: "12px 16px", borderRadius: "10px", margin: "16px", color: "#166534", fontSize: "13px" }}>
            <strong>📋 Doctor Test Request Auto-Loaded</strong>: Pre-selected {(activeDoctorRequest.testPackages || []).length} Test Package(s) & {(activeDoctorRequest.tests || []).length} Test(s) requested by <strong>Dr. {activeDoctorRequest.doctor?.name || "Referring Doctor"}</strong>.
          </div>
        )}
        <div className={styles.panelHeader}>
          <p className={styles.eyebrow}>Invoice setup</p>
          <h2 id="bill-details-title">New investigation bill</h2>
          <p>Choose the patient and investigations first, then confirm pricing before generating the invoice.</p>
        </div>
        <div className={styles.panelBody}>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label htmlFor="billing-patient">Patient <span className={styles.required}>*</span></label>
              <SearchableSelect
                id="billing-patient"
                className={styles.control}
                value={patient}
                onChange={(event) => setPatient(event.target.value)}
                name="patient"
                placeholder="Search by patient name, ID, or phone"
                options={patients.map((item) => ({
                  value: item._id,
                  label: item.name,
                  sublabel: item.patientId,
                  searchTerms: `${item.name || ""} ${item.patientId || ""} ${item.phone || ""}`,
                }))}
                required
              />
              <div className={styles.fieldHint}>Invoices are linked permanently to the selected patient record.</div>
            </div>

            <div className={styles.field}>
              <label htmlFor="billing-priority">Service priority</label>
              <select
                id="billing-priority"
                className={styles.control}
                value={priority}
                onChange={(event) => setPriority(event.target.value)}
              >
                <option value="routine">Routine</option>
                <option value="urgent">Urgent (STAT)</option>
              </select>
              <div className={styles.fieldHint}>Urgent requests are highlighted in the laboratory workflow.</div>
            </div>

            <div className={`${styles.field} ${styles.fieldFull}`}>
              <label>Investigations <span className={styles.required}>*</span></label>
              <MultiSelect
                name="selectedTests"
                placeholder="Search tests or packages"
                options={investigationOptions}
                value={selectedTests}
                onChange={(event) => setSelectedTests(event.target.value)}
              />
              <div className={styles.fieldHint}>{selectedTests.length} selected · package inclusions retain their configured price.</div>
            </div>

            {canDiscountBilling && (
              <div className={styles.field}>
                <label htmlFor="billing-discount">Discount percentage</label>
                <input
                  id="billing-discount"
                  type="number"
                  className={styles.control}
                  min="0"
                  max="95"
                  step="0.01"
                  value={discountAmount}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === "" || (Number(value) >= 0 && Number(value) <= 95)) setDiscountAmount(value);
                  }}
                  placeholder="0.00"
                />
              </div>
            )}

            <div className={`${styles.field} ${canDiscountBilling ? "" : styles.fieldFull}`}>
              <label htmlFor="billing-tax">Tax percentage</label>
              <input
                id="billing-tax"
                type="number"
                className={styles.control}
                min="0"
                max="95"
                step="0.01"
                value={taxAmount}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value === "" || (Number(value) >= 0 && Number(value) <= 95)) setTaxAmount(value);
                }}
                placeholder="0.00"
              />
            </div>

            <div className={`${styles.field} ${styles.fieldFull}`}>
              <label htmlFor="billing-notes">Internal notes</label>
              <textarea
                id="billing-notes"
                className={styles.control}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                placeholder="Optional billing or collection note"
              />
            </div>
          </div>
        </div>
      </section>

      <aside className={`${styles.panel} ${styles.summaryPanel}`} aria-labelledby="bill-summary-title">
        <div className={styles.panelHeader}>
          <p className={styles.eyebrow}>Review</p>
          <h2 id="bill-summary-title">Invoice summary</h2>
          <p>{selectedPatient ? `${selectedPatient.name} · ${selectedPatient.patientId}` : "Select a patient to continue"}</p>
        </div>
        <div className={styles.summaryBody}>
          <div className={styles.summaryLine}><span>Investigations</span><strong>{selectedTests.length}</strong></div>
          <div className={styles.summaryLine}><span>Subtotal</span><strong>{formatCurrency(selectedTotal)}</strong></div>
          {discountPct > 0 && (
            <div className={`${styles.summaryLine} ${styles.summaryDiscount}`}>
              <span>Discount ({discountPct}%)</span><strong>− {formatCurrency(discountValue)}</strong>
            </div>
          )}
          {taxPct > 0 && (
            <div className={styles.summaryLine}><span>Tax ({taxPct}%)</span><strong>+ {formatCurrency(taxValue)}</strong></div>
          )}
          <div className={styles.summaryTotal}>
            <span>Net payable</span>
            <strong>{formatCurrency(netPayable)}</strong>
          </div>
          <div className={styles.summaryHelp}>
            Confirm the patient, investigations, discount, and tax. Generating the bill creates the corresponding laboratory work items.
          </div>
          <button
            type="submit"
            className={styles.primaryButton}
            disabled={!patient || selectedTests.length === 0 || saving}
          >
            {saving ? "Generating invoice…" : "Generate bill"}
          </button>
        </div>
      </aside>
    </form>
  );
}
