"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Icons } from "@/app/components/Icons";
import SuccessDialog from "@/app/components/SuccessDialog";
import { clearCachedApi } from "@/app/lib/use-current-user";

export default function DoctorProfile() {
  const router = useRouter();
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [showErrors, setShowErrors] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch("/api/doctor/me", { credentials: "include" });
        const data = await res.json();
        if (res.ok) {
          setForm(data);
        } else {
          setStatus({ type: "danger", message: data.error || "Unable to load profile" });
        }
      } catch {
        setStatus({ type: "danger", message: "Network error loading profile" });
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (showErrors) {
      setErrors((prev) => { const n = { ...prev }; delete n[name]; return n; });
    }
  };

  const validate = () => {
    const e = {};
    if (form.phone && !/^\d{10}$/.test(form.phone)) e.phone = "Mobile number must be 10 digits";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Invalid email format";
    if (form.experience !== undefined && (isNaN(Number(form.experience)) || Number(form.experience) < 0 || Number(form.experience) > 80)) e.experience = "Experience must be 0–80";
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setShowErrors(true);
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setSaving(true);
    setStatus({ type: "", message: "" });
    try {
      const res = await fetch("/api/doctor/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        clearCachedApi("/api/doctor");
        setStatus({ type: "success", message: "Profile updated successfully." });
        setTimeout(() => router.push("/dashboard"), 3000);
      } else {
        setStatus({ type: "danger", message: data.error || "Update failed" });
      }
    } catch {
      setStatus({ type: "danger", message: "Network error" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="module-page p-5">Loading profile...</div>;
  if (!form) return <div className="module-page p-5 text-danger">{status.message || "Profile not available."}</div>;

  return (
    <div className="module-page" style={{ maxWidth: 720, margin: "0 auto" }}>
      <div className="page-header">
        <div className="page-header-icon">{Icons.stethoscope}</div>
        <div className="page-header-text">
          <h4>My Profile</h4>
          <small>{form.name} · {form.doctorId}</small>
        </div>
        <button className="btn-view-patients" onClick={() => router.push("/dashboard")}>
          {Icons.arrowLeft} Back to Dashboard
        </button>
      </div>

      <SuccessDialog message={status.type === "success" ? status.message : ""} onClose={() => setStatus({ type: "", message: "" })} />
      {status.message && status.type !== "success" && (
        <div className={`lims-alert ${status.type}`} style={{ marginBottom: 20 }}>
          <span>{status.message}</span>
          <button className="lims-alert-close" onClick={() => setStatus({ type: "", message: "" })}>{Icons.close}</button>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-card">
          <div className="form-card-header"><h6><span className="step-badge">1</span>Professional Profile</h6></div>
          <div className="form-card-body">
            <div className="row g-3">
              <div className="col-md-6">
                <label className="lims-label">Doctor ID</label>
                <input className="lims-input" value={form.doctorId || ""} disabled />
              </div>
              <div className="col-md-6">
                <label className="lims-label">Name</label>
                <input className="lims-input" value={form.name || ""} disabled />
              </div>
              <div className="col-md-6">
                <label className="lims-label">MCI Number</label>
                <input className="lims-input" value={form.mciNumber || ""} disabled />
              </div>
              <div className="col-md-6">
                <label className="lims-label">Speciality <span className="required">*</span></label>
                <input name="speciality" className={`lims-input ${errors.speciality ? "invalid" : ""}`} value={form.speciality || ""} onChange={handleChange} />
                {errors.speciality && <div className="lims-error-text">{errors.speciality}</div>}
              </div>
              <div className="col-md-6">
                <label className="lims-label">Qualification <span className="required">*</span></label>
                <input name="degree" className={`lims-input ${errors.degree ? "invalid" : ""}`} value={form.degree || ""} onChange={handleChange} />
                {errors.degree && <div className="lims-error-text">{errors.degree}</div>}
              </div>
              <div className="col-md-6">
                <label className="lims-label">Gender</label>
                <input className="lims-input" value={form.gender || ""} disabled />
              </div>
              <div className="col-md-6">
                <label className="lims-label">Experience (Years) <span className="required">*</span></label>
                <input type="number" name="experience" className={`lims-input ${errors.experience ? "invalid" : ""}`} value={form.experience ?? ""} onChange={handleChange} min="0" max="80" />
                {errors.experience && <div className="lims-error-text">{errors.experience}</div>}
              </div>
            </div>
          </div>
        </div>

        <div className="form-card">
          <div className="form-card-header"><h6><span className="step-badge">2</span>Contact & Practice Details</h6></div>
          <div className="form-card-body">
            <div className="row g-3">
              <div className="col-md-6">
                <label className="lims-label">Phone <span className="required">*</span></label>
                <input name="phone" className={`lims-input ${errors.phone ? "invalid" : ""}`} value={form.phone || ""} onChange={handleChange} maxLength={10} />
                {errors.phone && <div className="lims-error-text">{errors.phone}</div>}
              </div>
              <div className="col-md-6">
                <label className="lims-label">Email <span className="required">*</span></label>
                <input name="email" className={`lims-input ${errors.email ? "invalid" : ""}`} value={form.email || ""} onChange={handleChange} />
                {errors.email && <div className="lims-error-text">{errors.email}</div>}
              </div>
              <div className="col-md-6">
                <label className="lims-label">Clinic / Hospital <span className="required">*</span></label>
                <input name="clinicName" className={`lims-input ${errors.clinicName ? "invalid" : ""}`} value={form.clinicName || ""} onChange={handleChange} />
                {errors.clinicName && <div className="lims-error-text">{errors.clinicName}</div>}
              </div>
              <div className="col-md-6">
                <label className="lims-label">Location <span className="required">*</span></label>
                <input name="location" className={`lims-input ${errors.location ? "invalid" : ""}`} value={form.location || ""} onChange={handleChange} />
                {errors.location && <div className="lims-error-text">{errors.location}</div>}
              </div>
              <div className="col-12">
                <label className="lims-label">Practice Address <span className="required">*</span></label>
                <input name="clinicAddress" className={`lims-input ${errors.clinicAddress ? "invalid" : ""}`} value={form.clinicAddress || ""} onChange={handleChange} />
                {errors.clinicAddress && <div className="lims-error-text">{errors.clinicAddress}</div>}
              </div>
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn-lims-secondary" onClick={() => router.push("/dashboard")}>Cancel</button>
          <button type="submit" className="btn-lims-primary" disabled={saving}>{saving ? "Saving..." : "Update Profile"}</button>
        </div>
      </form>
    </div>
  );
}
