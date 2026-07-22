"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icons } from "@/app/components/Icons";
import SuccessDialog from "@/app/components/SuccessDialog";
import { money, formatDate, inputStyle } from "../_components/helpers";
import StatCard from "../_components/StatCard";
import Badge from "../_components/Badge";
import Table from "../_components/Table";
import PaginationControls from "../_components/PaginationControls";
import Field from "../_components/Field";
import DownloadDropdown from "../_components/DownloadDropdown";

export default function CommissionsPage() {
  const router = useRouter();
  const [doctors, setDoctors] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [releasing, setReleasing] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [payoutPage, setPayoutPage] = useState(1);
  const [payoutPagination, setPayoutPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });
  const [exportingPending, setExportingPending] = useState(false);
  const [exportingHistory, setExportingHistory] = useState(false);

  async function fetchJson(url, options) {
    const res = await fetch(url, { cache: "no-store", ...options });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [doctorData, payoutData] = await Promise.all([
        fetchJson("/api/doctor?limit=200"),
        fetchJson(`/api/doctor/payout?page=${payoutPage}&limit=50`),
      ]);
      setDoctors(doctorData.doctors || []);
      setPayouts(payoutData.payouts || []);
      setPayoutPagination(payoutData.pagination || { page: payoutPage, limit: 50, total: 0, totalPages: 1 });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [payoutPage]);

  useEffect(() => { loadData(); }, [loadData]);

  const pendingDoctors = doctors.filter((d) => Number(d.pendingPayout || 0) > 0);
  const totalPending = pendingDoctors.reduce((s, d) => s + Number(d.pendingPayout || 0), 0);

  async function handleExportPending(format) {
    setExportingPending(true);
    try {
      const res = await fetch(`/api/accounting/reports/commissions?section=pending&export=${format}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Export failed");
      const ext = format === "xlsx" ? "xlsx" : format === "pdf" ? "pdf" : "csv";
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `commissions-pending.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setExportingPending(false);
    }
  }

  async function handleExportHistory(format) {
    setExportingHistory(true);
    try {
      const res = await fetch(`/api/accounting/reports/commissions?section=history&export=${format}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Export failed");
      const ext = format === "xlsx" ? "xlsx" : format === "pdf" ? "pdf" : "csv";
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `commissions-history.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setExportingHistory(false);
    }
  }

  async function handleRelease(doctorId, paymentMethod) {
    setReleasing(null);
    setError("");
    setSuccess("");
    try {
      const data = await fetchJson("/api/doctor/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doctorId, paymentMethod }),
      });
      setSuccess(`Payout of Rs ${money(data.amountCleared)} released successfully.`);
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="patients-page" style={{ paddingBottom: 40 }}>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 18, flexWrap: "wrap", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div className="page-header-icon" style={{ background: "var(--brand-surface, #e6f0fa)", color: "var(--brand-action, var(--primary))", padding: 12, borderRadius: 8 }}>
            {Icons.users}
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: 20, color: "var(--text-main)" }}>Doctor Commissions</h4>
            <small style={{ color: "var(--text-muted)" }}>Commission tracking and payout management</small>
          </div>
        </div>
        <button type="button" className="btn-lims-secondary" onClick={() => router.push("/accounts")} style={{ height: 38, padding: "0 14px" }}>
          {Icons.arrowLeft} Dashboard
        </button>
      </div>

      {error && <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 8, background: "#fef2f2", color: "#b91c1c", fontSize: 13, fontWeight: 800 }}>{error}</div>}
      <SuccessDialog message={success} onClose={() => setSuccess("")} title="Payout Released" />

      {loading ? (
        <div className="form-card" style={{ padding: 28, borderRadius: 8 }}>Loading...</div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 24 }}>
            <StatCard label="Doctors with Pending" value={String(pendingDoctors.length)} icon={Icons.users} />
            <StatCard label="Total Pending Payout" value={`Rs ${money(totalPending)}`} icon={Icons.wallet} />
          </div>

          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h5 style={{ margin: 0, fontSize: 15, color: "var(--text-main)" }}>Pending Payouts</h5>
              <DownloadDropdown onDownload={handleExportPending} disabled={exportingPending} label="Export Pending" />
            </div>
            <Table
              minWidth={700}
              headings={["Doctor", "ID", "Commission", "Pending Amount", "Action"]}
              empty="No pending payouts."
              rows={pendingDoctors.map((doc) => [
                doc.name,
                doc.doctorId || "-",
                `${doc.commission || 0}%`,
                `Rs ${money(doc.pendingPayout)}`,
                <button
                  key="release"
                  type="button"
                  className="btn-lims-primary"
                  onClick={() => setReleasing(doc)}
                  style={{ height: 30, padding: "0 9px", fontSize: 12 }}
                >
                  {Icons.wallet} Release
                </button>,
              ])}
            />
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h5 style={{ margin: 0, fontSize: 15, color: "var(--text-main)" }}>Payout History</h5>
              <DownloadDropdown onDownload={handleExportHistory} disabled={exportingHistory} label="Export History" />
            </div>
            <Table
              minWidth={750}
              headings={["Entry", "Date", "Doctor", "Amount", "Description"]}
              empty="No payouts yet."
              rows={payouts.map((p) => [
                p.entryNumber || "-",
                formatDate(p.date),
                p.doctor?.name || "-",
                `Rs ${money(p.amount)}`,
                p.description || "-",
              ])}
            />
            <PaginationControls pagination={payoutPagination} loading={loading} onPageChange={setPayoutPage} />
          </div>
        </>
      )}

      {releasing && !confirming && (
        <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "grid", placeItems: "center", zIndex: 1000 }} onClick={() => setReleasing(null)}>
          <div className="form-card" style={{ padding: 32, borderRadius: 14, maxWidth: 540, width: "95%", display: "grid", gap: 20 }} onClick={(e) => e.stopPropagation()}>
            <h5 style={{ margin: 0, fontSize: 17 }}>Release Payout</h5>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, background: "var(--surface, #f8fafc)", padding: 16, borderRadius: 8 }}>
              <div style={{ fontSize: 14, color: "var(--text-muted)" }}>
                Doctor<br />
                <strong style={{ color: "var(--text-primary)", fontSize: 15 }}>{releasing.name}</strong>
              </div>
              <div style={{ fontSize: 14, color: "var(--text-muted)", textAlign: "right" }}>
                Amount<br />
                <strong style={{ color: "var(--text-primary)", fontSize: 15 }}>Rs {money(releasing.pendingPayout)}</strong>
              </div>
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 2 }}>Select payment method</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <button type="button" className="btn-lims-primary" onClick={() => setConfirming({ doctorId: releasing._id, method: "cash", name: releasing.name, amount: releasing.pendingPayout })} style={{ height: 46, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "0 20" }}>
                {Icons.wallet} Cash
              </button>
              <button type="button" className="btn-lims-primary" onClick={() => setConfirming({ doctorId: releasing._id, method: "bank", name: releasing.name, amount: releasing.pendingPayout })} style={{ height: 46, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "0 20" }}>
                {Icons.list} Bank Transfer
              </button>
            </div>
            <button type="button" className="btn-lims-secondary" onClick={() => setReleasing(null)} style={{ height: 42, fontSize: 13 }}>Cancel</button>
          </div>
        </div>
      )}

      {confirming && (
        <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "grid", placeItems: "center", zIndex: 1100 }} onClick={() => setConfirming(null)}>
          <div className="form-card" style={{ padding: 28, borderRadius: 14, maxWidth: 420, width: "90%", display: "grid", gap: 16, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
              Confirm releasing <strong>Rs {money(confirming.amount)}</strong> payout to <strong>{confirming.name}</strong> via <strong>{confirming.method === "cash" ? "Cash" : "Bank Transfer"}</strong>?
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" className="btn-lims-secondary" onClick={() => setConfirming(null)} style={{ flex: 1, height: 40, fontSize: 13 }}>Cancel</button>
              <button type="button" className="btn-lims-primary" onClick={() => { const c = confirming; setConfirming(null); handleRelease(c.doctorId, c.method); }} style={{ flex: 1, height: 40, fontSize: 13 }}>
                Yes, Release
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
