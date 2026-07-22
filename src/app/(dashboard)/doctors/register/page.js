"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Icons } from "@/app/components/Icons";
import SuccessDialog from "@/app/components/SuccessDialog";
import { clearCachedApi } from "@/app/lib/use-current-user";
import { validateDoctorPayload } from "@/app/utils/doctor-validation";

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
  gender: "Male",
  genderIdentity: "",
  doctorType: "Non-Investor",
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
    if (name === "name") {
      const sanitized = value.replace(/[^A-Za-z ]/g, "").slice(0, 30);
      const capitalized = sanitized.charAt(0).toUpperCase() + sanitized.slice(1);
      setForm((prev) => ({ ...prev, name: capitalized }));
    } else if (name === "mciNumber") {
      const sanitized = value.replace(/[^A-Za-z0-9/]/g, "").slice(0, 20);
      setForm((prev) => ({ ...prev, mciNumber: sanitized }));
    } else if (name === "experience") {
      const cleaned = value.replace(/\D/g, "").slice(0, 2);
      setForm((prev) => ({ ...prev, experience: cleaned }));
    } else if (name === "phone") {
      const sanitized = value.replace(/\D/g, "").slice(0, 10);
      setForm((prev) => ({ ...prev, phone: sanitized }));
    } else if (name === "clinicName") {
      const sanitized = value.replace(/[^A-Za-z ]/g, "").slice(0, 25);
      setForm((prev) => ({ ...prev, clinicName: sanitized }));
    } else if (name === "location") {
      const sanitized = value.replace(/[^A-Za-z ]/g, "").slice(0, 20);
      const capitalized = sanitized.charAt(0).toUpperCase() + sanitized.slice(1);
      setForm((prev) => ({ ...prev, location: capitalized }));
    } else if (name === "clinicAddress") {
      const sanitized = value.replace(/[^A-Za-z0-9 .,/-]/g, "").slice(0, 100);
      setForm((prev) => ({ ...prev, clinicAddress: sanitized }));
    } else if (name === "commission") {
      const cleaned = value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1").slice(0, 5);
      if (!/^\d*\.?\d{0,2}$/.test(cleaned)) return;
      const num = Number(cleaned);
      if (cleaned && !isNaN(num) && num > 40) return;
      setForm((prev) => ({ ...prev, commission: cleaned }));
    } else {
      setForm((prev) => ({
        ...prev,
        [name]: value,
        ...(name === "gender" && value !== "Other" ? { genderIdentity: "" } : {}),
      }));
    }
    if (showErrors && errors[name]) {
      setErrors((prev) => {
        const newErrs = { ...prev };
        delete newErrs[name];
        return newErrs;
      });
    }
  };

  const validateForm = () => {
    return validateDoctorPayload(form);
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
        clearCachedApi("/api/doctor");
        clearCachedApi("/api/dashboard/stats");
        const portalMessage = data.portalAccount?.invitationSent
          ? ` Portal account created for ${data.portalAccount.email}; activation invitation sent.`
          : ` Portal account created for ${data.portalAccount?.email || payload.email}, but the invitation email was not sent. Use Resend Invitation from the doctor record.`;
        setStatus({ type: "success", message: `Doctor registered successfully. Doctor ID: ${data.doctorId}.${portalMessage}` });
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
    const payload = Object.fromEntries(
      Object.entries(form).map(([key, value]) => [key, typeof value === "string" ? value.trim() : value])
    );

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
                  placeholder="Enter doctor name" 
                  value={form.name} 
                  minLength={2}
                  maxLength={30}
                  onChange={handleChange} 
                />
                {errors.name && <div className="lims-error-text">{errors.name}</div>}
              </div>
              <div className="col-md-4">
                <label className="lims-label">MCI Registration Number <span className="required">*</span></label>
                <input 
                  name="mciNumber" 
                  className={`lims-input ${errors.mciNumber ? 'invalid' : ''}`} 
                  placeholder="Enter medical council ID" 
                  value={form.mciNumber} 
                  minLength={5}
                  maxLength={20}
                  pattern="[A-Za-z0-9/]+"
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
                <select
                  name="degree"
                  className={`lims-select ${errors.degree ? 'invalid' : ''}`}
                  value={form.degree}
                  onChange={handleChange}
                >
                  <option value="">Select qualification</option>
                  <option value="MBBS">MBBS</option>
                  <option value="MD">MD</option>
                  <option value="MS">MS</option>
                  <option value="DM">DM</option>
                  <option value="MCh">MCh</option>
                  <option value="BDS">BDS</option>
                  <option value="MDS">MDS</option>
                  <option value="BAMS">BAMS</option>
                  <option value="BHMS">BHMS</option>
                  <option value="BUMS">BUMS</option>
                  <option value="DNB">DNB</option>
                  <option value="PhD">PhD</option>
                  <option value="Other">Other</option>
                </select>
                {errors.degree && <div className="lims-error-text">{errors.degree}</div>}
              </div>
              <div className="col-md-4">
                <label className="lims-label">Gender</label>
                <select
                  name="gender"
                  className={`lims-select ${errors.gender ? 'invalid' : ''}`}
                  value={form.gender}
                  onChange={handleChange}
                >
                  <option value="">Select gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
                {errors.gender && <div className="lims-error-text">{errors.gender}</div>}
              </div>
              {form.gender === "Other" && (
                <div className="col-md-4">
                  <label className="lims-label">Gender Identity <span className="required">*</span></label>
                  <select
                    name="genderIdentity"
                    className={`lims-select ${errors.genderIdentity ? 'invalid' : ''}`}
                    value={form.genderIdentity}
                    onChange={handleChange}
                  >
                    <option value="">Select identity</option>
                    <option value="Transwomen">Transwomen</option>
                    <option value="Transman">Transman</option>
                  </select>
                  {errors.genderIdentity && <div className="lims-error-text">{errors.genderIdentity}</div>}
                </div>
              )}
              <div className="col-md-4">
                <label className="lims-label">Experience (Years) <span className="required">*</span></label>
                <input 
                  name="experience" 
                  type="text"
                  inputMode="numeric"
                  className={`lims-input ${errors.experience ? 'invalid' : ''}`} 
                  placeholder="Enter experience" 
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
                  placeholder="Enter mobile number" 
                  inputMode="numeric"
                  minLength={10}
                  maxLength={10} 
                  value={form.phone} 
                  onChange={handleChange} 
                />
                {errors.phone && <div className="lims-error-text">{errors.phone}</div>}
              </div>
              <div className="col-md-4">
                <label className="lims-label">Email Address <span className="required">*</span></label>
                <input 
                  name="email" 
                  type="email"
                  className={`lims-input ${errors.email ? 'invalid' : ''}`} 
                  placeholder="Enter email" 
                  value={form.email} 
                  maxLength={100}
                  onChange={handleChange} 
                />
                {errors.email && <div className="lims-error-text">{errors.email}</div>}
              </div>
              <div className="col-md-4">
                <label className="lims-label">Clinic/Hospital Name <span className="required">*</span></label>
                <input 
                  name="clinicName" 
                  className={`lims-input ${errors.clinicName ? 'invalid' : ''}`} 
                  placeholder="Enter clinic or hospital name" 
                  value={form.clinicName} 
                  maxLength={25}
                  onChange={handleChange} 
                />
                {errors.clinicName && <div className="lims-error-text">{errors.clinicName}</div>}
              </div>
              <div className="col-md-4">
                <label className="lims-label">Practice Location <span className="required">*</span></label>
                <input 
                  name="location" 
                  className={`lims-input ${errors.location ? 'invalid' : ''}`} 
                  placeholder="Enter location" 
                  value={form.location} 
                  maxLength={20}
                  onChange={handleChange} 
                />
                {errors.location && <div className="lims-error-text">{errors.location}</div>}
              </div>
              <div className="col-md-8">
                <label className="lims-label">Practice Address <span className="required">*</span></label>
                <input 
                  name="clinicAddress" 
                  className={`lims-input ${errors.clinicAddress ? 'invalid' : ''}`} 
                  placeholder="Enter practice address" 
                  value={form.clinicAddress} 
                  maxLength={100}
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
                    type="text"
                    inputMode="decimal"
                    className={`lims-input ${errors.commission ? 'invalid' : ''}`} 
                    placeholder="Enter commission" 
                    value={form.commission} 
                    onChange={handleChange}
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
                  <option value="Non-Investor">Non-Investor</option>
                  <option value="Investor">Investor</option>
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
