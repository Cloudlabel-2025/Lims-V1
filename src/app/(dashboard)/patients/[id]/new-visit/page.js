"use client";
import dynamic from "next/dynamic";
import { useState, useEffect, useMemo, use } from "react";
import { useRouter } from "next/navigation";
import { Icons } from "@/app/components/Icons";
import SuccessDialog from "@/app/components/SuccessDialog";
import { formatDate, getInitials, getISTNow } from "@/app/utils/patient-helpers";
import { cachedJsonFetch, clearCachedApi } from "@/app/lib/use-current-user";

const MultiSelect = dynamic(() => import("@/app/components/MultiSelect"), {
  ssr: false,
  loading: () => <div className="lims-input">Loading options...</div>,
});

export default function NewVisit({ params }) {
  const resolvedParams = use(params);
  const { id } = resolvedParams;
  const router = useRouter();

  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [successMsg, setSuccessMsg] = useState("");

  const [tests, setTests] = useState([]);
  const [packages, setPackages] = useState([]);
  const [selectedTests, setSelectedTests] = useState([]);
  const [priority, setPriority] = useState("routine");
  const [receivedTime, setReceivedTime] = useState("");
  const [collectionTime, setCollectionTime] = useState("");
  const [errors, setErrors] = useState({});
  const [discountAmount, setDiscountAmount] = useState("");
  const [taxAmount, setTaxAmount] = useState("");
  const [notes, setNotes] = useState("");

  const selectedTotal = useMemo(() => {
    let total = 0;
    (selectedTests || []).forEach(itemKey => {
      if (itemKey.startsWith("test_")) {
        const t = tests.find(t => t._id === itemKey.replace("test_", ""));
        total += Number(t?.price || 0);
      } else if (itemKey.startsWith("pkg_")) {
        const p = packages.find(p => p._id === itemKey.replace("pkg_", ""));
        total += Number(p?.price || 0);
      }
    });
    return total;
  }, [tests, packages, selectedTests]);

  const investigationOptions = useMemo(
    () => [
      ...packages.map((pkg) => ({ value: `pkg_${pkg._id}`, label: pkg.name, sublabel: `Package · ₹${pkg.price}` })),
      ...tests.map((test) => ({ value: `test_${test._id}`, label: test.name, sublabel: `${test.category?.name} · ₹${test.price}` })),
    ],
    [packages, tests]
  );

  useEffect(() => {
    setReceivedTime(getISTNow());

    async function fetchData() {
      setFetching(true);
      try {
        const [patientRes, testRes, pkgRes] = await Promise.all([
          cachedJsonFetch(`/api/patient/${id}`, { ttl: 10_000 }),
          cachedJsonFetch("/api/tests/definitions?status=active", { ttl: 30_000 }),
          cachedJsonFetch("/api/tests/packages", { ttl: 30_000 }),
        ]);

        if (!patientRes.response.ok) {
          setStatus({ type: "danger", message: "Patient not found" });
          return;
        }
        setPatient(patientRes.data);
        if (testRes.response.ok) setTests(testRes.data.tests || []);
        if (pkgRes.response.ok) setPackages(pkgRes.data.packages || []);
      } catch {
        setStatus({ type: "danger", message: "Failed to load data" });
      } finally {
        setFetching(false);
        setLoading(false);
      }
    }
    fetchData();
  }, [id]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setStatus({ type: "", message: "" });

    if (!patient) {
      setStatus({ type: "danger", message: "Patient data not loaded" });
      setSaving(false);
      return;
    }
    if (selectedTests.length === 0) {
      setStatus({ type: "danger", message: "At least one test or package must be selected" });
      setSaving(false);
      return;
    }
    const newErrors = {};
    if (!receivedTime) newErrors.receivedTime = "Received time is required";
    else if (new Date(receivedTime) > new Date()) newErrors.receivedTime = "Received time cannot be in the future";
    if (collectionTime && new Date(collectionTime) > new Date()) newErrors.collectionTime = "Collection time cannot be in the future";
    if (collectionTime && receivedTime && new Date(receivedTime) < new Date(collectionTime)) {
      newErrors.receivedTime = "Received time cannot be earlier than collection time";
    }
    if (patient?.dob) {
      const dobDate = new Date(patient.dob);
      if (collectionTime && new Date(collectionTime) < dobDate) newErrors.collectionTime = "Collection time cannot be before date of birth";
      if (receivedTime && new Date(receivedTime) < dobDate) newErrors.receivedTime = "Received time cannot be before date of birth";
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setStatus({ type: "danger", message: "Please correct the highlighted errors." });
      setSaving(false);
      return;
    }

    if (/[eE]/.test(String(discountAmount))) {
      setStatus({ type: "danger", message: "Invalid discount amount format" });
      setSaving(false);
      return;
    }
    if (/[eE]/.test(String(taxAmount))) {
      setStatus({ type: "danger", message: "Invalid tax amount format" });
      setSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          patient: patient._id,
          tests: selectedTests,
          priority,
          receivedTime,
          collectionTime: collectionTime || undefined,
          notes,
          discountAmount: discountAmount || 0,
          taxAmount: taxAmount || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus({ type: "danger", message: data.error || "Failed to create bill" });
        setSaving(false);
        return;
      }

      clearCachedApi("/api/billing");
      clearCachedApi("/api/patient");
      clearCachedApi("/api/samples?status=all");

      setSuccessMsg(`Bill ${data.billingRecord.billId} created successfully for ${patient.name}`);
    } catch {
      setStatus({ type: "danger", message: "Network error. Please try again." });
      setSaving(false);
    } finally {
      setSaving(false);
    }
  }

  if (loading || fetching) {
    return <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>Loading patient data...</div>;
  }

  if (!patient) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <h3 style={{ color: "var(--text-primary)" }}>Patient not found</h3>
        <button className="btn-lims-secondary" onClick={() => router.push("/patients")}>Back to Patients</button>
      </div>
    );
  }

  const netPayable = Math.max(0, selectedTotal - Number(discountAmount || 0) + Number(taxAmount || 0));

  const s = {
    label: { display: "block", fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" },
    input: { width: "100%", height: "48px", padding: "0 14px", fontSize: "14px", borderWidth: "1.5px", borderStyle: "solid", borderColor: "var(--border)", borderRadius: "8px", background: "#fff", color: "var(--text-primary)", outline: "none", fontFamily: "var(--font-main)", boxSizing: "border-box" },
    row: { display: "flex", flexWrap: "wrap", margin: "0 -9px" },
    col6: { flex: "1 1 0%", minWidth: "250px", padding: "0 9px" },
    col12: { flex: "0 0 100%", padding: "0 9px" },
    field: { marginBottom: "18px" },
  };

  return (
    <>
      <div className="page-header">
        <div className="page-header-icon">{Icons.person}</div>
        <div className="page-header-text">
          <h4>New Visit</h4>
          <small>Register investigations for existing patient</small>
        </div>
        <button className="btn-view-patients" onClick={() => router.push(`/patients/${id}/visits`)}>
          {Icons.list} Visit History
        </button>
      </div>

      <SuccessDialog message={successMsg} onClose={() => { setSuccessMsg(""); router.push("/billing"); }} />

      {status.message && (
        <div className={`lims-alert ${status.type}`} role="alert" style={{ marginBottom: "20px" }}>
          <span>{status.message}</span>
          <button className="lims-alert-close" onClick={() => setStatus({ type: "", message: "" })}>{Icons.close}</button>
        </div>
      )}

      <div className="form-card">
        <div className="form-card-header"><h6>Patient Information</h6></div>
        <div className="form-card-body">
          <div className="row g-3">
            <div className="col-md-3">
              <label className="lims-label">Patient ID</label>
              <input className="lims-input" value={patient.patientId} disabled />
            </div>
            <div className="col-md-3">
              <label className="lims-label">Name</label>
              <input className="lims-input" value={patient.name} disabled />
            </div>
            <div className="col-md-2">
              <label className="lims-label">Age / Gender</label>
              <input className="lims-input" value={`${patient.age} Yrs, ${patient.gender}`} disabled />
            </div>
            <div className="col-md-2">
              <label className="lims-label">DOB</label>
              <input className="lims-input" value={formatDate(patient.dob)} disabled />
            </div>
            <div className="col-md-2">
              <label className="lims-label">Phone</label>
              <input className="lims-input" value={patient.phone} disabled />
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-card">
          <div className="form-card-header"><h6>Investigation Details</h6></div>
          <div className="form-card-body">
            <div style={s.row}>
              <div style={{ ...s.col6, ...s.field }}>
                <label style={s.label}>Priority</label>
                <select style={s.input} value={priority} onChange={(e) => setPriority(e.target.value)}>
                  <option value="routine">Routine</option>
                  <option value="urgent">Urgent (STAT)</option>
                </select>
              </div>
              <div style={{ ...s.col6, ...s.field }}>
                <label style={s.label}>Collection Time <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>(optional)</span></label>
                <input type="datetime-local" style={{ ...s.input, ...(errors.collectionTime ? { borderColor: "var(--danger)" } : {}) }} value={collectionTime} onChange={(e) => { setCollectionTime(e.target.value); setErrors(prev => ({ ...prev, collectionTime: "" })); }} />
                {errors.collectionTime && <div style={{ color: "var(--danger)", fontSize: "12px", marginTop: "4px" }}>{errors.collectionTime}</div>}
              </div>
            </div>
            <div style={s.row}>
              <div style={{ ...s.col12, ...s.field, padding: 0 }}>
                <label style={s.label}>Received Time <span className="required">*</span></label>
                <input type="datetime-local" style={{ ...s.input, ...(errors.receivedTime ? { borderColor: "var(--danger)" } : {}) }} value={receivedTime} onChange={(e) => { setReceivedTime(e.target.value); setErrors(prev => ({ ...prev, receivedTime: "" })); }} />
                {errors.receivedTime && <div style={{ color: "var(--danger)", fontSize: "12px", marginTop: "4px" }}>{errors.receivedTime}</div>}
              </div>
            </div>
            <div style={{ ...s.col12, ...s.field, padding: 0 }}>
              <label style={s.label}>Select Investigations <span className="required">*</span></label>
              <MultiSelect
                name="selectedTests"
                placeholder="Search tests or packages"
                options={investigationOptions}
                value={selectedTests}
                onChange={(e) => setSelectedTests(e.target.value)}
              />
            </div>
            <div style={s.row}>
              <div style={{ ...s.col6, ...s.field }}>
                <label style={s.label}>Discount (₹)</label>
                <input type="number" style={s.input} min="0" max="9999999999" value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} placeholder="0" />
              </div>
              <div style={{ ...s.col6, ...s.field }}>
                <label style={s.label}>Tax (₹)</label>
                <input type="number" style={s.input} min="0" max="9999999999" value={taxAmount} onChange={(e) => setTaxAmount(e.target.value)} placeholder="0" />
              </div>
            </div>
            <div style={{ ...s.col12, ...s.field, padding: 0 }}>
              <label style={s.label}>Notes</label>
              <textarea
                style={{ ...s.input, minHeight: "48px", padding: "12px 14px", resize: "vertical" }}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                maxLength={150}
                placeholder="Enter notes (optional)"
              />
            </div>
          </div>
        </div>

        <div style={{
          background: "var(--surface)", padding: "20px 24px", borderRadius: "12px",
          border: "1px solid var(--border-light)", marginBottom: "24px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <span style={{ fontSize: "13px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Net Payable</span>
            <strong style={{ fontSize: "24px", color: "var(--brand-action, var(--primary))" }}>₹{netPayable}</strong>
          </div>
          <div style={{ color: "var(--text-secondary)", fontSize: "14px", fontWeight: "600" }}>
            {selectedTests.length} Investigations Selected
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn-lims-secondary" onClick={() => router.push(`/patients/${id}/visits`)}>
            Cancel
          </button>
          <button type="submit" className="btn-lims-primary" disabled={saving || selectedTests.length === 0}>
            {saving ? "Creating Bill..." : "Create Bill"}
          </button>
        </div>
      </form>
    </>
  );
}
