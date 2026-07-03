"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Icons } from "@/app/components/Icons";
import { hasPermission } from "@/app/lib/client-rbac";
import { cachedJsonFetch, clearCachedApi, useCurrentUser } from "@/app/lib/use-current-user";

const DoctorSidebar = dynamic(() => import("./DoctorSidebar"), { ssr: false, loading: () => null });
const DoctorGrid = dynamic(() => import("./DoctorGrid"), { ssr: false, loading: () => null });
const DoctorTable = dynamic(() => import("./DoctorTable"), { ssr: false, loading: () => null });

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
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
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
      const { data } = await cachedJsonFetch(`/api/doctor?page=${page}&limit=20`, { ttl: 15_000 });
      setAllDoctors(Array.isArray(data) ? data : data.doctors || []);
      setPagination(Array.isArray(data) ? { page: 1, limit: data.length, total: data.length, totalPages: 1 } : data.pagination || { page, limit: 20, total: 0, totalPages: 1 });
    } catch {
      setAllDoctors([]);
      setPagination({ page, limit: 20, total: 0, totalPages: 1 });
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
      const { data } = await cachedJsonFetch(`/api/doctor?search=${encodeURIComponent(query)}&page=${page}&limit=20`, { ttl: 5_000 });
      setAllDoctors(Array.isArray(data) ? data : data.doctors || []);
      setPagination(Array.isArray(data) ? { page: 1, limit: data.length, total: data.length, totalPages: 1 } : data.pagination || { page, limit: 20, total: 0, totalPages: 1 });
    } catch {
      setAllDoctors([]);
      setPagination({ page, limit: 20, total: 0, totalPages: 1 });
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
      const res = await fetch(`/api/doctor/payout?doctorId=${doctorId}&limit=20`);
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

      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        {selectedDoctor && (
          <DoctorSidebar
            doctor={selectedDoctor}
            onClose={closeSidebar}
            paying={paying}
            payoutConfirm={payoutConfirm}
            payoutMethod={payoutMethod}
            actionError={actionError}
            onPayoutConfirmChange={setPayoutConfirm}
            onPayoutMethodChange={setPayoutMethod}
            onActionErrorChange={setActionError}
            onPayout={handlePayout}
            onViewPayoutHistory={() => { loadPayoutHistory(selectedDoctor._id); setShowPayoutHistory(true); }}
            canEditDoctors={canEditDoctors}
            canDeleteDoctors={canDeleteDoctors}
            onEdit={() => { closeSidebar(); router.push(`/doctors/edit/${selectedDoctor._id}`); }}
            onDeleteClick={(doctor) => openDeleteModal(doctor)}
          />
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

          <button
            className="dash-btn-secondary"
            onClick={() => fetchAllDoctors(currentPage)}
            disabled={listLoading}
            style={{ height: 34, padding: "0 14px", fontSize: 12 }}
          >
            <span className={listLoading ? "icon-spin" : ""}>
              {Icons.refresh}
            </span>
            Refresh
          </button>

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
            <DoctorGrid
              doctors={allDoctors}
              selectedDoctorId={selectedDoctor?._id}
              onSelectDoctor={handleSelectDoctor}
              canEditDoctors={canEditDoctors}
              canDeleteDoctors={canDeleteDoctors}
              onEditDoctor={(id) => router.push(`/doctors/edit/${id}`)}
              onDeleteDoctor={(doc) => openDeleteModal(doc)}
            />
          ) : (
            <DoctorTable
              doctors={allDoctors}
              selectedDoctorId={selectedDoctor?._id}
              onSelectDoctor={handleSelectDoctor}
              canEditDoctors={canEditDoctors}
              canDeleteDoctors={canDeleteDoctors}
              onEditDoctor={(id) => router.push(`/doctors/edit/${id}`)}
              onDeleteDoctor={(doc) => openDeleteModal(doc)}
            />
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
