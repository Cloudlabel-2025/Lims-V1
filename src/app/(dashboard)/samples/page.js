"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icons } from "@/app/components/Icons";
import { hasPermission } from "@/app/lib/client-rbac";
import { cachedJsonFetch, useCurrentUser } from "@/app/lib/use-current-user";

const STATUS_OPTIONS = ["all", "registered", "collected", "processing", "completed", "released", "rejected"];
const ACTIVE_WORKFLOW_STATUSES = ["registered", "collected", "processing"];
const TERMINAL_STATUSES = ["rejected", "released", "archived"];

const dateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDateTime(value) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : dateTimeFormatter.format(date);
}

function formatStatus(value) {
  return String(value || "Unknown").replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function SamplesLoading() {
  return (
    <div className="samples-workspace" aria-busy="true" aria-label="Loading samples">
      <div className="samples-loading-heading" />
      <div className="samples-loading-metrics">{[1, 2, 3, 4, 5].map((item) => <span key={item} />)}</div>
      <div className="samples-loading-table">{[1, 2, 3, 4, 5].map((item) => <span key={item} />)}</div>
    </div>
  );
}

export default function SamplesPage() {
  const router = useRouter();
  const user = useCurrentUser();
  const [samples, setSamples] = useState([]);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [samplePage, setSamplePage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [statusCounts, setStatusCounts] = useState({});
  const [rejecting, setRejecting] = useState({ id: null, reason: "", saving: false });
  const canCreateSamples = hasPermission(user, "samples.create");
  const canViewSamples = hasPermission(user, "samples.view");

  const filteredSamples = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return samples;
    return samples.filter((sample) => [
      sample.sampleId,
      sample.barcode,
      sample.patient?.name,
      sample.patient?.patientId,
      sample.testSnapshot?.name,
      sample.testSnapshot?.code,
      sample.batchId,
    ].some((value) => String(value || "").toLowerCase().includes(query)));
  }, [samples, search]);

  const totalSamples = Object.values(statusCounts).reduce((sum, count) => sum + Number(count || 0), 0);
  const inProgressCount = Number(statusCounts.collected || 0) + Number(statusCounts.processing || 0);
  const completedCount = Number(statusCounts.completed || 0) + Number(statusCounts.released || 0);

  const loadSamples = useCallback(async (page) => {
    const targetPage = page || 1;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ status, page: String(targetPage), limit: "20" });
      const { response, data } = await cachedJsonFetch(`/api/samples?${params}`, { ttl: 10_000 });
      if (!response.ok) throw new Error(data.error || "Unable to load samples");
      setSamples(data.samples || []);
      setPagination(data.pagination || { page: targetPage, limit: 20, total: data.samples?.length || 0, totalPages: 1 });
      setStatusCounts(data.statusCounts || {});
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    loadSamples(samplePage);
  }, [loadSamples, samplePage]);

  async function handleReject() {
    if (!rejecting.id || !rejecting.reason.trim()) return;
    const previousStatus = samples.find((sample) => sample._id === rejecting.id)?.status;
    setRejecting((current) => ({ ...current, saving: true }));
    try {
      const response = await fetch(`/api/samples/${rejecting.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", reason: rejecting.reason.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to reject sample");

      setSamples((current) => current.map((sample) => sample._id === rejecting.id ? { ...sample, status: "rejected", rejectionReason: rejecting.reason.trim() } : sample));
      setStatusCounts((current) => ({
        ...current,
        ...(previousStatus ? { [previousStatus]: Math.max(0, Number(current[previousStatus] || 0) - 1) } : {}),
        rejected: Number(current.rejected || 0) + 1,
      }));
      setRejecting({ id: null, reason: "", saving: false });
    } catch (requestError) {
      setError(requestError.message || "Network error");
      setRejecting((current) => ({ ...current, saving: false }));
    }
  }

  if (loading && !samples.length) return <SamplesLoading />;

  return (
    <div className="samples-workspace">
      <header className="samples-heading">
        <div>
          <p>Specimen operations</p>
          <h1>Samples</h1>
          <span>Track every specimen from registration through collection, processing, completion, and release.</span>
        </div>
        <div className="samples-heading-actions">
          <span className="samples-system-state"><i /> Workflow active</span>
          <button className="dash-btn-secondary" type="button" onClick={() => loadSamples(samplePage)} disabled={loading}><span className={loading ? "icon-spin" : ""}>{Icons.refresh}</span> Refresh</button>
          {canCreateSamples && <button className="dash-btn-primary" type="button" onClick={() => router.push("/samples/register")}>{Icons.plus} Register sample</button>}
        </div>
      </header>

      <section className="samples-metrics" aria-label="Sample workflow totals">
        <article><span>{Icons.vial}</span><div><small>Total samples</small><strong>{totalSamples}</strong><p>All specimen records</p></div></article>
        <article><span>{Icons.clock}</span><div><small>Awaiting collection</small><strong>{statusCounts.registered || 0}</strong><p>Registered specimens</p></div></article>
        <article><span>{Icons.activity}</span><div><small>In progress</small><strong>{inProgressCount}</strong><p>Collected or processing</p></div></article>
        <article><span>{Icons.report}</span><div><small>Completed</small><strong>{completedCount}</strong><p>Completed or released</p></div></article>
        <article className="danger"><span>{Icons.alertCircle}</span><div><small>Rejected</small><strong>{statusCounts.rejected || 0}</strong><p>Requires review</p></div></article>
      </section>

      {error && <div className="samples-alert" role="alert"><span>{Icons.alertCircle}</span><div><strong>Unable to complete the request</strong><p>{error}</p></div><button type="button" onClick={() => loadSamples(samplePage)}>{Icons.refresh} Retry</button></div>}

      <section className="samples-panel">
        <header className="samples-panel-header">
          <div><span>Specimen directory</span><h2>Workflow queue</h2><p>Prioritize active samples and preserve complete chain-of-custody context.</p></div>
          <em>{pagination.total} record{pagination.total === 1 ? "" : "s"}</em>
        </header>

        <nav className="samples-stage-tabs" aria-label="Filter samples by workflow stage">
          {STATUS_OPTIONS.map((option) => (
            <button key={option} type="button" className={`${status === option ? "active" : ""} ${option}`} onClick={() => { setStatus(option); setSamplePage(1); setSearch(""); }}>
              <strong>{option === "all" ? "All samples" : formatStatus(option)}</strong>
              <em>{option === "all" ? totalSamples : statusCounts[option] || 0}</em>
            </button>
          ))}
        </nav>

        <div className="samples-toolbar">
          <label className="samples-search"><span>{Icons.search}</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search this page by sample, patient, test, barcode, or batch…" /></label>
          <div><span>Showing <strong>{filteredSamples.length}</strong> of <strong>{samples.length}</strong> on this page</span>{search && <button type="button" onClick={() => setSearch("")}>Clear search</button>}</div>
        </div>

        {filteredSamples.length ? (
          <div className="samples-table-wrap">
            <div className="samples-table" role="table" aria-label="Samples workflow queue">
              <div className="samples-table-head" role="row">
                <span>Specimen</span><span>Patient</span><span>Investigation</span><span>Collection & custody</span><span>Workflow</span><span>Actions</span>
              </div>
              {filteredSamples.map((sample) => {
                const canProcess = ACTIVE_WORKFLOW_STATUSES.includes(sample.status);
                const canReject = !TERMINAL_STATUSES.includes(sample.status);
                const lastCustody = sample.custodyLog?.[sample.custodyLog.length - 1];
                const processLabel = sample.status === "registered" ? "Begin process" : sample.status === "processing" ? "Enter results" : "Continue";
                return (
                  <article key={sample._id} className={`samples-table-row status-${sample.status}`} role="row">
                    <div className="samples-specimen-cell" role="cell"><span>{Icons.vial}</span><div><strong>{sample.sampleId}</strong><code>{sample.barcode || "No barcode"}</code><small>Registered {formatDateTime(sample.createdAt)}</small></div></div>
                    <div className="samples-patient-cell" role="cell"><strong>{sample.patient?.name || "Unknown patient"}</strong><code>{sample.patient?.patientId || "No patient ID"}</code><small>{sample.patient?.age ?? "—"} years · {sample.patient?.gender || "Not specified"}</small></div>
                    <div className="samples-test-cell" role="cell"><strong>{sample.testSnapshot?.name || "Unknown test"}</strong><code>{sample.testSnapshot?.code || "No code"}</code><small>{sample.sampleType || sample.testSnapshot?.sampleType || "Sample type not set"}{sample.testSnapshot?.categoryName ? ` · ${sample.testSnapshot.categoryName}` : ""}</small></div>
                    <div className="samples-custody-cell" role="cell"><strong>{sample.collectionTime ? `Collected ${formatDateTime(sample.collectionTime)}` : "Collection pending"}</strong><small>Received: {formatDateTime(sample.receivedAt)}</small><small>{lastCustody ? `${lastCustody.handledBy} · ${formatDateTime(lastCustody.timestamp)}` : sample.receivedBy || "Custodian not recorded"}</small></div>
                    <div className="samples-status-cell" role="cell"><em className={sample.status}>{formatStatus(sample.status)}</em>{sample.billingRecord?.priority === "urgent" && <strong>Urgent</strong>}{sample.status === "rejected" && sample.rejectionReason && <p>{sample.rejectionReason}</p>}</div>
                    <div className="samples-row-actions" role="cell">
                      {canProcess && canViewSamples && <button type="button" className="primary" onClick={() => router.push(`/samples/wizard?sampleId=${sample._id}`)}>{Icons.chevronRight} {processLabel}</button>}
                      {canReject && canViewSamples && <button type="button" className="danger" onClick={() => setRejecting({ id: sample._id, reason: "", saving: false })}>{Icons.alertCircle} Reject</button>}
                      {!canProcess && !canReject && <span>Workflow closed</span>}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="samples-empty-state"><span>{search ? Icons.search : Icons.vial}</span><strong>{search ? "No matching samples" : status === "all" ? "No samples registered" : `No ${status} samples`}</strong><p>{search ? "Try a different patient, sample, barcode, or test value." : "New specimens will appear here when they are registered or generated from billing."}</p>{canCreateSamples && status === "all" && !search && <button type="button" className="dash-btn-primary" onClick={() => router.push("/samples/register")}>{Icons.plus} Register first sample</button>}</div>
        )}

        {pagination.totalPages > 1 && (
          <footer className="samples-pagination"><span>Page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages}</strong></span><div><button type="button" className="btn-lims-secondary" disabled={loading || pagination.page <= 1} onClick={() => setSamplePage(Math.max(1, pagination.page - 1))}>Previous</button><button type="button" className="btn-lims-secondary" disabled={loading || pagination.page >= pagination.totalPages} onClick={() => setSamplePage(Math.min(pagination.totalPages, pagination.page + 1))}>Next</button></div></footer>
        )}
      </section>

      {rejecting.id && (
        <div className="sample-reject-overlay" onClick={() => { if (!rejecting.saving) setRejecting({ id: null, reason: "", saving: false }); }} role="presentation">
          <section className="sample-reject-dialog" role="alertdialog" aria-modal="true" aria-labelledby="reject-sample-title" onClick={(event) => event.stopPropagation()}>
            <span>{Icons.alertCircle}</span>
            <div><small>Workflow exception</small><h2 id="reject-sample-title">Reject this sample?</h2><p>The sample will leave the active workflow. Record a clear reason for audit and recollection follow-up.</p></div>
            <label>Rejection reason<textarea value={rejecting.reason} onChange={(event) => setRejecting((current) => ({ ...current, reason: event.target.value }))} placeholder="Describe contamination, labeling issue, insufficient quantity, or another reason" maxLength={150} rows={4} autoFocus /><small>{rejecting.reason.length}/150 characters</small></label>
            <footer><button type="button" className="btn-lims-secondary" disabled={rejecting.saving} onClick={() => setRejecting({ id: null, reason: "", saving: false })}>Cancel</button><button type="button" className="samples-danger-action" disabled={rejecting.saving || !rejecting.reason.trim()} onClick={handleReject}>{rejecting.saving ? "Rejecting…" : "Confirm rejection"}</button></footer>
          </section>
        </div>
      )}
    </div>
  );
}
