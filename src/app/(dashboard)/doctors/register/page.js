"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Icons } from "@/app/components/Icons";

const EMPTY_FORM = {
  name: "",
  speciality: "",
  degree: "",
  experience: "",
  mciNumber: "",
  phone: "",
  email: "",
  clinicName: "",
  location: "",
  clinicAddress: "",
  commission: "0",
  doctorType: "Regular",
  status: "Active",
};

export default function DoctorRegistration() {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [showErrors, setShowErrors] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pendingPayload, setPendingPayload] = useState(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (showErrors && errors[name]) {
      setErrors((prev) => {
        const newErrs = { ...prev };
        delete newErrs[name];
        return newErrs;
      });
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!form.name.trim()) newErrors.name = "Doctor name is required";
    else if (form.name.trim().length < 2) newErrors.name = "Name must be at least 2 characters";
    else if (form.name.length > 50) newErrors.name = "Name must not exceed 50 characters";
    else if (!/^[A-Za-z .]+$/.test(form.name)) newErrors.name = "Only letters, spaces, and periods allowed";
    if (!form.speciality.trim()) newErrors.speciality = "speciality is required";
    if (!form.degree.trim()) newErrors.degree = "Qualification/Degree is required";
    else if (!/^[A-Za-z .,]+$/.test(form.degree)) newErrors.degree = "Only letters, spaces, and periods/commas allowed";
    if (!form.experience.toString().trim()) newErrors.experience = "Experience is required";
    else if (isNaN(form.experience) || parseInt(form.experience) < 0) newErrors.experience = "Invalid experience";
    

    if (!form.phone.trim()) newErrors.phone = "Mobile number is required";
    else if (!/^\d{10}$/.test(form.phone)) newErrors.phone = "Mobile number must be 10 digits";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = "Invalid email format";
    }

    if (!form.clinicName.trim()) newErrors.clinicName = "Clinic/Hospital name is required";
    if (!form.location.trim()) newErrors.location = "Location is required";
    if (!form.clinicAddress.trim()) newErrors.clinicAddress = "Practice address is required";

    if (form.commission !== undefined && form.commission !== "" && (isNaN(form.commission) || parseFloat(form.commission) < 0 || parseFloat(form.commission) > 40)) {
      newErrors.commission = "Commission must be between 0 and 40%";
    }
    return newErrors;
  };

  const submitDoctor = async (payload) => {
    setLoading(true);
    setStatus({ type: "", message: "" });
    try {
      const res = await fetch("/api/doctor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      // Duplicate phone warning from API
      if (res.status === 201) {
        setStatus({ type: "success", message: `Doctor registered successfully — ID: ${data.doctorId}` });
        setForm(EMPTY_FORM);
        setShowErrors(false);
      } else {
        setStatus({ type: "danger", message: data.error || "Something went wrong." });
      }
    } catch {
      setStatus({ type: "danger", message: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
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

    setErrors({});
    const payload = { ...form };
    if (!payload.email) delete payload.email;

    await submitDoctor(payload);
  };

  if (!mounted) return null;

  return (
    <>
      <div className="page-header">
        <div className="page-header-icon">{Icons.plus}</div>
        <div className="page-header-text">
          <h4>Add New Doctor</h4>
          <small>Register a new referring or consulting clinician</small>
        </div>
        <button className="btn-view-patients" onClick={() => router.push("/doctors")}>
          {Icons.list} View Doctors
        </button>
      </div>

      {status.message && (
        <div className={`lims-alert ${status.type}`} role="alert" style={{ marginBottom: '20px' }}>
          <span>{status.message}</span>
          <button className="lims-alert-close" onClick={() => setStatus({ type: "", message: "" })}>{Icons.close}</button>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {/* Section 1: Professional Profile */}
        <div className="form-card">
          <div className="form-card-header">
            <h6><span className="step-badge">1</span>Professional Profile</h6>
          </div>
          <div className="form-card-body">
            <div className="row g-3">
              <div className="col-md-4">
                <label className="lims-label">Doctor ID</label>
                <input className="lims-input" value="Auto-generated" disabled />
              </div>
              <div className="col-md-4">
                <label className="lims-label">Doctor Full Name <span className="required">*</span></label>
                <input 
                  name="name" 
                  className={`lims-input ${errors.name ? 'invalid' : ''}`} 
                  placeholder="e.g. Dr. John Doe" 
                  value={form.name} 
                  maxLength={50}
                  onChange={handleChange} 
                />
                {errors.name && <div className="lims-error-text">{errors.name}</div>}
              </div>
              <div className="col-md-4">
                <label className="lims-label">MCI Registration Number</label>
                <input 
                  name="mciNumber" 
                  className={`lims-input ${errors.mciNumber ? 'invalid' : ''}`} 
                  placeholder="Enter medical council ID" 
                  value={form.mciNumber} 
                  onChange={handleChange} 
                />
                {errors.mciNumber && <div className="lims-error-text">{errors.mciNumber}</div>}
              </div>
              <div className="col-md-4">
                <label className="lims-label">speciality <span className="required">*</span></label>
                <select 
                  name="speciality" 
                  className={`lims-select ${errors.speciality ? 'invalid' : ''}`} 
                  value={form.speciality} 
                  onChange={handleChange}
                >
                  <option value="">Select speciality</option>
                  <option value="Cardiologist">Cardiologist</option>
                  <option value="Pathologist">Pathologist</option>
                  <option value="Hematologist">Hematologist</option>
                  <option value="General Physician">General Physician</option>
                  <option value="Radiologist">Radiologist</option>
                  <option value="Gastroenterologist">Gastroenterologist</option>
                  <option value="Nephrologist">Nephrologist</option>
                  <option value="Neurologist">Neurologist</option>
                  <option value="Oncologist">Oncologist</option>
                  <option value="Orthopedic">Orthopedic</option>
                  <option value="Dermatologist">Dermatologist</option>
                  <option value="ENT">ENT</option>
                  <option value="Ophthalmologist">Ophthalmologist</option>
                  <option value="Pulmonologist">Pulmonologist</option>
                  <option value="Endocrinologist">Endocrinologist</option>
                  <option value="Other">Other</option>
                </select>
                {errors.speciality && <div className="lims-error-text">{errors.speciality}</div>}
              </div>
              <div className="col-md-4">
                <label className="lims-label">Degree/Qualification <span className="required">*</span></label>
                <input 
                  name="degree" 
                  className={`lims-input ${errors.degree ? 'invalid' : ''}`} 
                  placeholder="e.g. MBBS, MD" 
                  value={form.degree} 
                  onChange={handleChange} 
                />
                {errors.degree && <div className="lims-error-text">{errors.degree}</div>}
              </div>
              <div className="col-md-4">
                <label className="lims-label">Experience (Years) <span className="required">*</span></label>
                <input 
                  name="experience" 
                  type="number"
                  className={`lims-input ${errors.experience ? 'invalid' : ''}`} 
                  placeholder="Years of practice" 
                  value={form.experience} 
                  onChange={handleChange} 
                />
                {errors.experience && <div className="lims-error-text">{errors.experience}</div>}
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Contact & Clinic */}
        <div className="form-card">
          <div className="form-card-header">
            <h6><span className="step-badge">2</span>Contact & Practice Details</h6>
          </div>
          <div className="form-card-body">
            <div className="row g-3">
              <div className="col-md-4">
                <label className="lims-label">Mobile Number <span className="required">*</span></label>
                <input 
                  name="phone" 
                  className={`lims-input ${errors.phone ? 'invalid' : ''}`} 
                  placeholder="10-digit mobile" 
                  maxLength={10} 
                  value={form.phone} 
                  onChange={handleChange} 
                />
                {errors.phone && <div className="lims-error-text">{errors.phone}</div>}
              </div>
              <div className="col-md-4">
                <label className="lims-label">Email Address</label>
                <input 
                  name="email" 
                  type="email"
                  className={`lims-input ${errors.email ? 'invalid' : ''}`} 
                  placeholder="doctor@example.com" 
                  value={form.email} 
                  onChange={handleChange} 
                />
                {errors.email && <div className="lims-error-text">{errors.email}</div>}
              </div>
              <div className="col-md-4">
                <label className="lims-label">Clinic/Hospital Name <span className="required">*</span></label>
                <input 
                  name="clinicName" 
                  className={`lims-input ${errors.clinicName ? 'invalid' : ''}`} 
                  placeholder="Name of primary practice" 
                  value={form.clinicName} 
                  onChange={handleChange} 
                />
                {errors.clinicName && <div className="lims-error-text">{errors.clinicName}</div>}
              </div>
              <div className="col-md-4">
                <label className="lims-label">Practice Location <span className="required">*</span></label>
                <input 
                  name="location" 
                  className={`lims-input ${errors.location ? 'invalid' : ''}`} 
                  placeholder="e.g. City or Area" 
                  value={form.location} 
                  onChange={handleChange} 
                />
                {errors.location && <div className="lims-error-text">{errors.location}</div>}
              </div>
              <div className="col-md-8">
                <label className="lims-label">Practice Address <span className="required">*</span></label>
                <input 
                  name="clinicAddress" 
                  className={`lims-input ${errors.clinicAddress ? 'invalid' : ''}`} 
                  placeholder="Full address of the clinic or hospital" 
                  value={form.clinicAddress} 
                  onChange={handleChange} 
                />
                {errors.clinicAddress && <div className="lims-error-text">{errors.clinicAddress}</div>}
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Administrative */}
        <div className="form-card">
          <div className="form-card-header">
            <h6><span className="step-badge">3</span>Administrative & Billing</h6>
          </div>
          <div className="form-card-body">
            <div className="row g-3">
              <div className="col-md-4">
                <label className="lims-label">Commission Percentage (%)</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    name="commission" 
                    type="number"
                    className={`lims-input ${errors.commission ? 'invalid' : ''}`} 
                    placeholder="0" 
                    value={form.commission} 
                    max="40"
                    step="0.1"
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (val > 40) {
                        setForm(prev => ({ ...prev, commission: "40" }));
                      } else {
                        handleChange(e);
                      }
                    }} 
                  />
                  <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontWeight: '600' }}>%</span>
                </div>
                {errors.commission && <div className="lims-error-text">{errors.commission}</div>}
              </div>
              <div className="col-md-4">
                <label className="lims-label">Doctor Type</label>
                <select 
                  name="doctorType" 
                  className="lims-select" 
                  value={form.doctorType} 
                  onChange={handleChange}
                >
                  <option value="Regular">Regular</option>
                  <option value="Investor">Investors</option>
                </select>
              </div>
              <div className="col-md-4">
                <label className="lims-label">Account Status</label>
                <select 
                  name="status" 
                  className="lims-select" 
                  value={form.status} 
                  onChange={handleChange}
                >
                  <option value="Active">Active</option>
                  <option value="On Leave">On Leave</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button 
            type="button" 
            className="btn-lims-secondary" 
            onClick={() => {
              setForm(EMPTY_FORM);
              setErrors({});
              setShowErrors(false);
              setStatus({ type: "", message: "" });
            }}
          >
            Reset
          </button>
          <button 
            type="submit" 
            className="btn-lims-primary" 
            disabled={loading}
          >
            {loading ? "Registering..." : "Save Doctor"}
          </button>
        </div>
      </form>

    </>
  );
}
