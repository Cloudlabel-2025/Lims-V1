"use client";
import { useCallback, useEffect, useState } from "react";
import { Icons } from "@/app/components/Icons";
import { money, formatDate, inputStyle } from "../_components/helpers";
import Field from "../_components/Field";
import Table from "../_components/Table";
import PaginationControls from "../_components/PaginationControls";
import DownloadDropdown from "../_components/DownloadDropdown";

function LedgerTable({ entries }) {
  const rows = entries.flatMap((entry) =>
    (entry.lines || []).map((line, index) => [
      index === 0 ? entry.entryNumber : "",
      index === 0 ? formatDate(entry.date) : "",
      line.accountId ? `${line.accountId.code} - ${line.accountId.name}` : "-",
      line.debit ? `Rs ${money(line.debit)}` : "-",
      line.credit ? `Rs ${money(line.credit)}` : "-",
      index === 0 ? entry.sourceType : "",
      index === 0 ? entry.description : "",
    ])
  );
  return <Table minWidth={900} headings={["Entry", "Date", "Account", "Debit", "Credit", "Source", "Description"]} rows={rows} empty="No journal entries found." />;
}

export default function LedgerPage() {
  const [entries, setEntries] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState({ sourceType: "all", accountId: "" });
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });

  async function fetchJson(url) {
    const response = await fetch(url, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const ledgerQuery = new URLSearchParams();
      if (filter.sourceType !== "all") ledgerQuery.set("sourceType", filter.sourceType);
      if (filter.accountId) ledgerQuery.set("accountId", filter.accountId);
      ledgerQuery.set("page", page);
      ledgerQuery.set("limit", "50");
      const [accountData, ledgerData] = await Promise.all([
        fetchJson("/api/accounting/accounts?page=1&limit=200"),
        fetchJson(`/api/accounting/journal-entries?${ledgerQuery.toString()}`),
      ]);
      setAccounts(accountData.accounts || []);
      setEntries(ledgerData.journalEntries || []);
      setPagination(ledgerData.pagination || { page, limit: 50, total: ledgerData.journalEntries?.length || 0, totalPages: 1 });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filter.accountId, filter.sourceType, page]);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div className="form-card" style={{ padding: 14, borderRadius: 8, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <Field label="Source">
          <select className="lims-input" value={filter.sourceType} onChange={(e) => { setFilter({ ...filter, sourceType: e.target.value }); setPage(1); }} style={inputStyle()}>
            {["all", "billing", "payment", "refund", "commission", "expense", "manual"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Account">
          <select className="lims-input" value={filter.accountId} onChange={(e) => { setFilter({ ...filter, accountId: e.target.value }); setPage(1); }} style={inputStyle()}>
            <option value="">All accounts</option>
            {accounts.map((a) => <option key={a._id} value={a._id}>{a.code} - {a.name}</option>)}
          </select>
        </Field>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <DownloadDropdown
          onDownload={async (format) => {
            const params = new URLSearchParams({ export: format });
            if (filter.sourceType !== "all") params.set("sourceType", filter.sourceType);
            if (filter.accountId) params.set("accountId", filter.accountId);
            const res = await fetch(`/api/accounting/journal-entries?${params}`, { credentials: "include" });
            if (!res.ok) throw new Error("Download failed");
            const blob = await res.blob();
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `ledger.${format}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(a.href);
          }}
        />
      </div>

      {error && <div style={{ padding: "10px 14px", borderRadius: 8, background: "#fef2f2", color: "#b91c1c", fontSize: 13, fontWeight: 700 }}>{error}</div>}

      {loading ? (
        <div className="form-card" style={{ padding: 28, borderRadius: 8 }}>Loading ledger...</div>
      ) : (
        <>
          <LedgerTable entries={entries} />
          <PaginationControls pagination={pagination} loading={loading} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
