"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icons } from "@/app/components/Icons";
import { cachedJsonFetch } from "@/app/lib/use-current-user";
import { hasPermission } from "@/app/lib/client-rbac";
import { useCurrentUser } from "@/app/lib/use-current-user";

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
  const [mounted, setMounted] = useState(false);
  const [viewState, setViewState] = useState("grid");
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });
  const debounceRef = useRef(null);

  function buildQuery(page) {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", "50");
    if (searchQuery.trim()) params.set("search", searchQuery.trim());
    if (genderFilter) params.set("gender", genderFilter);
    if (ageMinFilter) params.set("ageMin", ageMinFilter);
    if (ageMaxFilter) params.set("ageMax", ageMaxFilter);
    return params.toString();
  }

  const fetchPatients = useCallback(async (page = 1) => {
    setListLoading(true);
    try {
      const { data } = await cachedJsonFetch(`/api/patient?${buildQuery(page)}`, { ttl: 15_000 });
      setAllPatients(Array.isArray(data) ? data : data.patients || []);
      setPagination(Array.isArray(data) ? { page: 1, limit: data.length, total: data.length, totalPages: 1 } : data.pagination || { page, limit: 50, total: 0, totalPages: 1 });
    } catch {
      setAllPatients([]);
      setPagination({ page, limit: 50, total: 0, totalPages: 1 });
    } finally {
      setListLoading(false);
    }
  }, [searchQuery, genderFilter, ageMinFilter, ageMaxFilter]);

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
      alert(err.message);
    }
  }, []);

  if (!mounted) return null;

  return (
    <div className="patients-page">
      <div className={`sidebar-overlay ${sidebarOpen ? "open" : ""}`} onClick={closeSidebar} />

      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <PatientSidebar patient={selectedPatient} onClose={closeSidebar} />
      </aside>

      <div
        className="page-header"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div className="page-header-icon">{Icons.users}</div>
          <div className="page-header-text">
            <h4>Patient Master List</h4>
            <small>{allPatients.length} patients registered</small>
          </div>
        </div>

        <div
          className="header-actions"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            flex: 1,
            justifyContent: "flex-end",
            minWidth: "300px",
          }}
        >
          <div
            style={{
              display: "flex",
              background: "var(--border-light)",
              padding: "4px",
              borderRadius: "10px",
              marginRight: "8px",
            }}
          >
            <button
              onClick={() => setViewState("grid")}
              style={{
                padding: "6px 10px",
                borderRadius: "8px",
                border: "none",
                background: viewState === "grid" ? "#fff" : "transparent",
                color: viewState === "grid" ? "var(--brand-action, var(--primary))" : "var(--text-muted)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "12px",
                fontWeight: "600",
                transition: "all 0.2s",
                boxShadow: viewState === "grid" ? "0 2px 4px rgba(0,0,0,0.05)" : "none",
              }}
            >
              {Icons.grid}
            </button>
            <button
              onClick={() => setViewState("list")}
              style={{
                padding: "6px 10px",
                borderRadius: "8px",
                border: "none",
                background: viewState === "list" ? "#fff" : "transparent",
                color: viewState === "list" ? "var(--brand-action, var(--primary))" : "var(--text-muted)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "12px",
                fontWeight: "600",
                transition: "all 0.2s",
                boxShadow: viewState === "list" ? "0 2px 4px rgba(0,0,0,0.05)" : "none",
              }}
            >
              {Icons.list}
            </button>
          </div>

          <div className="search-container" style={{ position: "relative", flex: 1, maxWidth: "320px" }}>
            <span
              style={{
                position: "absolute",
                left: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-muted)",
                fontSize: "14px",
              }}
            >
              {Icons.search}
            </span>
            <input
              type="text"
              className="lims-input"
              placeholder="Search patients..."
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setCurrentPage(1);
              }}
              style={{ paddingLeft: "36px", height: "40px", fontSize: "13px" }}
            />
          </div>

          <select
            className="lims-input"
            value={genderFilter}
            onChange={(e) => { setGenderFilter(e.target.value); setCurrentPage(1); }}
            style={{ height: "40px", fontSize: "12px", width: "100px" }}
          >
            <option value="">All Genders</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>

          <input
            type="number"
            className="lims-input"
            placeholder="Min Age"
            value={ageMinFilter}
            onChange={(e) => { setAgeMinFilter(e.target.value); setCurrentPage(1); }}
            style={{ height: "40px", fontSize: "12px", width: "80px" }}
            min="0"
          />

          <input
            type="number"
            className="lims-input"
            placeholder="Max Age"
            value={ageMaxFilter}
            onChange={(e) => { setAgeMaxFilter(e.target.value); setCurrentPage(1); }}
            style={{ height: "40px", fontSize: "12px", width: "80px" }}
            min="0"
          />

          {canCreatePatient && (
          <button
            className="btn-lims-primary"
            onClick={() => router.push("/patients/register")}
            style={{ height: "40px", padding: "0 16px", fontSize: "13px", whiteSpace: "nowrap" }}
          >
            {Icons.plus} Create New Patient
          </button>
          )}
        </div>
      </div>

      <div className="patient-list-container">
        <div className="patient-list-header" style={{ marginBottom: "16px" }}>
          <span className="patient-list-count">
            {listLoading ? "Loading..." : `${pagination.total || allPatients.length} patients`}
          </span>
          <button
            className="btn-refresh"
            onClick={() => fetchPatients(currentPage)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              cursor: "pointer",
              border: "none",
              background: "transparent",
              color: "var(--brand-action, var(--primary))",
              fontWeight: "600",
              fontSize: "13px",
            }}
          >
            <div
              style={{
                transform: listLoading ? "rotate(360deg)" : "none",
                transition: "transform 0.5s",
              }}
            >
              {Icons.logo}
            </div>
            Refresh
          </button>
        </div>

        {!listLoading && allPatients.length === 0 ? (
          <div className="patient-list-empty">
            {Icons.noResults}
            <div className="patient-list-empty-title">No patients yet</div>
            {canCreatePatient && (
            <button className="btn-lims-primary" onClick={() => router.push("/patients/register")}>
              Register First Patient
            </button>
            )}
          </div>
        ) : viewState === "grid" ? (
          <PatientGrid
            patients={allPatients}
            selectedPatientId={selectedPatient?._id}
            onSelectPatient={handleSelectPatient}
            onEditPatient={goToEditPatient}
            onDeletePatient={canDeletePatient ? deletePatient : null}
          />
        ) : (
          <PatientTable
            patients={allPatients}
            selectedPatientId={selectedPatient?._id}
            onSelectPatient={handleSelectPatient}
            onEditPatient={goToEditPatient}
            onDeletePatient={canDeletePatient ? deletePatient : null}
          />
        )}
        <PaginationControls pagination={pagination} loading={listLoading} onPageChange={setCurrentPage} />
      </div>
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
