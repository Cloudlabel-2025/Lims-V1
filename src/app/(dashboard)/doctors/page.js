"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Icons } from "@/app/components/Icons";
import { hasPermission } from "@/app/lib/client-rbac";
import { cachedJsonFetch, clearCachedApi, useCurrentUser } from "@/app/lib/use-current-user";

/* ── Helpers ── */
const getInitials = (name) => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(p => !["Dr.", "Dr"].includes(p));
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : parts[0]?.[0]?.toUpperCase() || "?";
};

const formatDate = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
};

const getStatusStyle = (status) => {
  switch (status) {
    case "Active": return { bg: "#ecfdf5", color: "#065f46", dot: "#10b981" };
    case "On Leave": return { bg: "#fffbeb", color: "#92400e", dot: "#f59e0b" };
    case "Inactive": return { bg: "#fff1f2", color: "#9f1239", dot: "#f43f5e" };
    default: return { bg: "#f1f5f9", color: "#64748b", dot: "#94a3b8" };
  }
};

export default function DoctorList() {
  const user = useCurrentUser();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [allDoctors, setAllDoctors] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const debounceRef = useRef(null);
  const [viewType, setViewType] = useState("grid"); // 'grid' or 'list'
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });
  const [deleteModal, setDeleteModal] = useState({ open: false, doctor: null });
  const [deleting, setDeleting] = useState(false);
  const [paying, setPaying] = useState(false);
  const [actionError, setActionError] = useState("");
  const [payoutConfirm, setPayoutConfirm] = useState(false);
  const [payoutMethod, setPayoutMethod] = useState("cash");
  const [payoutHistory, setPayoutHistory] = useState([]);
  const [showPayoutHistory, setShowPayoutHistory] = useState(false);
  const [payoutHistoryLoading, setPayoutHistoryLoading] = useState(false);
  const canRegisterDoctors = hasPermission(user, "doctors.register");
  const canEditDoctors = hasPermission(user, "doctors.edit");
  const canDeleteDoctors = hasPermission(user, "doctors.delete");

  const fetchAllDoctors = useCallback(async (page = 1) => {
    setListLoading(true);
    try {
      const { data } = await cachedJsonFetch(`/api/doctor?page=${page}&limit=50`, { ttl: 15_000 });
      setAllDoctors(Array.isArray(data) ? data : data.doctors || []);
      setPagination(Array.isArray(data) ? { page: 1, limit: data.length, total: data.length, totalPages: 1 } : data.pagination || { page, limit: 50, total: 0, totalPages: 1 });
    } catch {
      setAllDoctors([]);
      setPagination({ page, limit: 50, total: 0, totalPages: 1 });
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    fetchAllDoctors(1);
  }, [fetchAllDoctors]);

  const doSearch = useCallback(async (query, page = 1) => {
    setListLoading(true);
    try {
      const { data } = await cachedJsonFetch(`/api/doctor?search=${encodeURIComponent(query)}&page=${page}&limit=50`, { ttl: 5_000 });
      setAllDoctors(Array.isArray(data) ? data : data.doctors || []);
      setPagination(Array.isArray(data) ? { page: 1, limit: data.length, total: data.length, totalPages: 1 } : data.pagination || { page, limit: 50, total: 0, totalPages: 1 });
    } catch {
      setAllDoctors([]);
      setPagination({ page, limit: 50, total: 0, totalPages: 1 });
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!mounted) return;

    if (!searchTerm.trim()) {
      fetchAllDoctors(currentPage);
      return;
    }

    debounceRef.current = setTimeout(() => doSearch(searchTerm, currentPage), 350);
    return () => clearTimeout(debounceRef.current);
  }, [currentPage, searchTerm, doSearch, mounted, fetchAllDoctors]);

  const handleSelectDoctor = (doctor) => {
    setSelectedDoctor(doctor);
    setSidebarOpen(true);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
    setTimeout(() => setSelectedDoctor(null), 400);
  };

  const openDeleteModal = (doctor, e) => {
    if (e) e.stopPropagation();
    setDeleteModal({ open: true, doctor });
  };

  const closeDeleteModal = () => {
    setDeleteModal({ open: false, doctor: null });
  };

  const handleDelete = async () => {
    if (!deleteModal.doctor) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/doctor/${deleteModal.doctor._id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        clearCachedApi("/api/doctor");
        setAllDoctors((prev) => prev.filter((d) => d._id !== deleteModal.doctor._id));
        if (selectedDoctor?._id === deleteModal.doctor._id) closeSidebar();
        closeDeleteModal();
      } else {
        setActionError(data.error || "Failed to delete doctor");
      }
    } catch {
      setActionError("Network error. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  const handlePayout = async () => {
    if (!selectedDoctor || selectedDoctor.pendingPayout <= 0) return;
    setPaying(true);
    setActionError("");
    try {
      const res = await fetch("/api/doctor/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doctorId: selectedDoctor._id, paymentMethod: payoutMethod })
      });
      const data = await res.json();
      if (res.ok) {
        clearCachedApi("/api/doctor");
        setAllDoctors(prev => prev.map(d => d._id === selectedDoctor._id ? { ...d, pendingPayout: 0 } : d));
        setSelectedDoctor(prev => ({ ...prev, pendingPayout: 0 }));
        setPayoutConfirm(false);
      } else {
        setActionError(data.error || "Failed to release payout");
      }
    } catch {
      setActionError("Network error");
    } finally {
      setPaying(false);
    }
  };

  const loadPayoutHistory = useCallback(async (doctorId) => {
    setPayoutHistoryLoading(true);
    try {
      const res = await fetch(`/api/doctor/payout?doctorId=${doctorId}&limit=50`);
      const data = await res.json();
      if (res.ok) setPayoutHistory(data.payouts || []);
    } catch {
      setPayoutHistory([]);
    } finally {
      setPayoutHistoryLoading(false);
    }
  }, []);

  if (!mounted) return null;

  return (
    <div className="doctors-module">
      <div className={`sidebar-overlay ${sidebarOpen ? "open" : ""}`} onClick={closeSidebar} />

      {/* Doctor Detail Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        {selectedDoctor && (
          <div className="sidebar-top">
            <div className="sidebar-header">
              <div className="sidebar-logo-flower">{Icons.logo}</div>
              <span className="sidebar-header-title">Doctor Details</span>
              <button className="sidebar-close-menu" onClick={closeSidebar}>{Icons.close}</button>
            </div>
            <div className="sidebar-photo-section">
              <div className="patient-photo-card">
                <div className="patient-photo-initials-large">{getInitials(selectedDoctor.name)}</div>
              </div>
              <div className="patient-name-header">
                <div className="patient-name-text">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)' }}>{selectedDoctor.name}</span>
                  </div>
                  <div className="patient-tag-id" style={{ marginTop: '4px' }}>{selectedDoctor.doctorId}</div>
                </div>
              </div>

              <div className="teal-brand-card" style={{ marginBottom: '24px', width: '100%' }}>
                <div className="brand-header-mini">
                  <div className="brand-logo-mini">{Icons.logo}</div>
                  <div className="brand-name-mini">UTHIRAM LIMS</div>
                </div>
                
                <div className="brand-patient-info">
                  <div className="brand-patient-name">{selectedDoctor.name}</div>
                  <div className="brand-patient-id-mini">{selectedDoctor.doctorId}</div>
                </div>

                <div style={{ margin: '12px 0 20px', padding: '14px 16px', background: 'rgba(255,255,255,0.12)', borderRadius: '14px', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.12)', paddingBottom: '10px' }}>
                    <div style={{ fontSize: '11px', opacity: 0.9, fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.04em' }}>speciality</div>
                    <div style={{ fontSize: '13px', fontWeight: '700' }}>{selectedDoctor.speciality}</div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.12)', paddingBottom: '10px' }}>
                    <div style={{ fontSize: '11px', opacity: 0.9, fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Qualification</div>
                    <div style={{ fontSize: '13px', fontWeight: '700' }}>{selectedDoctor.degree}</div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: '11px', opacity: 0.9, fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Experience</div>
                    <div style={{ fontSize: '13px', fontWeight: '700' }}>{selectedDoctor.experience} Years</div>
                  </div>
                </div>

                <div className="vitals-grid-mini" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                  <div className="vital-mini-box">
                    <div className="vital-mini-label" style={{ fontSize: '10px', opacity: 1, fontWeight: '600' }}>COMMISSION</div>
                    <div className="vital-mini-value" style={{ fontSize: '15px', fontWeight: '700' }}>{selectedDoctor.commission || 0}%</div>
                  </div>
                  <div className="vital-mini-box" style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)' }}>
                    <div className="vital-mini-label" style={{ fontSize: '10px', opacity: 1, fontWeight: '600' }}>PENDING</div>
                    <div className="vital-mini-value" style={{ fontSize: '15px', fontWeight: '700', color: '#fff' }}>₹{selectedDoctor.pendingPayout || 0}</div>
                  </div>
                  <div className="vital-mini-box">
                    <div className="vital-mini-label" style={{ fontSize: '10px', opacity: 1, fontWeight: '600' }}>STATUS</div>
                    <div className="vital-mini-value" style={{ fontSize: '15px', fontWeight: '700' }}>{selectedDoctor.status}</div>
                  </div>
                </div>
              </div>

              <div className="patient-contact-grid">
                <div className="contact-row"><span className="contact-icon-mini">{Icons.phone}</span><span>+91 {selectedDoctor.phone}</span></div>
                <div className="contact-row"><span className="contact-icon-mini">{Icons.mail}</span><span className="text-truncate-1">{selectedDoctor.email || "—"}</span></div>
                <div className="contact-row"><span className="contact-icon-mini">{Icons.mapPin}</span><span className="text-truncate-2">{selectedDoctor.clinicAddress}</span></div>
              </div>
            </div>

            <div className="sidebar-detail-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="detail-item"><div className="detail-value">{selectedDoctor.mciNumber}</div><div className="detail-label">MCI Registration No.</div></div>
              <div className="detail-item"><div className="detail-value">{selectedDoctor.clinicName}</div><div className="detail-label">Clinic / Hospital</div></div>
              <div className="detail-item"><div className="detail-value">{selectedDoctor.location}</div><div className="detail-label">Practice Location</div></div>
              <div className="detail-item"><div className="detail-value">{formatDate(selectedDoctor.createdAt)}</div><div className="detail-label">Registered On</div></div>
            </div>

            <div style={{ padding: '0 24px 20px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Payout</div>
              {selectedDoctor.pendingPayout > 0 ? (
                payoutConfirm ? (
                  <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '14px' }}>
                    <p style={{ fontSize: '13px', color: '#92400e', margin: '0 0 10px', fontWeight: '600' }}>
                      Release ₹{selectedDoctor.pendingPayout} to {selectedDoctor.name}?
                    </p>
                    <select
                      value={payoutMethod}
                      onChange={(e) => setPayoutMethod(e.target.value)}
                      style={{ width: '100%', height: '36px', marginBottom: '10px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px', padding: '0 10px', background: '#fff' }}
                    >
                      <option value="cash">Cash</option>
                      <option value="bank">Bank Transfer</option>
                    </select>
                    {actionError && <p style={{ color: '#e11d48', fontSize: '12px', margin: '0 0 8px', fontWeight: '600' }}>{actionError}</p>}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => { setPayoutConfirm(false); setActionError(''); }}
                        style={{ flex: 1, height: '36px', border: '1px solid var(--border)', borderRadius: '8px', background: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handlePayout}
                        disabled={paying}
                        style={{ flex: 1, height: '36px', border: 'none', borderRadius: '8px', background: '#10b981', color: '#fff', cursor: paying ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: '600', opacity: paying ? 0.7 : 1 }}
                      >
                        {paying ? 'Releasing...' : 'Confirm Release'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span style={{ fontSize: '13px', color: '#7f1d1d', fontWeight: '600' }}>Pending Payout</span>
                      <span style={{ fontSize: '18px', fontWeight: '800', color: '#dc2626' }}>₹{selectedDoctor.pendingPayout}</span>
                    </div>
                    <button
                      onClick={() => { setPayoutConfirm(true); setActionError(''); }}
                      style={{ width: '100%', height: '38px', border: 'none', borderRadius: '8px', background: '#10b981', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: '700' }}
                    >
                      Release Payout
                    </button>
                  </div>
                )
              ) : (
                <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '10px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px' }}>✓</span>
                  <span style={{ fontSize: '13px', color: '#065f46', fontWeight: '600' }}>No pending payout</span>
                </div>
              )}
              <button
                onClick={() => { loadPayoutHistory(selectedDoctor._id); setShowPayoutHistory(true); }}
                style={{ width: '100%', height: '34px', marginTop: '8px', border: '1px solid var(--border)', borderRadius: '8px', background: 'transparent', cursor: 'pointer', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}
              >
                View Payout History
              </button>
            </div>

            {(canEditDoctors || canDeleteDoctors) && (
            <div style={{ padding: '20px 24px', display: 'flex', gap: '12px' }}>
              {canEditDoctors && (
              <button 
                className="btn-lims-primary" 
                style={{ flex: 1, height: '42px', fontSize: '13px' }}
                onClick={() => { closeSidebar(); router.push(`/doctors/edit/${selectedDoctor._id}`); }}
              >
                {Icons.edit} Edit Profile
              </button>
              )}
              {canDeleteDoctors && (
              <button 
                style={{ 
                  flex: 1, height: '42px', fontSize: '13px', 
                  border: '1.5px solid #f43f5e', borderRadius: '10px',
                  background: '#fff1f2', color: '#e11d48', 
                  cursor: 'pointer', fontWeight: '600',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#e11d48'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#fff1f2'; e.currentTarget.style.color = '#e11d48'; }}
                onClick={() => openDeleteModal(selectedDoctor)}
              >
                {Icons.trash} Delete
              </button>
              )}
            </div>
            )}
          </div>
        )}
      </aside>

      {showPayoutHistory && (
        <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "grid", placeItems: "center", zIndex: 1100 }} onClick={() => setShowPayoutHistory(false)}>
          <div className="form-card" style={{ padding: 24, borderRadius: 12, maxWidth: 560, width: "90%", maxHeight: "80vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h5 style={{ margin: 0, fontSize: 16 }}>Payout History</h5>
              <button onClick={() => setShowPayoutHistory(false)} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 18, color: "var(--text-muted)" }}>✕</button>
            </div>
            {payoutHistoryLoading ? (
              <p style={{ textAlign: "center", color: "var(--text-muted)", padding: 20 }}>Loading...</p>
            ) : payoutHistory.length === 0 ? (
              <p style={{ textAlign: "center", color: "var(--text-muted)", padding: 20 }}>No payout history found.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
                    <th style={{ padding: "10px 12px", textAlign: "left", color: "var(--text-secondary)", fontWeight: 700 }}>Date</th>
                    <th style={{ padding: "10px 12px", textAlign: "left", color: "var(--text-secondary)", fontWeight: 700 }}>Description</th>
                    <th style={{ padding: "10px 12px", textAlign: "right", color: "var(--text-secondary)", fontWeight: 700 }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {payoutHistory.map((entry) => (
                    <tr key={entry._id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                      <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>
                        {new Date(entry.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td style={{ padding: "10px 12px" }}>{entry.description}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: "#b91c1c" }}>₹{Number(entry.amount || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="page-header-icon">{Icons.stethoscope}</div>
          <div className="page-header-text">
            <h4>Doctor Master List</h4>
            <small>{allDoctors.length} doctors registered</small>
          </div>
        </div>

        <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, justifyContent: 'flex-end', minWidth: '300px' }}>
          {/* View Toggle */}
          <div style={{ 
            display: 'flex', 
            background: 'var(--border-light)', 
            padding: '4px', 
            borderRadius: '10px',
            marginRight: '8px'
          }}>
            <button 
              onClick={() => setViewType("grid")}
              style={{
                padding: '6px 10px',
                borderRadius: '8px',
                border: 'none',
                background: viewType === 'grid' ? '#fff' : 'transparent',
                color: viewType === 'grid' ? 'var(--brand-action, var(--primary))' : 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: '600',
                transition: 'all 0.2s',
                boxShadow: viewType === 'grid' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
              }}
            >
              {Icons.grid}
            </button>
            <button 
              onClick={() => setViewType("list")}
              style={{
                padding: '6px 10px',
                borderRadius: '8px',
                border: 'none',
                background: viewType === 'list' ? '#fff' : 'transparent',
                color: viewType === 'list' ? 'var(--brand-action, var(--primary))' : 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: '600',
                transition: 'all 0.2s',
                boxShadow: viewType === 'list' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
              }}
            >
              {Icons.list}
            </button>
          </div>

          <div className="search-container" style={{ position: "relative", flex: 1, maxWidth: "320px" }}>
            <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", fontSize: '14px' }}>
              {Icons.search}
            </span>
            <input
              type="text"
              className="lims-input"
              placeholder="Search doctors..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              style={{ paddingLeft: "36px", height: "40px", fontSize: '13px' }}
            />
          </div>
          
          {canRegisterDoctors && (
            <button 
              className="btn-lims-primary" 
              onClick={() => router.push("/doctors/register")}
              style={{ height: "40px", padding: "0 16px", fontSize: '13px', whiteSpace: 'nowrap' }}
            >
              {Icons.plus} Add New Doctor
            </button>
          )}
        </div>
      </div>

      <div className="doctor-list-container" style={{ marginTop: "24px" }}>
        <div className="patient-list-header" style={{ marginBottom: "16px" }}>
          <span className="patient-list-count">{listLoading ? "Loading..." : `${pagination.total || allDoctors.length} doctors`}</span>
          <button className="btn-refresh" onClick={() => fetchAllDoctors(currentPage)} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', border: 'none', background: 'transparent', color: 'var(--brand-action, var(--primary))', fontWeight: '600', fontSize: '13px' }}>
            <div style={{ transform: listLoading ? 'rotate(360deg)' : 'none', transition: 'transform 0.5s' }}>{Icons.logo}</div> Refresh
          </button>
        </div>

        {allDoctors.length > 0 ? (
          viewType === "grid" ? (
            <div className="doctor-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px" }}>
              {allDoctors.map((doc) => {
                const statusStyle = getStatusStyle(doc.status);
                return (
                  <div key={doc._id} className={`form-card ${selectedDoctor?._id === doc._id ? "selected" : ""}`} onClick={() => handleSelectDoctor(doc)} style={{ padding: "20px", marginBottom: "0", cursor: "pointer", position: "relative", border: selectedDoctor?._id === doc._id ? "2px solid var(--brand-action, var(--primary))" : "1.5px solid var(--border)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
                      <div className="patient-photo-card" style={{ width: "60px", height: "60px", margin: "0", background: "var(--primary-50)" }}>
                        <div style={{ fontSize: "20px", fontWeight: "700", color: "var(--brand-action, var(--primary))" }}>
                          {getInitials(doc.name)}
                        </div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-primary)" }}>{doc.name}</div>
                        <div style={{ fontSize: "12px", color: "var(--brand-action, var(--primary))", fontWeight: "600" }}>{doc.doctorId}</div>
                      </div>
                    </div>
                    <div style={{ marginTop: "15px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", color: "var(--text-secondary)" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        <span><strong>{doc.speciality}</strong></span>
                        <span style={{ opacity: 0.8 }}>{doc.experience} Yrs Exp</span>
                      </div>
                      <span style={{ 
                        padding: "2px 8px", 
                        borderRadius: "4px", 
                        background: statusStyle.bg,
                        color: statusStyle.color,
                        fontWeight: "600"
                      }}>
                        {doc.status}
                      </span>
                    </div>

                    <div style={{ marginTop: "12px", background: "var(--surface)", borderRadius: "8px", padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600" }}>PENDING PAYOUT</span>
                        <strong style={{ fontSize: "14px", color: doc.pendingPayout > 0 ? "var(--danger)" : "var(--success)" }}>₹{doc.pendingPayout || 0}</strong>
                    </div>
                    
                    <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--border-light)", fontSize: "10px", color: "var(--text-muted)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span>Clinic: {doc.clinicName || "Private"}</span>
                      {(canEditDoctors || canDeleteDoctors || selectedDoctor?._id === doc._id) && (
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        {selectedDoctor?._id === doc._id && <span style={{ color: "var(--brand-action, var(--primary))", fontWeight: "700" }}>SELECTED</span>}
                        {canEditDoctors && (
                        <button 
                          title="Edit"
                          style={{ border: "none", background: "transparent", color: "var(--text-muted)", cursor: "pointer", padding: "4px", borderRadius: "6px", display: "flex", alignItems: "center", transition: "all 0.2s" }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--brand-action, var(--primary))"; e.currentTarget.style.background = "var(--primary-50)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.background = "transparent"; }}
                          onClick={(e) => { e.stopPropagation(); router.push(`/doctors/edit/${doc._id}`); }}
                        >
                          {Icons.edit}
                        </button>
                        )}
                        {canDeleteDoctors && (
                        <button 
                          title="Delete"
                          style={{ border: "none", background: "transparent", color: "var(--text-muted)", cursor: "pointer", padding: "4px", borderRadius: "6px", display: "flex", alignItems: "center", transition: "all 0.2s" }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = "#e11d48"; e.currentTarget.style.background = "#fff1f2"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.background = "transparent"; }}
                          onClick={(e) => openDeleteModal(doc, e)}
                        >
                          {Icons.trash}
                        </button>
                        )}
                      </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="form-card" style={{ padding: "0", overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
                    <th style={{ padding: "12px 20px", textAlign: "left", color: "var(--text-secondary)", fontWeight: "600" }}>Doctor Details</th>
                    <th style={{ padding: "12px 20px", textAlign: "left", color: "var(--text-secondary)", fontWeight: "600" }}>speciality</th>
                    <th style={{ padding: "12px 20px", textAlign: "left", color: "var(--text-secondary)", fontWeight: "600" }}>Experience</th>
                    <th style={{ padding: "12px 20px", textAlign: "left", color: "var(--text-secondary)", fontWeight: "600" }}>Pending Payout</th>
                    <th style={{ padding: "12px 20px", textAlign: "left", color: "var(--text-secondary)", fontWeight: "600" }}>Status</th>
                    <th style={{ padding: "12px 20px", textAlign: "center", color: "var(--text-secondary)", fontWeight: "600" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allDoctors.map((doc) => {
                    const statusStyle = getStatusStyle(doc.status);
                    return (
                      <tr 
                        key={doc._id} 
                        onClick={() => handleSelectDoctor(doc)}
                        style={{ 
                          borderBottom: "1px solid var(--border-light)", 
                          cursor: "pointer",
                          background: selectedDoctor?._id === doc._id ? "var(--primary-50)" : "transparent",
                          transition: "background 0.2s"
                        }}
                      >
                        <td style={{ padding: "12px 20px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <div style={{ 
                              width: "36px", 
                              height: "36px", 
                              borderRadius: "10px", 
                              background: "var(--primary-50)", 
                              display: "flex", 
                              alignItems: "center", 
                              justifyContent: "center",
                              fontSize: "13px",
                              fontWeight: "700",
                              color: "var(--brand-action, var(--primary))"
                            }}>
                              {getInitials(doc.name)}
                            </div>
                            <div>
                              <div style={{ fontWeight: "600", color: "var(--text-primary)" }}>{doc.name}</div>
                              <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>ID: {doc.doctorId}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "12px 20px", color: "var(--text-secondary)" }}>{doc.speciality}</td>
                        <td style={{ padding: "12px 20px", color: "var(--text-secondary)" }}>{doc.experience} Yrs</td>
                        <td style={{ padding: "12px 20px" }}>
                          <strong style={{ color: doc.pendingPayout > 0 ? "var(--danger)" : "var(--text-muted)" }}>₹{doc.pendingPayout || 0}</strong>
                        </td>
                        <td style={{ padding: "12px 20px" }}>
                          <span style={{ 
                            padding: "2px 8px", 
                            borderRadius: "4px", 
                            fontSize: "11px",
                            background: statusStyle.bg,
                            color: statusStyle.color,
                            fontWeight: "600"
                          }}>
                            {doc.status}
                          </span>
                        </td>
                        <td style={{ padding: "12px 20px", textAlign: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                            {canEditDoctors && (
                            <button 
                              title="Edit"
                              style={{ border: "none", background: "transparent", color: "var(--text-muted)", cursor: "pointer", padding: "4px", borderRadius: "6px", display: "flex", alignItems: "center", transition: "all 0.2s" }}
                              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--brand-action, var(--primary))"; e.currentTarget.style.background = "var(--primary-50)"; }}
                              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.background = "transparent"; }}
                              onClick={(e) => { e.stopPropagation(); router.push(`/doctors/edit/${doc._id}`); }}
                            >
                              {Icons.edit}
                            </button>
                            )}
                            {canDeleteDoctors && (
                            <button 
                              title="Delete"
                              style={{ border: "none", background: "transparent", color: "var(--text-muted)", cursor: "pointer", padding: "4px", borderRadius: "6px", display: "flex", alignItems: "center", transition: "all 0.2s" }}
                              onMouseEnter={(e) => { e.currentTarget.style.color = "#e11d48"; e.currentTarget.style.background = "#fff1f2"; }}
                              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.background = "transparent"; }}
                              onClick={(e) => openDeleteModal(doc, e)}
                            >
                              {Icons.trash}
                            </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <div style={{ textAlign: "center", padding: "60px", background: "#fff", borderRadius: "16px", border: "1px solid var(--border)" }}>
            <div style={{ fontSize: "32px", color: "var(--text-muted)", marginBottom: "12px" }}>{Icons.search}</div>
            <h5 style={{ color: "var(--text-primary)" }}>No doctors found</h5>
            <p style={{ color: "var(--text-muted)" }}>Try searching for a different name or speciality.</p>
          </div>
        )}
        <PaginationControls pagination={pagination} loading={listLoading} onPageChange={setCurrentPage} />
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModal.open && (
        <>
          <div 
            style={{ 
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", 
              backdropFilter: "blur(4px)", zIndex: 1000,
              animation: "fadeIn 0.2s ease"
            }} 
            onClick={closeDeleteModal} 
          />
          <div style={{ 
            position: "fixed", top: "50%", left: "50%", 
            transform: "translate(-50%, -50%)", 
            background: "#fff", borderRadius: "16px", 
            padding: "32px", width: "420px", maxWidth: "90vw",
            boxShadow: "0 20px 60px rgba(0,0,0,0.15)", 
            zIndex: 1001,
            animation: "slideUp 0.25s ease"
          }}>
            <div style={{ textAlign: "center", marginBottom: "20px" }}>
              <div style={{ 
                width: "56px", height: "56px", borderRadius: "14px", 
                background: "#fff1f2", display: "flex", alignItems: "center", 
                justifyContent: "center", margin: "0 auto 16px", color: "#e11d48" 
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" />
                </svg>
              </div>
              <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-primary)", margin: "0 0 8px" }}>Delete Doctor?</h3>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: "1.5", margin: 0 }}>
                Are you sure you want to delete <strong>{deleteModal.doctor?.name}</strong> ({deleteModal.doctor?.doctorId})? This action cannot be undone.
              </p>
            </div>
            {actionError && (
              <p style={{ color: "#e11d48", fontSize: "12px", textAlign: "center", marginBottom: "12px", fontWeight: "600" }}>{actionError}</p>
            )}
            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={() => { closeDeleteModal(); setActionError(""); }}
                style={{ 
                  flex: 1, height: "42px", border: "1.5px solid var(--border)", 
                  borderRadius: "10px", background: "#fff", color: "var(--text-primary)",
                  cursor: "pointer", fontWeight: "600", fontSize: "13px",
                  transition: "all 0.2s"
                }}
              >
                Cancel
              </button>
              <button 
                onClick={handleDelete}
                disabled={deleting}
                style={{ 
                  flex: 1, height: "42px", border: "none", 
                  borderRadius: "10px", background: "#e11d48", color: "#fff",
                  cursor: deleting ? "not-allowed" : "pointer", fontWeight: "600", fontSize: "13px",
                  opacity: deleting ? 0.7 : 1,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                  transition: "all 0.2s"
                }}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translate(-50%, -45%); }
          to { opacity: 1; transform: translate(-50%, -50%); }
        }
      `}</style>
    </div>
  );
}

function PaginationControls({ pagination, loading, onPageChange }) {
  if (!pagination || pagination.totalPages <= 1) return null;

  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", marginTop: "18px", flexWrap: "wrap" }}>
      <span style={{ color: "var(--text-muted)", fontSize: "13px", fontWeight: 600 }}>
        Page {pagination.page} of {pagination.totalPages}
      </span>
      <div style={{ display: "flex", gap: "8px" }}>
        <button type="button" className="btn-lims-secondary" disabled={loading || pagination.page <= 1} onClick={() => onPageChange(Math.max(1, pagination.page - 1))} style={{ height: "36px", padding: "0 12px" }}>Previous</button>
        <button type="button" className="btn-lims-secondary" disabled={loading || pagination.page >= pagination.totalPages} onClick={() => onPageChange(Math.min(pagination.totalPages, pagination.page + 1))} style={{ height: "36px", padding: "0 12px" }}>Next</button>
      </div>
    </div>
  );
}
