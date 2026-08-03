"use client";
import dynamic from "next/dynamic";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Icons } from "@/app/components/Icons";
import SuccessDialog from "@/app/components/SuccessDialog";
import DatePicker from "@/app/components/DatePicker";
import { getEmptyForm, calculateAge } from "@/app/utils/patient-helpers";
import { cachedJsonFetch, clearCachedApi } from "@/app/lib/use-current-user";

const SearchableSelect = dynamic(() => import("@/app/components/SearchableSelect"), {
  ssr: false,
  loading: () => <div className="lims-input">Loading options...</div>,
});

const MultiSelect = dynamic(() => import("@/app/components/MultiSelect"), {
  ssr: false,
  loading: () => <div className="lims-input">Loading options...</div>,
});

export default function PatientRegistration() {
  const router = useRouter();
  const minDob = new Date();
  minDob.setFullYear(minDob.getFullYear() - 150);

  const [duplicateWarning, setDuplicateWarning] = useState(false);
  const [pendingPayload, setPendingPayload] = useState(null);
  const [duplicatePatient, setDuplicatePatient] = useState(null);
  const [errors, setErrors] = useState({});
  const [showErrors, setShowErrors] = useState(false);
  const [form, setForm] = useState(getEmptyForm);
  const [dobDraft, setDobDraft] = useState("");
  const [mounted, setMounted] = useState(false);
  const [hasRefDoctor, setHasRefDoctor] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [availableTests, setAvailableTests] = useState([]);
  const [availablePackages, setAvailablePackages] = useState([]);

  const selectedTotal = useMemo(() => {
    let total = 0;
    (form.selectedTests || []).forEach(itemKey => {
      if (itemKey.startsWith("test_")) {
        const t = availableTests.find(t => t._id === itemKey.replace("test_", ""));
        total += Number(t?.price || 0);
      } else if (itemKey.startsWith("pkg_")) {
        const p = availablePackages.find(p => p._id === itemKey.replace("pkg_", ""));
        total += Number(p?.price || 0);
      }
    });
    return total;
  }, [availableTests, availablePackages, form.selectedTests]);

  useEffect(() => {
    setMounted(true);

    async function fetchData() {
      try {
        const [docRes, testRes, pkgRes] = await Promise.all([
          cachedJsonFetch("/api/doctor?status=Active", { ttl: 15_000 }),
          cachedJsonFetch("/api/tests/definitions", { ttl: 30_000 }),
          cachedJsonFetch("/api/tests/packages", { ttl: 30_000 })
        ]);

        if (docRes.response.ok) {
          setDoctors(Array.isArray(docRes.data) ? docRes.data : docRes.data.doctors || []);
        } else if (docRes.response.status === 403) {
          console.warn("Doctor access denied — referring doctor dropdown disabled");
        }
        if (testRes.response.ok) setAvailableTests(testRes.data.tests || []);
        if (pkgRes.response.ok) setAvailablePackages(pkgRes.data.packages || []);
      } catch (err) {
        console.error("Failed to fetch registration data:", err);
      }
    }
    fetchData();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "dob") {
      const calculatedAge = calculateAge(value);
      setForm((prev) => ({ ...prev, dob: value, age: calculatedAge }));
    } else if (name === "name") {
      const sanitized = value.replace(/[^A-Za-z ]/g, "").slice(0, 30);
      const capitalized = sanitized.charAt(0).toUpperCase() + sanitized.slice(1);
      setForm((prev) => ({ ...prev, name: capitalized }));
    } else if (name === "uhId") {
      const sanitized = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 14);
      setForm((prev) => ({ ...prev, uhId: sanitized }));
    } else if (name === "address") {
      const sanitized = value.replace(/[^A-Za-z0-9 .,/-]/g, "").slice(0, 100);
      setForm((prev) => ({ ...prev, address: sanitized }));
    } else if (name === "phone") {
      const sanitized = value.replace(/\D/g, "").slice(0, 10);
      setForm((prev) => ({ ...prev, phone: sanitized }));
    } else {
      setForm((prev) => ({
        ...prev,
        [name]: value,
        ...(name === "gender" && value !== "Other" ? { genderIdentity: "" } : {}),
      }));
    }
    if (showErrors) {
      setErrors(prev => {
        const newErrs = { ...prev };
        delete newErrs[name];
        if (name === "dob") delete newErrs.age;
        return newErrs;
      });
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!form.name?.trim()) newErrors.name = "Patient name is required";
    else if (form.name.trim().length < 2) newErrors.name = "Name must be at least 2 characters";
    else if (form.name.trim().length > 30) newErrors.name = "Name must be at most 30 characters";
    else if (!/^[A-Za-z ]+$/.test(form.name.trim())) newErrors.name = "Only letters and spaces allowed";
    if (!form.gender) newErrors.gender = "Gender is required";
    if (form.gender === "Other" && !form.genderIdentity) newErrors.genderIdentity = "Gender identity is required";
    if (!dobDraft?.trim()) newErrors.dob = "Date of Birth is required";
    else if (!form.dob) newErrors.dob = "Invalid date of birth (DD/MM/YYYY)";
    else {
      const dobDate = new Date(form.dob);
      if (isNaN(dobDate.getTime()) || dobDate < minDob) newErrors.dob = "Age must be between 0 and 150 years";
      else if (dobDate > new Date()) newErrors.dob = "Date of Birth cannot be in the future";
    }
    if (form.dob && !form.age && form.age !== 0) newErrors.age = "Age is required";
    else if (form.dob && (parseInt(form.age) < 0 || parseInt(form.age) > 150)) newErrors.age = "Age must be between 0 and 150";
    if (!form.phone?.trim()) newErrors.phone = "Mobile number is required";
    else if (!/^\d{10}$/.test(form.phone)) newErrors.phone = "Mobile number must be 10 digits";
    if (!form.address?.trim()) newErrors.address = "Address is required";
    else if (!/^[A-Za-z0-9 .,/-]+$/.test(form.address)) newErrors.address = "Only letters, numbers, spaces, and . , / - allowed";
    else if (/https?:\/\/|www\./i.test(form.address)) newErrors.address = "URLs not allowed in address";
    if (hasRefDoctor && !form.refDoctorName?.trim()) newErrors.refDoctorName = "Referring doctor name is required";
    if (form.uhId && !/^[A-Za-z0-9]{14}$/.test(String(form.uhId))) newErrors.uhId = "UH ID must be exactly 14 alphanumeric characters";
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setShowErrors(true);
    const formErrors = validateForm();
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      setStatus({ type: "danger", message: "Please correct the highlighted errors." });
      const firstErrorField = Object.keys(formErrors)[0];
      const element = document.getElementsByName(firstErrorField)[0];
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.focus();
      }
      return;
    }

    setLoading(true);
    setErrors({});
    setStatus({ type: "", message: "" });
    const payload = { ...form };
    if (!payload.genderIdentity) delete payload.genderIdentity;
    if (!hasRefDoctor) delete payload.refDoctorName;
    if (!payload.reportType) delete payload.reportType;
    if (!payload.uhId) delete payload.uhId;

    try {
      const dupRes = await fetch(`/api/patient?search=${encodeURIComponent(payload.phone)}`, { credentials: "include" });
      const dupData = await dupRes.json();
      const duplicateMatches = Array.isArray(dupData) ? dupData : dupData.patients || [];
      const matchingPatient = duplicateMatches.find(p => p.phone === payload.phone);
      if (matchingPatient) {
        setPendingPayload(payload);
        setDuplicatePatient(matchingPatient);
        setDuplicateWarning(true);
        setLoading(false);
        return;
      }
      } catch (err) {
        console.error("Duplicate phone check failed:", err);
      }

    try {
      const res = await fetch("/api/patient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        let billId = null;
        if ((payload.selectedTests || []).length > 0) {
          try {
            const billingRes = await fetch("/api/billing", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                patient: data._id,
                tests: payload.selectedTests,
                priority: "routine",
                notes: "",
                discountAmount: 0,
                taxAmount: 0,
              }),
            });
            const billingData = await billingRes.json();
            if (billingRes.ok) {
              billId = billingData.billingRecord?.billId;
            } else {
              console.warn("Auto-bill creation failed:", billingData.error);
            }
          } catch (billErr) {
            console.warn("Auto-bill creation error:", billErr);
          }
        }

        clearCachedApi("/api/patient");
        clearCachedApi("/api/billing");
        clearCachedApi("/api/samples?status=all");
        clearCachedApi("/api/dashboard/stats");

        const billCreated = billId !== null;
        const billMsg = billCreated
          ? `Bill ${billId} has been generated.`
          : "Add tests later from the patient's records (New Visit) or the Billing Center.";

        setStatus({
          type: "success",
          message: `Patient registered successfully. Patient ID: ${data.patientId}. ${billMsg}`,
        });
        setForm(getEmptyForm());
        setDobDraft("");
        setHasRefDoctor(false);
        setShowErrors(false);
        setTimeout(() => router.push(billCreated ? "/billing" : "/patients"), 5000);
      } else {
        setStatus({ type: "danger", message: data.error || "Something went wrong." });
      }
    } catch {
      setStatus({ type: "danger", message: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <>
      <div className="page-header">
        <div className="page-header-icon">{Icons.person}</div>
        <div className="page-header-text">
          <h4>Patient Registration</h4>
          <small>Create new patient records</small>
        </div>
        <button className="btn-view-patients" onClick={() => router.push("/patients")}>
          {Icons.list} View Patients
        </button>
      </div>

      <SuccessDialog
        message={status.type === "success" ? status.message : ""}
        onClose={() => setStatus({ type: "", message: "" })}
      />

      {status.message && status.type !== "success" && (
        <div className={`lims-alert ${status.type}`} role="alert" style={{ marginBottom: '20px' }}>
          <span>{status.message}</span>
          <button className="lims-alert-close" onClick={() => setStatus({ type: "", message: "" })}>{Icons.close}</button>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-card">
          <div className="form-card-header"><h6><span className="step-badge">1</span>Basic Information</h6></div>
          <div className="form-card-body">
            <div className="row g-3">
              <div className="col-md-4"><label className="lims-label">Patient ID</label><input className="lims-input" value="Auto-generated" disabled /></div>
              <div className="col-md-4">
                <label className="lims-label">Full Name <span className="required">*</span></label>
                <input name="name" className={`lims-input ${errors.name ? 'invalid' : ''}`} placeholder="Enter full name" value={form.name} minLength={2} maxLength={30} onChange={handleChange} />
                {errors.name && <div className="lims-error-text">{errors.name}</div>}
              </div>
              <div className="col-md-3">
                <label className="lims-label">Date of Birth <span className="required">*</span></label>
                <DatePicker value={form.dob} onChange={handleChange} max={new Date().toISOString().split("T")[0]} error={errors.dob} onDraftChange={setDobDraft} />
                {errors.dob && <div className="lims-error-text">{errors.dob}</div>}
              </div>
              <div className="col-md-1">
                <label className="lims-label">Age <span className="required">*</span></label>
                <input type="text" name="age" className="lims-input" value={form.age !== "" ? `${form.age} Yrs` : ""} readOnly disabled style={{ backgroundColor: 'var(--surface)', textAlign: 'center', fontWeight: '600' }} />
              </div>
              <div className="col-md-4">
                <label className="lims-label">Report Type</label>
                <select name="reportType" className="lims-select" value={form.reportType} onChange={handleChange}>
                  <option value="Hand">Hand</option>
                  <option value="Digital">Digital</option>
                </select>
              </div>
              <div className="col-md-4">
                <label className="lims-label">Gender <span className="required">*</span></label>
                <select name="gender" className={`lims-select ${errors.gender ? 'invalid' : ''}`} value={form.gender} onChange={handleChange}>
                  <option value="">Select gender</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option>
                </select>
                {errors.gender && <div className="lims-error-text">{errors.gender}</div>}
              </div>
              {form.gender === "Other" && (
                <div className="col-md-4">
                  <label className="lims-label">Gender Identity <span className="required">*</span></label>
                  <select name="genderIdentity" className={`lims-select ${errors.genderIdentity ? 'invalid' : ''}`} value={form.genderIdentity} onChange={handleChange}>
                    <option value="">Select identity</option><option value="Transwomen">Transwomen</option><option value="Transman">Transman</option>
                  </select>
                  {errors.genderIdentity && <div className="lims-error-text">{errors.genderIdentity}</div>}
                </div>
              )}
              <div className="col-md-4">
                <label className="lims-label">UH ID <span className="optional">(optional)</span></label>
                <input type="text" name="uhId" className={`lims-input ${errors.uhId ? 'invalid' : ''}`} placeholder="Enter UH ID" value={form.uhId} maxLength={14} onChange={handleChange} />
                {errors.uhId && <div className="lims-error-text">{errors.uhId}</div>}
              </div>
            </div>
          </div>
        </div>

        <div className="form-card">
          <div className="form-card-header"><h6><span className="step-badge">2</span>Contact Details</h6></div>
          <div className="form-card-body">
            <div className="row g-3">
              <div className="col-md-4">
                <label className="lims-label">Mobile Number <span className="required">*</span></label>
                <input name="phone" type="text" inputMode="numeric" className={`lims-input ${errors.phone ? 'invalid' : ''}`} placeholder="Enter mobile number" minLength={10} maxLength={10} value={form.phone} onChange={handleChange} />
                {errors.phone && <div className="lims-error-text">{errors.phone}</div>}
              </div>
              <div className="col-md-8">
                <label className="lims-label">Address <span className="required">*</span></label>
                <input name="address" className={`lims-input ${errors.address ? 'invalid' : ''}`} placeholder="Enter address" maxLength={100} value={form.address} onChange={handleChange} />
                {errors.address && <div className="lims-error-text">{errors.address}</div>}
              </div>
            </div>
          </div>
        </div>

        <div className="form-card">
          <div className="form-card-header"><h6><span className="step-badge">3</span>Doctor Referral</h6></div>
          <div className="form-card-body">
            <div className="row g-3">
              <div className="col-12"><label className="lims-label">Doctor Referral</label><div className="radio-group"><label className="radio-item"><input type="radio" name="refDoctorToggle" checked={!hasRefDoctor} onChange={() => { setHasRefDoctor(false); setForm(p => ({ ...p, refDoctorName: "" })); }} /> No</label><label className="radio-item"><input type="radio" name="refDoctorToggle" checked={hasRefDoctor} onChange={() => setHasRefDoctor(true)} /> Yes</label></div></div>
              {hasRefDoctor && (
                <div className="col-md-6">
                  <label className="lims-label">Referring Doctor <span className="required">*</span></label>
                  <SearchableSelect
                    name="refDoctorName"
                    options={doctors.map(doc => ({ value: doc.name, label: doc.name, sublabel: doc.doctorId }))}
                    value={form.refDoctorName}
                    onChange={handleChange}
                    placeholder="Search doctor"
                    error={!!errors.refDoctorName}
                  />
                  {errors.refDoctorName && <div className="lims-error-text">{errors.refDoctorName}</div>}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="form-card">
          <div className="form-card-header"><h6><span className="step-badge">4</span>Test Selection</h6></div>
          <div className="form-card-body">
            <div className="row g-3">
              <div className="col-12">
                <label className="lims-label">Select Tests / Packages <span className="optional">(optional)</span></label>
                <MultiSelect 
                  name="selectedTests"
                  options={[
                    ...availablePackages.map(pkg => ({ 
                      value: `pkg_${pkg._id}`, 
                      label: pkg.name, 
                      sublabel: `Package (${pkg.tests?.length || 0} tests) · ₹${pkg.price}` 
                    })),
                    ...availableTests.map(test => ({ 
                      value: `test_${test._id}`, 
                      label: test.name, 
                      sublabel: `${test.category?.name || "Test"} · ₹${test.price}` 
                    }))
                  ]}
                  value={form.selectedTests || []}
                  onChange={handleChange}
                  placeholder="Search tests or packages"
                  error={!!errors.selectedTests}
                />
                {errors.selectedTests && <div className="lims-error-text">{errors.selectedTests}</div>}
              </div>
            </div>
          </div>
        </div>

        <div style={{ 
          background: "var(--surface)", 
          padding: "20px 24px", 
          borderRadius: "12px", 
          border: "1px solid var(--border-light)",
          marginBottom: "24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <div>
            <span style={{ fontSize: "13px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Total Bill Amount</span>
            <strong style={{ fontSize: "24px", color: "var(--brand-action, var(--primary))" }}>₹{selectedTotal}</strong>
          </div>
          <div style={{ color: "var(--text-secondary)", fontSize: "14px", fontWeight: "600" }}>
            {form.selectedTests?.length || 0} Investigations Selected
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn-lims-secondary" onClick={() => { setForm(getEmptyForm()); setDobDraft(""); setStatus({ type: "", message: "" }); }}>Reset</button>
          <button type="submit" className="btn-lims-primary" disabled={loading}>{loading ? "Saving..." : "Save Patient"}</button>
        </div>
      </form>

      {duplicateWarning && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header"><div className="modal-icon-warning">!</div><h4>Duplicate Contact Number</h4></div>
            <p>The number <strong>{pendingPayload?.phone}</strong> is registered to: <br /><strong style={{ fontSize: '18px', color: 'var(--brand-action, var(--primary))', display: 'block', margin: '8px 0' }}>{duplicatePatient?.name} ({duplicatePatient?.patientId})</strong>Proceed anyway?</p>
            <div className="modal-actions">
              <button className="btn-modal-cancel" onClick={() => setDuplicateWarning(false)}>Cancel</button>
              <button className="btn-modal-confirm" onClick={async () => {
                setDuplicateWarning(false); setLoading(true);
                try {
                  const res = await fetch("/api/patient", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ ...pendingPayload, force: true }) });
                  const data = await res.json();
                  if (res.ok) {
                    let billId = null;
                    if ((pendingPayload.selectedTests || []).length > 0) {
                      try {
                        const billingRes = await fetch("/api/billing", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          credentials: "include",
                          body: JSON.stringify({
                            patient: data._id,
                            tests: pendingPayload.selectedTests,
                            priority: "routine",
                            notes: "",
                            discountAmount: 0,
                            taxAmount: 0,
                          }),
                        });
                        const billingData = await billingRes.json();
                        if (billingRes.ok) {
                          billId = billingData.billingRecord?.billId;
                        } else {
                          console.warn("Auto-bill creation failed:", billingData.error);
                        }
                      } catch (billErr) {
                        console.warn("Auto-bill creation error:", billErr);
                      }
                    }
                    clearCachedApi("/api/patient"); clearCachedApi("/api/billing"); clearCachedApi("/api/samples?status=all"); clearCachedApi("/api/dashboard/stats");
                    const billMsg = billId ? ` Bill ${billId} has been generated.` : "";
                    setStatus({ type: "success", message: `Patient registered successfully. Patient ID: ${data.patientId}.${billMsg}` }); setForm(getEmptyForm()); setDobDraft(""); setHasRefDoctor(false);
                  }
                  else setStatus({ type: "danger", message: data.error || "Failed" });
                } catch { setStatus({ type: "danger", message: "Network error" }); }
                finally { setLoading(false); }
              }}>OK, Proceed</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
