"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icons } from "@/app/components/Icons";
import { hasPermission } from "@/app/lib/client-rbac";
import { cachedJsonFetch, useCurrentUser } from "@/app/lib/use-current-user";

const STATUS_OPTIONS = ["all", "registered", "processing", "rejected"];

const statusColors = {
  registered: ["#f1f5f9", "#475569"],
  collected: ["#fff7ed", "#c2410c"],
  processing: ["#eff6ff", "#1d4ed8"],
  completed: ["#f0fdf4", "#15803d"],
  released: ["#ecfdf5", "#047857"],
  rejected: ["#fef2f2", "#dc2626"],
};

export default function SamplesPage() {
  const router = useRouter();
  const user = useCurrentUser();
  const [samples, setSamples] = useState([]);
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [samplePage, setSamplePage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [rejecting, setRejecting] = useState({ id: null, reason: "", saving: false });
  const canCreateSamples = hasPermission(user, "samples.create");
  const canViewSamples = hasPermission(user, "samples.view");

  const handleReject = async (sampleId) => {
    if (!rejecting.reason.trim()) return;
    setRejecting((prev) => ({ ...prev, saving: true }));
    try {
      const res = await fetch(`/api/samples/${sampleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", reason: rejecting.reason.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setSamples((prev) => prev.map((s) => (s._id === sampleId ? { ...s, status: "rejected", rejectionReason: rejecting.reason.trim() } : s)));
        setRejecting({ id: null, reason: "", saving: false });
      } else {
        setError(data.error || "Failed to reject sample");
        setRejecting((prev) => ({ ...prev, saving: false }));
      }
    } catch {
      setError("Network error");
      setRejecting((prev) => ({ ...prev, saving: false }));
    }
  };

  const loadSamples = useCallback(async (page) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ status });
      params.set("page", String(page || 1));
      params.set("limit", "20");
      const { response, data } = await cachedJsonFetch(`/api/samples?${params}`, { ttl: 10_000 });
      if (!response.ok) throw new Error(data.error || "Unable to load samples");
      setSamples(data.samples || []);
      setPagination(data.pagination || { page: page || 1, limit: 20, total: data.samples?.length || 0, totalPages: 1 });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    loadSamples(1);
  }, [loadSamples]);

  useEffect(() => {
    loadSamples(samplePage);
  }, [samplePage]);

  return (
    <div className="module-page">
      <div className="module-header">
        <div>
          <p className="module-kicker">Sample Workflow</p>
          <h1>Samples</h1>
          <span>Register, track, and process samples.</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {canCreateSamples && (
            <button className="dash-btn-primary" type="button" onClick={() => router.push("/samples/register")}>
              + Register Sample
            </button>
          )}
          <button className="dash-btn-secondary" type="button" onClick={() => loadSamples()}>
            {Icons.refresh} Refresh
          </button>
        </div>
      </div>

      {error && <div className="module-alert">{error}</div>}

      <section className="module-panel">
        <div className="sample-toolbar">
          <label>
            Status
            <select value={status} onChange={(e) => { setStatus(e.target.value); setSamplePage(1); }}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </label>
        </div>

        {loading ? (
          <p className="developer-empty">Loading samples...</p>
        ) : samples.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 20px", color: "var(--text-muted)" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>{Icons.vial}</div>
            <p style={{ fontWeight: 600, marginBottom: 4 }}>
              {status === "all" ? "No samples found" : `No ${status} samples`}
            </p>
            <p style={{ fontSize: 12 }}>Register a sample or create a bill to generate one.</p>
          </div>
        ) : (
          <div className="sample-table">
            <div className="sample-table-head">
              <span>Sample</span>
              <span>Patient</span>
              <span>Test</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            {samples.map((sample) => {
              const [bg, color] = statusColors[sample.status] || ["var(--surface)", "var(--text-secondary)"];
              const canProcess = ["registered", "collected", "processing"].includes(sample.status);
              const canReject = !["rejected", "released", "archived"].includes(sample.status);
              const isRejecting = rejecting.id === sample._id;
              return (
                <div key={sample._id} className={`sample-table-row ${sample.status}`}>
                  <span>
                    <strong>{sample.sampleId}</strong>
                    <small>{sample.barcode}</small>
                  </span>
                  <span>{sample.patient?.name}<small>{sample.patient?.patientId}</small></span>
                  <span>{sample.testSnapshot?.name}<small>{sample.testSnapshot?.sampleType || "-"}</small></span>
                  <span>
                    <span style={{ background: bg, color, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 800 }}>
                      {sample.status}
                    </span>
                    {sample.status === "rejected" && sample.rejectionReason && (
                      <div style={{ fontSize: 11, color: "#dc2626", marginTop: 4, maxWidth: 180, lineHeight: 1.3 }}>
                        {sample.rejectionReason}
                      </div>
                    )}
                  </span>
                  <span className="sample-actions">
                    {canProcess && canViewSamples && (
                      <button onClick={() => router.push(`/samples/wizard?sampleId=${sample._id}`)}>
                        Process
                      </button>
                    )}
                    {canReject && canViewSamples && !isRejecting && (
                      <button style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }} onClick={() => setRejecting({ id: sample._id, reason: "", saving: false })}>
                        Reject
                      </button>
                    )}
                    {isRejecting && (
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <input
                          className="lims-input"
                          placeholder="Reason for rejection"
                          value={rejecting.reason}
                          onChange={(e) => setRejecting((prev) => ({ ...prev, reason: e.target.value }))}
                          style={{ height: 30, width: 160, fontSize: 12, padding: "0 8px" }}
                          maxLength={150}
                          autoFocus
                        />
                        <button className="btn-lims-primary" style={{ height: 30, fontSize: 11, padding: "0 8px" }} disabled={rejecting.saving || !rejecting.reason.trim()} onClick={() => handleReject(sample._id)}>
                          {rejecting.saving ? "..." : "Confirm"}
                        </button>
                        <button className="btn-lims-secondary" style={{ height: 30, fontSize: 11, padding: "0 8px" }} disabled={rejecting.saving} onClick={() => setRejecting({ id: null, reason: "", saving: false })}>
                          Cancel
                        </button>
                      </div>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {pagination.totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginTop: 18, flexWrap: "wrap" }}>
          <span style={{ color: "var(--text-muted)", fontSize: 13, fontWeight: 600 }}>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn-lims-secondary" disabled={loading || pagination.page <= 1} onClick={() => setSamplePage(Math.max(1, pagination.page - 1))} style={{ height: 36, padding: "0 12px" }}>Previous</button>
            <button type="button" className="btn-lims-secondary" disabled={loading || pagination.page >= pagination.totalPages} onClick={() => setSamplePage(Math.min(pagination.totalPages, pagination.page + 1))} style={{ height: 36, padding: "0 12px" }}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
