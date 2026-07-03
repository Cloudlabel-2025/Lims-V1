"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icons } from "@/app/components/Icons";
import SuccessDialog from "@/app/components/SuccessDialog";
import { cachedJsonFetch, clearCachedApi } from "@/app/lib/use-current-user";

export default function SampleRegistration() {
  const router = useRouter();
  const [patients, setPatients] = useState([]);
  const [tests, setTests] = useState([]);
  const [form, setForm] = useState({ patient: "", testDefinition: "", sampleType: "", batchId: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    async function fetchData() {
      try {
        const [patRes, testRes] = await Promise.all([
          cachedJsonFetch("/api/patient", { ttl: 15_000 }),
          cachedJsonFetch("/api/tests/definitions", { ttl: 30_000 }),
        ]);
        if (patRes.response.ok) setPatients(patRes.data.patients || []);
        if (testRes.response.ok) setTests(testRes.data.tests || []);
      } catch (err) {
        console.error("Failed to fetch registration data:", err);
      }
    }
    fetchData();
  }, []);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!form.patient) { setError("Please select a patient"); return; }
    if (!form.testDefinition) { setError("Please select a test"); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/samples", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to register sample");

      clearCachedApi("/api/samples?status=all");
      clearCachedApi("/api/dashboard/stats");

      setSuccess(`Sample ${data.sample.sampleId} registered successfully.`);
      setForm({ patient: "", testDefinition: "", sampleType: "", batchId: "" });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-icon">{Icons.vial}</div>
        <div className="page-header-text">
          <h4>Register Sample</h4>
          <small>Create a new sample record independent of billing</small>
        </div>
        <button className="btn-view-patients" onClick={() => router.push("/samples")}>
          {Icons.list} View Samples
        </button>
      </div>

      <SuccessDialog message={success} onClose={() => setSuccess("")} />

      {error && (
        <div className="lims-alert danger" role="alert" style={{ marginBottom: 20 }}>
          <span>{error}</span>
          <button className="lims-alert-close" onClick={() => setError("")}>{Icons.close}</button>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-card">
          <div className="form-card-header"><h6>Sample Details</h6></div>
          <div className="form-card-body">
            <div className="row g-3">
              <div className="col-md-6">
                <label className="lims-label">Patient <span className="required">*</span></label>
                <select name="patient" className="lims-select" value={form.patient} onChange={handleChange} required>
                  <option value="">Select patient</option>
                  {patients.map((p) => (
                    <option key={p._id} value={p._id}>{p.name} · {p.patientId}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-6">
                <label className="lims-label">Test <span className="required">*</span></label>
                <select name="testDefinition" className="lims-select" value={form.testDefinition} onChange={handleChange} required>
                  <option value="">Select test</option>
                  {tests.map((t) => (
                    <option key={t._id} value={t._id}>{t.name} · {t.category?.name || "General"}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-4">
                <label className="lims-label">Sample Type</label>
                <input name="sampleType" className="lims-input" value={form.sampleType} onChange={handleChange} placeholder="e.g. Blood, Urine" minLength={2} maxLength={35} />
              </div>
              <div className="col-md-4">
                <label className="lims-label">Batch / Order ID</label>
                <input name="batchId" className="lims-input" value={form.batchId} onChange={handleChange} placeholder="Optional batch identifier" maxLength={35} />
              </div>
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn-lims-secondary" onClick={() => setForm({ patient: "", testDefinition: "", sampleType: "", batchId: "" })}>Reset</button>
          <button type="submit" className="btn-lims-primary" disabled={loading}>{loading ? "Registering..." : "Register Sample"}</button>
        </div>
      </form>
    </>
  );
}
