"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icons } from "@/app/components/Icons";
import { cachedJsonFetch, useCurrentUser, useTenantShell } from "@/app/lib/use-current-user";
import { hasPermission } from "@/app/lib/client-rbac";

const PatientSidebar = dynamic(() => import("./PatientSidebar"), {
  ssr: false,
  loading: () => null,
});
const PatientGrid = dynamic(() => import("./PatientGrid"), {
  ssr: false,
  loading: () => null,
});
const PatientTable = dynamic(() => import("./PatientTable"), {
  ssr: false,
  loading: () => null,
});

export default function PatientList() {
  const router = useRouter();
  const user = useCurrentUser();
  const { theme } = useTenantShell() || {};
  const canCreatePatient = hasPermission(user, "patients.register");
  const canDeletePatient = hasPermission(user, "patients.delete");
  const [searchQuery, setSearchQuery] = useState("");
  const [genderFilter, setGenderFilter] = useState("");
  const [ageMinFilter, setAgeMinFilter] = useState("");
  const [ageMaxFilter, setAgeMaxFilter] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [allPatients, setAllPatients] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [mounted, setMounted] = useState(false);
  const [viewState, setViewState] = useState("grid");
  const [tabFilter, setTabFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const debounceRef = useRef(null);

  const buildQuery = useCallback((page) => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", "15");
    if (searchQuery.trim()) params.set("search", searchQuery.trim());
    if (genderFilter) params.set("gender", genderFilter);
    if (ageMinFilter) params.set("ageMin", ageMinFilter);
    if (ageMaxFilter) params.set("ageMax", ageMaxFilter);
    if (tabFilter === "referrals") params.set("refDoctorOnly", "true");
    return params.toString();
  }, [searchQuery, genderFilter, ageMinFilter, ageMaxFilter, tabFilter]);

  const fetchPatients = useCallback(async (page = 1) => {
    setListLoading(true);
    try {
      const { data } = await cachedJsonFetch(`/api/patient?${buildQuery(page)}`, { ttl: 15_000 });
      setAllPatients(Array.isArray(data) ? data : data.patients || []);
      setPagination(Array.isArray(data) ? { page: 1, limit: data.length, total: data.length, totalPages: 1 } : data.pagination || { page, limit: 15, total: 0, totalPages: 1 });
    } catch {
      setAllPatients([]);
      setPagination({ page, limit: 15, total: 0, totalPages: 1 });
    } finally {
      setListLoading(false);
    }
  }, [buildQuery]);

  useEffect(() => {
    setMounted(true);
    fetchPatients(1);
  }, [fetchPatients]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!mounted) return;

    if (searchQuery.trim()) {
      debounceRef.current = setTimeout(() => fetchPatients(currentPage), 350);
    } else {
      fetchPatients(currentPage);
    }
    return () => clearTimeout(debounceRef.current);
  }, [currentPage, fetchPatients, mounted, searchQuery, genderFilter, ageMinFilter, ageMaxFilter]);

  const handleSelectPatient = useCallback((patient) => {
    setSelectedPatient(patient);
    setSidebarOpen(true);
    setSearchQuery("");
  }, []);

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
    setTimeout(() => setSelectedPatient(null), 400);
  }, []);

  const goToEditPatient = useCallback(
    (patientId) => {
      router.push(`/patients/edit/${patientId}`);
    },
    [router]
  );

  const handleProcessBill = useCallback((patientId) => {
    router.push(`/billing?patientId=${patientId}`);
  }, [router]);

  const deletePatient = useCallback(async (patientId) => {
    try {
      const res = await fetch(`/api/patient/${patientId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to delete patient");
      setAllPatients((prev) => prev.filter((p) => p._id !== patientId));
    } catch (err) {
      setStatus(err.message);
    }
  }, []);

  const hasActiveFilters = Boolean(searchQuery.trim() || genderFilter || ageMinFilter || ageMaxFilter || tabFilter !== "all");

  if (!mounted) return null;

  return (
    <div className="patients-page">
      <div className={`sidebar-overlay ${sidebarOpen ? "open" : ""}`} onClick={closeSidebar} />

      <aside className={`sidebar patient-detail-shell ${sidebarOpen ? "open" : ""}`} aria-label="Patient details">
        <PatientSidebar patient={selectedPatient} onClose={closeSidebar} />
      </aside>

      {status && (
        <div className="lims-alert danger" role="alert" style={{ marginBottom: "16px" }}>
          <span>{status}</span>
          <button className="lims-alert-close" onClick={() => setStatus("")}>×</button>
        </div>
      )}

      <div style={{
        display: "inline-flex",
        background: "rgba(241, 245, 249, 0.8)",
        backdropFilter: "blur(8px)",
        padding: "4px",
        borderRadius: "12px",
        border: "1.5px solid #edf2f7",
        gap: "4px",
        marginBottom: "20px"
      }}>
        <button
          type="button"
          onClick={() => { setTabFilter("all"); setCurrentPage(1); }}
          style={{
            fontSize: "13px",
            height: "36px",
            padding: "0 16px",
            borderRadius: "10px",
            border: "none",
            background: tabFilter === "all" ? "#fff" : "transparent",
            color: tabFilter === "all" ? "var(--primary-dark)" : "#64748b",
            fontWeight: "700",
            cursor: "pointer",
            boxShadow: tabFilter === "all" ? "0 2px 8px rgba(15, 23, 42, 0.05)" : "none",
            transition: "all 0.2s ease",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          👥 All Patients
        </button>
        <button
          type="button"
          onClick={() => { setTabFilter("referrals"); setCurrentPage(1); }}
          style={{
            fontSize: "13px",
            height: "36px",
            padding: "0 16px",
            borderRadius: "10px",
            border: "none",
            background: tabFilter === "referrals" ? "#fff" : "transparent",
            color: tabFilter === "referrals" ? "var(--primary-dark)" : "#64748b",
            fontWeight: "700",
            cursor: "pointer",
            boxShadow: tabFilter === "referrals" ? "0 2px 8px rgba(15, 23, 42, 0.05)" : "none",
            transition: "all 0.2s ease",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          👨‍⚕️ Doctor Referrals
        </button>
      </div>

      <div className="page-header patient-directory-header">
        <div className="patient-directory-heading" style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div className="page-header-icon">{Icons.users}</div>
          <div className="page-header-text">
            <span className="module-kicker">Patient management</span>
            <h4>{tabFilter === "referrals" ? "Doctor Referral Patients" : "Patients"}</h4>
            <small>{pagination.total || allPatients.length} registered patient records</small>
          </div>
        </div>

        <div className="header-actions">
          <div className="patient-view-toggle">
            <button
              type="button"
              aria-label="Grid view"
              aria-pressed={viewState === "grid"}
              onClick={() => setViewState("grid")}
            >
              {Icons.grid}
            </button>
            <button
              type="button"
              aria-label="Table view"
              aria-pressed={viewState === "list"}
              onClick={() => setViewState("list")}
            >
              {Icons.list}
            </button>
          </div>

          <div className="search-container patient-directory-search" style={{ position: "relative" }}>
            <span
              style={{
                position: "absolute",
                left: "14px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "#94a3b8",
                fontSize: "14px",
                display: "grid",
                placeItems: "center"
              }}
            >
              {Icons.search}
            </span>
            <input
              type="text"
              className="lims-input"
              placeholder="Search by name, patient ID or phone..."
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setCurrentPage(1);
              }}
              style={{ paddingLeft: "38px" }}
            />
          </div>

          <select
            className="lims-input patient-directory-gender"
            value={genderFilter}
            onChange={(e) => { setGenderFilter(e.target.value); setCurrentPage(1); }}
          >
            <option value="">All genders</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>

          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            className="lims-input patient-directory-age-min"
            placeholder="Min Age"
            value={ageMinFilter}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "" || /^[0-9]+$/.test(val)) {
                const num = Number(val);
                if (val === "" || (num >= 0 && num <= 120)) {
                  setAgeMinFilter(val);
                  setCurrentPage(1);
                }
              }
            }}
            maxLength={3}
          />

          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            className="lims-input patient-directory-age-max"
            placeholder="Max Age"
            value={ageMaxFilter}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "" || /^[0-9]+$/.test(val)) {
                const num = Number(val);
                if (val === "" || (num >= 0 && num <= 120)) {
                  setAgeMaxFilter(val);
                  setCurrentPage(1);
                }
              }
            }}
            maxLength={3}
          />

          {hasActiveFilters && (
            <button
              type="button"
              className="patient-filter-clear"
              onClick={() => {
                setSearchQuery("");
                setGenderFilter("");
                setAgeMinFilter("");
                setAgeMaxFilter("");
                setTabFilter("all");
                setCurrentPage(1);
              }}
            >
              Clear filters
            </button>
          )}

          {canCreatePatient && (
            <button
              className="btn-lims-primary"
              onClick={() => router.push("/patients/register")}
            >
              {Icons.plus} Register patient
            </button>
          )}
        </div>
      </div>

      <section className="patient-list-container patient-directory-panel">
        <div className="patient-list-header" style={{ marginBottom: "16px" }}>
          <div>
            <span className="patient-list-count">{tabFilter === "referrals" ? "Doctor Referral Patients" : "Patient directory"}</span>
            <small>{listLoading ? "Updating records..." : `Showing ${allPatients.length} of ${pagination.total || allPatients.length} patients`}</small>
          </div>
          <button
            className="dash-btn-secondary"
            onClick={() => fetchPatients(currentPage)}
            disabled={listLoading}
            style={{ height: 34, padding: "0 14px", fontSize: 12 }}
          >
            <span className={listLoading ? "icon-spin" : ""}>
              {Icons.refresh}
            </span>
            Refresh
          </button>
        </div>

        {listLoading && allPatients.length === 0 ? (
          <div className="patient-directory-loading" aria-label="Loading patient records">
            {[0, 1, 2, 3, 4, 5].map((item) => <div key={item} className="lims-skeleton" />)}
          </div>
        ) : !listLoading && allPatients.length === 0 ? (
          <div className="patient-list-empty">
            {Icons.noResults}
            {hasActiveFilters ? (
              <div className="patient-list-empty-title">No patient found</div>
            ) : (
              <>
                <div className="patient-list-empty-title">No patients yet</div>
                {canCreatePatient && (
                <button className="btn-lims-primary" onClick={() => router.push("/patients/register")}>
                  Register First Patient
                </button>
                )}
              </>
            )}
          </div>
        ) : viewState === "grid" ? (
          <PatientGrid
            patients={allPatients}
            selectedPatientId={selectedPatient?._id}
            onSelectPatient={handleSelectPatient}
            onEditPatient={goToEditPatient}
            onDeletePatient={canDeletePatient ? deletePatient : null}
            onProcessBill={handleProcessBill}
            subscription={theme}
          />
        ) : (
          <PatientTable
            patients={allPatients}
            selectedPatientId={selectedPatient?._id}
            onSelectPatient={handleSelectPatient}
            onEditPatient={goToEditPatient}
            onDeletePatient={canDeletePatient ? deletePatient : null}
            onProcessBill={handleProcessBill}
            subscription={theme}
          />
        )}
        <PaginationControls pagination={pagination} loading={listLoading} onPageChange={setCurrentPage} />
      </section>
    </div>
  );
}

function PaginationControls({ pagination, loading, onPageChange }) {
  if (!pagination || pagination.totalPages <= 1) return null;

  return (
    <div className="patient-directory-pagination" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", marginTop: "18px", flexWrap: "wrap" }}>
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
