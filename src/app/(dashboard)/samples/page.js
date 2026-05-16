"use client";

import { useCallback, useEffect, useState } from "react";
import { Icons } from "@/app/components/Icons";
import { hasPermission } from "@/app/lib/client-rbac";
import { useCurrentUser } from "@/app/lib/use-current-user";

export default function SamplesPage() {
  const user = useCurrentUser();
  const [samples, setSamples] = useState([]);
  const [status, setStatus] = useState("all");
  const [collectorName, setCollectorName] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState("");
  const [error, setError] = useState("");
  const canCollectSamples = hasPermission(user, "samples.collect");
  const canUpdateSamples = hasPermission(user, "samples.update");
  const canRejectSamples = hasPermission(user, "samples.reject");
  const canActOnSamples = canCollectSamples || canUpdateSamples || canRejectSamples;

  const loadSamples = useCallback(async (nextStatus = status) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/samples?status=${nextStatus}`, { credentials: "include" });
      const data = await response.json();
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

      setSamples((current) =>
        current.map((sample) => (sample._id === sampleId ? data.sample : sample))
      );
      setRejectionReason("");
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
          {Icons.logo} Refresh
        </button>
      </div>

      {error && <div className="module-alert">{error}</div>}

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
              <input value={collectorName} onChange={(e) => setCollectorName(e.target.value)} placeholder="Collector name" />
            </label>
          )}
          {canRejectSamples && (
            <label>
              Rejection Reason
              <input value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Required for reject" />
            </label>
          )}
        </div>

        {loading ? (
          <p className="developer-empty">Loading samples...</p>
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
