"use client";

import { useCallback, useEffect, useState } from "react";
import { Icons } from "@/app/components/Icons";
import SuccessDialog from "@/app/components/SuccessDialog";
import { hasPermission } from "@/app/lib/client-rbac";
import { cachedJsonFetch, clearCachedApi, useCurrentUser } from "@/app/lib/use-current-user";

export default function SamplesPage() {
  const user = useCurrentUser();
  const [samples, setSamples] = useState([]);
  const [status, setStatus] = useState("all");
  const [collectorName, setCollectorName] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const canCollectSamples = hasPermission(user, "samples.collect");
  const canUpdateSamples = hasPermission(user, "samples.update");
  const canRejectSamples = hasPermission(user, "samples.reject");
  const canActOnSamples = canCollectSamples || canUpdateSamples || canRejectSamples;
  const canViewSamples = hasPermission(user, "samples.view");

  async function printLabel(sampleId) {
    try {
      const resp = await fetch(`/api/samples/${sampleId}/barcode`, { credentials: "include" });
      const data = await resp.json();
      if (!resp.ok) { setError(data.error || "Unable to fetch label data"); return; }
      const printWin = window.open("", "_blank", "width=400,height=300");
      if (!printWin) { setError("Popup blocked. Please allow popups for this site."); return; }
      printWin.document.write(`
        <html><head><title>Sample Label</title>
        <style>
          body { font-family: monospace; text-align: center; padding: 20px; }
          .label { border: 2px solid #000; padding: 16px; display: inline-block; }
          h2 { margin: 4px 0; } p { margin: 2px 0; }
          @media print { body { padding: 0; } }
        </style></head><body>
        <div class="label">
          <h2>${data.sampleId}</h2>
          <p><strong>${data.barcode || ""}</strong></p>
          <p>${data.patientName || ""}${data.patientId ? ` (${data.patientId})` : ""}</p>
          <p>${data.type || ""}</p>
          <p>${data.collectedAt ? new Date(data.collectedAt).toLocaleDateString() : ""}</p>
        </div>
        <p style="margin-top:20px"><button onclick="window.print()">Print</button></p>
        </body></html>
      `);
      printWin.document.close();
    } catch { setError("Failed to load label data"); }
  }

  const loadSamples = useCallback(async (nextStatus = status) => {
    setLoading(true);
    setError("");
    try {
      const { response, data } = await cachedJsonFetch(`/api/samples?status=${nextStatus}`, { ttl: 10_000 });
      if (!response.ok) throw new Error(data.error || "Unable to load samples");
      setSamples(data.samples || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    loadSamples(status);
  }, [status, loadSamples]);

  async function updateSample(sampleId, action) {
    setUpdatingId(sampleId);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`/api/samples/${sampleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action,
          collectorName,
          rejectionReason,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.details || "Unable to update sample");

      clearCachedApi(`/api/samples?status=${status}`);
      clearCachedApi("/api/samples?status=all");
      clearCachedApi("/api/reports");
      clearCachedApi("/api/dashboard/stats");
      setSamples((current) =>
        current.map((sample) => (sample._id === sampleId ? data.sample : sample))
      );
      setRejectionReason("");
      const actionLabel = {
        collect: "collected",
        processing: "moved to processing",
        reject: "rejected",
      }[action] || "updated";
      setSuccess(`Sample ${data.sample?.sampleId || ""} ${actionLabel} successfully.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingId("");
    }
  }

  return (
    <div className="module-page">
      <div className="module-header">
        <div>
          <p className="module-kicker">Sample Workflow</p>
          <h1>Samples</h1>
          <span>Collect, process, reject, and track samples before result entry.</span>
        </div>
        <button className="dash-btn-secondary" type="button" onClick={() => loadSamples()}>
          {Icons.refresh} Refresh
        </button>
      </div>

      {error && <div className="module-alert">{error}</div>}
      <SuccessDialog message={success} onClose={() => setSuccess("")} />

      <section className="module-panel">
        <div className="sample-toolbar">
          <label>
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="collected">Collected</option>
              <option value="processing">Processing</option>
              <option value="rejected">Rejected</option>
              <option value="reported">Reported</option>
            </select>
          </label>
          {canCollectSamples && (
            <label>
              Collector
              <input value={collectorName} onChange={(e) => setCollectorName(e.target.value)} placeholder="Enter collector name" />
            </label>
          )}
          {canRejectSamples && (
            <label>
              Rejection Reason
              <input value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Enter rejection reason" />
            </label>
          )}
        </div>

        {loading ? (
          <p className="developer-empty">Loading samples...</p>
        ) : samples.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 20px", color: "var(--text-muted)" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🧪</div>
            <p style={{ fontWeight: 600, marginBottom: 4 }}>
              {status === "all" ? "No samples found" : `No ${status} samples`}
            </p>
            <p style={{ fontSize: 12 }}>Samples appear here once bills are created.</p>
          </div>
        ) : (
          <div className="sample-table">
            <div className="sample-table-head">
              <span>Sample</span>
              <span>Patient</span>
              <span>Test</span>
              <span>Bill</span>
              <span>Status</span>
              {canActOnSamples && <span>Actions</span>}
            </div>
            {samples.map((sample) => (
              <div key={sample._id} className={`sample-table-row ${sample.status}`}>
                <span>
                  <strong>{sample.sampleId}</strong>
                  <small>{sample.barcode}</small>
                </span>
                <span>{sample.patient?.name}<small>{sample.patient?.patientId}</small></span>
                <span>{sample.testSnapshot?.name}<small>{sample.testSnapshot?.sampleType || "-"}</small></span>
                <span>{sample.billingRecord?.billId}<small>{sample.billingRecord?.priority}</small></span>
                <span><em>{sample.status}</em></span>
                {canActOnSamples && (
                  <span className="sample-actions">
                    {canViewSamples && (
                      <button disabled={updatingId === sample._id} onClick={() => printLabel(sample._id)}>Label</button>
                    )}
                    {canCollectSamples && (
                      <button disabled={updatingId === sample._id || sample.status !== "pending"} onClick={() => updateSample(sample._id, "collect")}>Collect</button>
                    )}
                    {canUpdateSamples && (
                      <button disabled={updatingId === sample._id || !["collected"].includes(sample.status)} onClick={() => updateSample(sample._id, "processing")}>Process</button>
                    )}
                    {canRejectSamples && (
                      <button disabled={updatingId === sample._id || sample.status === "reported"} onClick={() => updateSample(sample._id, "reject")}>Reject</button>
                    )}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
