"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icons } from "@/app/components/Icons";
import { money, formatDate, inputStyle } from "../_components/helpers";
import Badge from "../_components/Badge";
import Table from "../_components/Table";
import PaginationControls from "../_components/PaginationControls";
import Field from "../_components/Field";

const methodColors = {
  cash: ["#ecfdf5", "#047857"],
  card: ["#eff6ff", "#1d4ed8"],
  upi: ["#f0fdf4", "#15803d"],
  cheque: ["#fffbeb", "#b45309"],
  "corporate-credit": ["#f3e8ff", "#7c3aed"],
};

export default function ReceiptsPage() {
  const router = useRouter();
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [methodFilter, setMethodFilter] = useState("");

  const fetchReceipts = useCallback(async (p) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: p, limit: "20" });
      if (methodFilter) params.set("method", methodFilter);
      const res = await fetch(`/api/accounting/receipts?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setReceipts(data.receipts || []);
      setPagination(data.pagination || { page: p, limit: 20, total: 0, totalPages: 1 });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [methodFilter]);

  useEffect(() => { fetchReceipts(page); }, [page, fetchReceipts]);

  return (
    <div className="patients-page" style={{ paddingBottom: 40 }}>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 18, flexWrap: "wrap", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div className="page-header-icon" style={{ background: "var(--brand-surface, #e6f0fa)", color: "var(--brand-action, var(--primary))", padding: 12, borderRadius: 8 }}>
            {Icons.wallet}
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: 20, color: "var(--text-main)" }}>Payment Receipts</h4>
            <small style={{ color: "var(--text-muted)" }}>View all payment receipts</small>
          </div>
        </div>
        <button type="button" className="btn-lims-secondary" onClick={() => router.push("/accounts")} style={{ height: 38, padding: "0 14px" }}>
          {Icons.arrowLeft} Dashboard
        </button>
      </div>

      <div className="form-card" style={{ padding: 14, borderRadius: 8, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 18 }}>
        <Field label="Payment Method">
          <select className="lims-input" value={methodFilter} onChange={(e) => { setMethodFilter(e.target.value); setPage(1); }} style={inputStyle()}>
            <option value="">All methods</option>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="upi">UPI</option>
            <option value="cheque">Cheque</option>
            <option value="corporate-credit">Corporate Credit</option>
          </select>
        </Field>
      </div>

      {loading ? (
        <div className="form-card" style={{ padding: 28, borderRadius: 8 }}>Loading receipts...</div>
      ) : (
        <>
          <Table
            minWidth={800}
            headings={["Date", "Patient", "Invoice", "Amount", "Method", "Refunded", "Ref #"]}
            empty="No receipts found."
            rows={receipts.map((r) => {
              const [bg, color] = methodColors[r.method] || ["var(--surface)", "var(--text-secondary)"];
              return [
                formatDate(r.receivedAt),
                r.patientId?.name || "-",
                r.invoiceId?.billId || "-",
                `Rs ${money(r.amount)}`,
                <span key="method" style={{ background: bg, color, padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 800, textTransform: "capitalize" }}>{r.method}</span>,
                r.isRefunded ? <Badge tone="warn">Refunded</Badge> : <Badge tone="good">Clear</Badge>,
                r.journalEntryId ? `JE-${String(r.journalEntryId).slice(-6)}` : "-",
              ];
            })}
          />
          <PaginationControls pagination={pagination} loading={loading} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
