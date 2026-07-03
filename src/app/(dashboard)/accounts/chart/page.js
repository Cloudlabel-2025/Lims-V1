"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icons } from "@/app/components/Icons";
import { money } from "../_components/helpers";
import StatCard from "../_components/StatCard";
import Badge from "../_components/Badge";
import Table from "../_components/Table";
import PaginationControls from "../_components/PaginationControls";

export default function ChartOfAccountsPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });

  const totals = accounts.reduce(
    (sum, account) => {
      sum[account.type] = (sum[account.type] || 0) + Number(account.balance || 0);
      return sum;
    },
    { asset: 0, liability: 0, revenue: 0, expense: 0 }
  );

  const fetchAccounts = useCallback(async (p) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/accounting/accounts?page=${p}&limit=20`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load accounts");
      setAccounts(data.accounts || []);
      setPagination(data.pagination || { page: p, limit: 20, total: 0, totalPages: 1 });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAccounts(page); }, [page, fetchAccounts]);

  async function deleteAccount(accountId) {
    if (!confirm("Delete this account? This action cannot be undone.")) return;
    try {
      const res = await fetch(`/api/accounting/accounts/${accountId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      await fetchAccounts(page);
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="patients-page" style={{ paddingBottom: 40 }}>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 18, flexWrap: "wrap", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div className="page-header-icon" style={{ background: "var(--brand-surface, #e6f0fa)", color: "var(--brand-action, var(--primary))", padding: 12, borderRadius: 8 }}>
            {Icons.grid}
          </div>
          <div>
            <h4 style={{ margin: 0 }}>Chart of Accounts</h4>
            <small style={{ color: "var(--text-muted)" }}>All accounts overview</small>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn-lims-secondary" onClick={() => router.push("/accounts")} style={{ height: 38, padding: "0 14px" }}>
            {Icons.arrowLeft} Dashboard
          </button>
          <button type="button" className="dash-btn-secondary" onClick={() => fetchAccounts(page)} disabled={loading} style={{ height: 38, padding: "0 14px" }}>
            {Icons.refresh} Refresh
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14, marginBottom: 18 }}>
        <StatCard label="Assets" value={`Rs ${money(totals.asset)}`} icon={Icons.barChart} />
        <StatCard label="Liabilities" value={`Rs ${money(totals.liability)}`} icon={Icons.list} />
        <StatCard label="Revenue" value={`Rs ${money(totals.revenue)}`} icon={Icons.activity} />
        <StatCard label="Expenses" value={`Rs ${money(totals.expense)}`} icon={Icons.flask} />
      </div>

      {loading ? (
        <div className="form-card" style={{ padding: 28, borderRadius: 8 }}>Loading accounts...</div>
      ) : (
        <>
          <Table
            minWidth={780}
            headings={["Code", "Name", "Type", "Subtype", "Balance", "System", "Action"]}
            empty="No accounts found."
            rows={accounts.map((account) => [
              account.code,
              account.name,
              account.type,
              account.subtype || "-",
              `Rs ${money(account.balance)}`,
              <Badge key="system" tone={account.isSystem ? "info" : "neutral"}>{account.isSystem ? "System" : "Custom"}</Badge>,
              account.isSystem ? "-" : <button key="delete" type="button" className="btn-icon-delete" onClick={() => deleteAccount(account._id)}>{Icons.trash}</button>,
            ])}
          />
          <PaginationControls pagination={pagination} loading={loading} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
