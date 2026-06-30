"use client";
import dynamic from "next/dynamic";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Icons } from "@/app/components/Icons";
import SuccessDialog from "@/app/components/SuccessDialog";
import { getISTNow, getEmptyForm, calculateAge } from "@/app/utils/patient-helpers";
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
  const [duplicateWarning, setDuplicateWarning] = useState(false);
  const [pendingPayload, setPendingPayload] = useState(null);
  const [duplicatePatient, setDuplicatePatient] = useState(null);
  const [errors, setErrors] = useState({});
  const [showErrors, setShowErrors] = useState(false);
  const [form, setForm] = useState(getEmptyForm);
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
    setForm(prev => ({ ...prev, receivedTime: getISTNow() }));

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
    else if (form.name.length > 20) newErrors.name = "Name must not exceed 20 characters";
    else if (!/^[A-Za-z .]+$/.test(form.name)) newErrors.name = "Only letters, spaces, and periods allowed";
    if (!form.gender) newErrors.gender = "Gender is required";
    if (form.gender === "Other" && !form.genderIdentity) newErrors.genderIdentity = "Gender identity is required";
    if (!form.dob) newErrors.dob = "Date of Birth is required";
    else {
      const dobDate = new Date(form.dob);
      if (isNaN(dobDate.getTime()) || dobDate.getFullYear() < 1900) newErrors.dob = "Invalid date of birth";
      else if (dobDate > new Date()) newErrors.dob = "Date of Birth cannot be in the future";
    }
    if (!form.age && form.age !== 0) newErrors.age = "Age is required";
    else if (parseInt(form.age) < 0) newErrors.age = "Invalid age";
    if (!form.phone?.trim()) newErrors.phone = "Mobile number is required";
    else if (!/^\d{10}$/.test(form.phone)) newErrors.phone = "Mobile number must be 10 digits";
    if (!form.address?.trim()) newErrors.address = "Address is required";
    else if (!/^[A-Za-z0-9 .,/#-]+$/.test(form.address)) newErrors.address = "Only letters, numbers, spaces, and . , / # - allowed";
    else if (/https?:\/\/|www\./i.test(form.address)) newErrors.address = "URLs not allowed in address";
    if (!form.receivedTime) newErrors.receivedTime = "Received time is required";
    else if (isNaN(new Date(form.receivedTime).getTime())) newErrors.receivedTime = "Invalid received time";
    if (form.collectionTime && isNaN(new Date(form.collectionTime).getTime())) newErrors.collectionTime = "Invalid collection time";
    if (form.collectionTime && form.receivedTime) {
      if (new Date(form.receivedTime) < new Date(form.collectionTime)) {
        newErrors.receivedTime = "Received time cannot be earlier than collection time";
        newErrors.collectionTime = "Collection time must be before received time";
      }
    }
    if (form.dob && form.collectionTime && new Date(form.collectionTime) < new Date(form.dob)) {
      newErrors.collectionTime = "Collection time cannot be before date of birth";
    }
    if (form.dob && form.receivedTime && new Date(form.receivedTime) < new Date(form.dob)) {
      newErrors.receivedTime = "Received time cannot be before date of birth";
    }
    if (!form.barcode?.trim()) newErrors.barcode = "Barcode is required";
    else if (!/^[A-Za-z0-9-_]+$/.test(form.barcode)) newErrors.barcode = "Only letters, numbers, hyphens, and underscores allowed";
    else if (/https?:\/\/|www\./i.test(form.barcode)) newErrors.barcode = "URLs not allowed in barcode";
    if (hasRefDoctor && !form.refDoctorName?.trim()) newErrors.refDoctorName = "Referring doctor name is required";
    if (!form.uhId?.trim()) newErrors.uhId = "UH ID is required";
    else if (!/^[A-Za-z0-9]{14}$/.test(String(form.uhId))) newErrors.uhId = "UH ID must be exactly 14 alphanumeric characters";
    if (!form.selectedTests || form.selectedTests.length === 0) newErrors.selectedTests = "At least one test or package must be selected";
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
    if (!payload.collectionTime) delete payload.collectionTime;
    if (!payload.genderIdentity) delete payload.genderIdentity;
    if (!hasRefDoctor) delete payload.refDoctorName;
    if (!payload.reportType) delete payload.reportType;

    if (payload.barcode) {
      try {
        const barRes = await fetch(`/api/patient?search=${encodeURIComponent(payload.barcode)}`, { credentials: "include" });
        const barData = await barRes.json();
        const barcodeMatches = Array.isArray(barData) ? barData : barData.patients || [];
        if (barcodeMatches.some(p => p.barcode === payload.barcode)) {
          setErrors(prev => ({ ...prev, barcode: "This barcode is already assigned to another patient" }));
          setStatus({ type: "danger", message: "Duplicate barcode detected." });
          setLoading(false);
          return;
        }
      } catch (err) {}
    }

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
    } catch (err) {}

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

        clearCachedApi("/api/patient");
        clearCachedApi("/api/billing");
        clearCachedApi("/api/samples?status=all");
        clearCachedApi("/api/dashboard/stats");

        const billMsg = billId
          ? `Bill ${billId} has been generated.`
          : "Note: Bill could not be auto-generated. Please create it manually in Billing Center.";

        setStatus({
          type: "success",
          message: `Patient registered successfully. Patient ID: ${data.patientId}. ${billMsg}`,
        });
        setForm(getEmptyForm());
        setHasRefDoctor(false);
        setShowErrors(false);
        setTimeout(() => router.push("/billing"), 5000);
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
                <input name="name" className={`lims-input ${errors.name ? 'invalid' : ''}`} placeholder="Enter full name" value={form.name} maxLength={20} onChange={handleChange} />
                {errors.name && <div className="lims-error-text">{errors.name}</div>}
              </div>
              <div className="col-md-3">
                <label className="lims-label">Date of Birth <span className="required">*</span></label>
                <input type="date" name="dob" className={`lims-input ${errors.dob ? 'invalid' : ''}`} value={form.dob} max={new Date().toISOString().split("T")[0]} onChange={handleChange} />
                {errors.dob && <div className="lims-error-text">{errors.dob}</div>}
              </div>
              <div className="col-md-1">
                <label className="lims-label">Age <span className="required">*</span></label>
                <input type="text" name="age" className="lims-input" value={form.age ? `${form.age} Yrs` : ""} readOnly disabled style={{ backgroundColor: 'var(--surface)', textAlign: 'center', fontWeight: '600' }} />
              </div>
              <div className="col-md-4">
                <label className="lims-label">Report Type</label>
                <select name="reportType" className="lims-select" value={form.reportType} onChange={handleChange}>
                  <option value="Hand">Hand</option>
                  <option value="Digital">Digital</option>
                </select>
              </div>
              <div className="col-md-4">
                <label className="lims-label">Barcode <span className="required">*</span></label>
                <input name="barcode" className={`lims-input ${errors.barcode ? 'invalid' : ''}`} placeholder="Enter barcode" value={form.barcode} onChange={handleChange} />
                {errors.barcode && <div className="lims-error-text">{errors.barcode}</div>}
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
                <label className="lims-label">UH ID <span className="required">*</span></label>
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
                <input name="phone" className={`lims-input ${errors.phone ? 'invalid' : ''}`} placeholder="Enter mobile number" maxLength={10} value={form.phone} onChange={handleChange} />
                {errors.phone && <div className="lims-error-text">{errors.phone}</div>}
              </div>
              <div className="col-md-8">
                <label className="lims-label">Address <span className="required">*</span></label>
                <input name="address" className={`lims-input ${errors.address ? 'invalid' : ''}`} placeholder="Enter address" maxLength={200} value={form.address} onChange={handleChange} />
                {errors.address && <div className="lims-error-text">{errors.address}</div>}
              </div>
            </div>
          </div>
        </div>

        <div className="form-card">
          <div className="form-card-header"><h6><span className="step-badge">3</span>Sample Timing</h6></div>
          <div className="form-card-body">
            <div className="row g-3">
              <div className="col-md-6"><label className="lims-label">Collection Time <span className="optional">(optional)</span></label><input type="datetime-local" name="collectionTime" className="lims-input" value={form.collectionTime} onChange={handleChange} /></div>
              <div className="col-md-6"><label className="lims-label">Received Time <span className="required">*</span></label><input type="datetime-local" name="receivedTime" className={`lims-input ${errors.receivedTime ? 'invalid' : ''}`} value={form.receivedTime} min={form.collectionTime || undefined} onChange={handleChange} />{errors.receivedTime && <div className="lims-error-text">{errors.receivedTime}</div>}</div>
            </div>
            <div className="row g-3 mt-1">
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
                <label className="lims-label">Select Tests / Packages <span className="required">*</span></label>
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
          <button type="button" className="btn-lims-secondary" onClick={() => { setForm(getEmptyForm()); setStatus({ type: "", message: "" }); }}>Reset</button>
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
                    clearCachedApi("/api/patient"); clearCachedApi("/api/billing"); clearCachedApi("/api/samples?status=all"); clearCachedApi("/api/dashboard/stats");
                    const billMsg = billId ? ` Bill ${billId} has been generated.` : "";
                    setStatus({ type: "success", message: `Patient registered successfully. Patient ID: ${data.patientId}.${billMsg}` }); setForm(getEmptyForm()); setHasRefDoctor(false);
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
