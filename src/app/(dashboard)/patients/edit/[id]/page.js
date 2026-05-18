"use client";
import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Icons } from "@/app/components/Icons";
import SearchableSelect from "@/app/components/SearchableSelect";
import { calculateAge } from "@/app/utils/patient-helpers";
import { cachedJsonFetch, clearCachedApi } from "@/app/lib/use-current-user";

export default function EditPatient({ params }) {
  const resolvedParams = use(params);
  const { id } = resolvedParams;
  const router = useRouter();
  
  const [errors, setErrors] = useState({});
  const [showErrors, setShowErrors] = useState(false);
  const [form, setForm] = useState(null);
  const [hasRefDoctor, setHasRefDoctor] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [doctors, setDoctors] = useState([]);

  useEffect(() => {
    async function fetchPatient() {
      try {
        const { response: res, data } = await cachedJsonFetch(`/api/patient/${id}`, { ttl: 10_000 });
        if (res.ok) {
          // Format dates for input[type="date"] and datetime-local
          const formattedData = {
            ...data,
            dob: data.dob ? new Date(data.dob).toISOString().split("T")[0] : "",
            receivedTime: data.receivedTime ? new Date(data.receivedTime).toISOString().slice(0, 16) : "",
            collectionTime: data.collectionTime ? new Date(data.collectionTime).toISOString().slice(0, 16) : "",
          };
          setForm(formattedData);
          if (data.refDoctorName) setHasRefDoctor(true);
        } else {
          setStatus({ type: "danger", message: data.error || "Failed to load patient data." });
        }
      } catch (err) {
        setStatus({ type: "danger", message: "Network error loading patient." });
      } finally {
        setFetching(false);
      }
    }
    fetchPatient();

    async function fetchDoctors() {
      try {
        const { response: res, data } = await cachedJsonFetch("/api/doctor", { ttl: 15_000 });
        if (res.ok) setDoctors(data);
      } catch (err) {
        console.error("Failed to fetch doctors:", err);
      }
    }
    fetchDoctors();
  }, [id]);

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
  };

  const validateForm = () => {
    const newErrors = {};
    if (!form.name?.trim()) newErrors.name = "Patient name is required";
    else if (form.name.trim().length < 2) newErrors.name = "Name must be at least 2 characters";
    if (!form.gender) newErrors.gender = "Gender is required";
    if (!form.dob) newErrors.dob = "Date of Birth is required";
    if (!form.phone?.trim()) newErrors.phone = "Mobile number is required";
    else if (!/^\d{10}$/.test(form.phone)) newErrors.phone = "Mobile number must be 10 digits";
    if (!form.address?.trim()) newErrors.address = "Address is required";
    if (!form.receivedTime) newErrors.receivedTime = "Received time is required";
    
    // Cross-validation for Received vs Collection
    if (form.collectionTime && form.receivedTime && new Date(form.receivedTime) < new Date(form.collectionTime)) {
      newErrors.receivedTime = "Received time cannot be earlier than collection time";
    }

    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setShowErrors(true);
    const formErrors = validateForm();
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      setStatus({ type: "danger", message: "Please correct the highlighted errors." });
      return;
    }

    setLoading(true);
    setStatus({ type: "", message: "" });
    
    try {
      const res = await fetch(`/api/patient/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        clearCachedApi("/api/patient");
        clearCachedApi(`/api/patient/${id}`);
        clearCachedApi("/api/billing");
        clearCachedApi("/api/samples?status=all");
        clearCachedApi("/api/reports");
        setStatus({ type: "success", message: "Patient updated successfully!" });
        setTimeout(() => router.push("/patients"), 1500);
      } else {
        setStatus({ type: "danger", message: data.error || "Update failed." });
      }
    } catch {
      setStatus({ type: "danger", message: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return <div className="p-5">Loading patient data...</div>;
  if (!form) return <div className="p-5 text-danger">{status.message || "Patient not found."}</div>;

  return (
    <>
      <div className="page-header">
        <div className="page-header-icon">{Icons.edit}</div>
        <div className="page-header-text">
          <h4>Edit Patient Profile</h4>
          <small>Updating record: {form.patientId}</small>
        </div>
        <button className="btn-view-patients" onClick={() => router.push("/patients")}>
          {Icons.arrowLeft} Back to List
        </button>
      </div>

      {status.message && (
        <div className={`lims-alert ${status.type}`} role="alert" style={{ marginBottom: '20px' }}>
          <span>{status.message}</span>
          <button className="lims-alert-close" onClick={() => setStatus({ type: "", message: "" })}>{Icons.close}</button>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {/* Step 1: Basic Information */}
        <div className="form-card">
          <div className="form-card-header"><h6><span className="step-badge">1</span>Basic Information</h6></div>
          <div className="form-card-body">
            <div className="row g-3">
              <div className="col-md-4">
                <label className="lims-label">Patient ID</label>
                <input className="lims-input disabled-like" value={form.patientId} disabled style={{ backgroundColor: '#f8fafc', color: '#64748b' }} />
              </div>
              <div className="col-md-4">
                <label className="lims-label">Full Name <span className="required">*</span></label>
                <input name="name" className={`lims-input ${errors.name ? 'invalid' : ''}`} value={form.name} onChange={handleChange} />
                {errors.name && <div className="lims-error-text">{errors.name}</div>}
              </div>
              <div className="col-md-3">
                <label className="lims-label">Date of Birth <span className="required">*</span></label>
                <input type="date" name="dob" className={`lims-input ${errors.dob ? 'invalid' : ''}`} value={form.dob} onChange={handleChange} />
              </div>
              <div className="col-md-1">
                <label className="lims-label">Age</label>
                <input className="lims-input" value={`${form.age} Yrs`} disabled />
              </div>

              <div className="col-md-4">
                <label className="lims-label">Gender <span className="required">*</span></label>
                <select name="gender" className={`lims-select ${errors.gender ? 'invalid' : ''}`} value={form.gender} onChange={handleChange}>
                  <option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option>
                </select>
              </div>
              {form.gender === "Other" && (
                <div className="col-md-4">
                  <label className="lims-label">Gender Identity <span className="required">*</span></label>
                  <select name="genderIdentity" className="lims-select" value={form.genderIdentity} onChange={handleChange}>
                    <option value="Transwomen">Transwomen</option><option value="Transman">Transman</option>
                  </select>
                </div>
              )}

              <div className="col-md-4">
                <label className="lims-label">Report Type</label>
                <select name="reportType" className="lims-select" value={form.reportType} onChange={handleChange}>
                  <option value="Hand">Hand</option><option value="Digital">Digital</option>
                </select>
              </div>

              <div className="col-md-4">
                <label className="lims-label">Barcode</label>
                <input name="barcode" className="lims-input" placeholder="Scan barcode" value={form.barcode || ""} onChange={handleChange} />
              </div>

              <div className="col-md-4">
                <label className="lims-label">UH ID</label>
                <input type="number" name="uhId" className="lims-input" placeholder="14 digits" value={form.uhId || ""} onChange={(e) => e.target.value.length <= 14 && handleChange(e)} />
              </div>
            </div>
          </div>
        </div>

        {/* Step 2: Contact Details */}
        <div className="form-card">
          <div className="form-card-header"><h6><span className="step-badge">2</span>Contact Details</h6></div>
          <div className="form-card-body">
            <div className="row g-3">
              <div className="col-md-4">
                <label className="lims-label">Mobile Number <span className="required">*</span></label>
                <input name="phone" className={`lims-input ${errors.phone ? 'invalid' : ''}`} maxLength={10} value={form.phone} onChange={handleChange} />
                {errors.phone && <div className="lims-error-text">{errors.phone}</div>}
              </div>
              <div className="col-md-8">
                <label className="lims-label">Address <span className="required">*</span></label>
                <input name="address" className={`lims-input ${errors.address ? 'invalid' : ''}`} value={form.address} onChange={handleChange} />
                {errors.address && <div className="lims-error-text">{errors.address}</div>}
              </div>
            </div>
          </div>
        </div>

        {/* Step 3: Timing & Referral */}
        <div className="form-card">
          <div className="form-card-header"><h6><span className="step-badge">3</span>Sample Timing & Referral</h6></div>
          <div className="form-card-body">
            <div className="row g-3">
              <div className="col-md-6">
                <label className="lims-label">Collection Time</label>
                <input type="datetime-local" name="collectionTime" className="lims-input" value={form.collectionTime} onChange={handleChange} />
              </div>
              <div className="col-md-6">
                <label className="lims-label">Received Time <span className="required">*</span></label>
                <input type="datetime-local" name="receivedTime" className={`lims-input ${errors.receivedTime ? 'invalid' : ''}`} value={form.receivedTime} onChange={handleChange} />
                {errors.receivedTime && <div className="lims-error-text">{errors.receivedTime}</div>}
              </div>
            </div>
            <div className="row g-3 mt-1">
              <div className="col-12">
                <label className="lims-label">Doctor Referral</label>
                <div className="radio-group">
                  <label className="radio-item"><input type="radio" checked={!hasRefDoctor} onChange={() => { setHasRefDoctor(false); setForm(p => ({ ...p, refDoctorName: "" })); }} /> No</label>
                  <label className="radio-item"><input type="radio" checked={hasRefDoctor} onChange={() => setHasRefDoctor(true)} /> Yes</label>
                </div>
              </div>
              {hasRefDoctor && (
                <div className="col-md-6">
                  <label className="lims-label">Referring Doctor <span className="required">*</span></label>
                  <SearchableSelect
                    name="refDoctorName"
                    options={doctors.map(doc => ({ value: doc.name, label: doc.name, sublabel: doc.doctorId }))}
                    value={form.refDoctorName || ""}
                    onChange={handleChange}
                    placeholder="Search & Select Doctor"
                    error={!!errors.refDoctorName}
                  />
                  {errors.refDoctorName && <div className="lims-error-text">{errors.refDoctorName}</div>}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn-lims-secondary" onClick={() => router.push("/patients")}>Cancel</button>
          <button type="submit" className="btn-lims-primary" disabled={loading}>{loading ? "Updating..." : "Update Profile"}</button>
        </div>
      </form>
    </>
  );
}
