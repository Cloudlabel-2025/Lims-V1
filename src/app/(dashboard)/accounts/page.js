"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icons } from "@/app/components/Icons";
import { money, formatDate } from "./_components/helpers";
import StatCard from "./_components/StatCard";
import Badge from "./_components/Badge";
import Table from "./_components/Table";
import DownloadDropdown from "./_components/DownloadDropdown";

export default function AccountsDashboard() {
  const router = useRouter();
  const [accounts, setAccounts] = useState([]);
  const [recentBills, setRecentBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function fetchJson(url) {
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [accountData, billData] = await Promise.all([
        fetchJson("/api/accounting/accounts?page=1&limit=200"),
        fetchJson("/api/billing?page=1&limit=10"),
      ]);
      setAccounts(accountData.accounts || []);
      setRecentBills(billData.billingRecords || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const totals = accounts.reduce(
    (sum, account) => {
      sum[account.type] = (sum[account.type] || 0) + Number(account.balance || 0);
      return sum;
    },
    { asset: 0, liability: 0, equity: 0, revenue: 0, expense: 0 }
  );

  const statusColors = {
    paid: ["#ecfdf5", "#047857"],
    partial: ["#fffbeb", "#b45309"],
    unpaid: ["#fef2f2", "#b91c1c"],
    cancelled: ["var(--surface)", "var(--text-muted)"],
  };

  const navLinks = [
    { href: "/accounts/chart", label: "Chart of Accounts", icon: Icons.grid, desc: "Full chart with balances & delete" },
    { href: "/accounts/ledger", label: "Ledger", icon: Icons.list, desc: "Journal entries with filters" },
    { href: "/accounts/pl", label: "P&L Statement", icon: Icons.barChart, desc: "Profit & loss with date range" },
    { href: "/accounts/manual", label: "Manual Journal", icon: Icons.edit, desc: "Post double-entry journal" },
    { href: "/accounts/expenses", label: "Expenses", icon: Icons.activity, desc: "Record & manage expenses" },
    { href: "/accounts/commissions", label: "Commissions", icon: Icons.users, desc: "Doctor commission payouts" },
    { href: "/accounts/corporate", label: "Corporate Accounts", icon: Icons.users, desc: "Corporate client management" },
    { href: "/accounts/reports", label: "Reports", icon: Icons.report, desc: "Daily, weekly, monthly & P&L reports" },
  ];

  return (
    <div className="patients-page" style={{ paddingBottom: 40 }}>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 18, flexWrap: "wrap", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div className="page-header-icon" style={{ background: "var(--brand-surface, #e6f0fa)", color: "var(--brand-action, var(--primary))", padding: 12, borderRadius: 8 }}>
            {Icons.wallet}
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: 20, color: "var(--text-main)" }}>Accounts Dashboard</h4>
            <small style={{ color: "var(--text-muted)" }}>Financial overview at a glance</small>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="dash-btn-secondary" onClick={loadDashboard} style={{ height: 38, padding: "0 14px", borderRadius: 8 }}>
            {Icons.refresh} Refresh
          </button>
          <DownloadDropdown onDownload={async (format) => {
            const params = new URLSearchParams({ export: format });
            const res = await fetch(`/api/accounting/reports/dashboard?${params}`, { credentials: "include" });
            if (!res.ok) throw new Error("Download failed");
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `accounts-dashboard.${format === "xlsx" ? "xlsx" : format === "pdf" ? "pdf" : "csv"}`;
            a.click();
            URL.revokeObjectURL(url);
          }} disabled={loading} />
        </div>
      </div>

      {error && <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 8, background: "#fef2f2", color: "#b91c1c", fontSize: 13, fontWeight: 800 }}>{error}</div>}

      {loading ? (
        <div className="form-card" style={{ padding: 28, borderRadius: 8 }}>Loading dashboard...</div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14, marginBottom: 24 }}>
            <StatCard label="Assets" value={`Rs ${money(totals.asset)}`} icon={Icons.barChart} />
            <StatCard label="Liabilities" value={`Rs ${money(totals.liability)}`} icon={Icons.list} />
            <StatCard label="Revenue" value={`Rs ${money(totals.revenue)}`} icon={Icons.activity} />
            <StatCard label="Expenses" value={`Rs ${money(totals.expense)}`} icon={Icons.flask} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14, marginBottom: 24 }}>
            {navLinks.map((link) => (
              <button
                key={link.href}
                type="button"
                className="form-card"
                onClick={() => router.push(link.href)}
                style={{ padding: 16, borderRadius: 8, cursor: "pointer", textAlign: "left", border: "1px solid var(--border)", background: "var(--card-bg)", display: "flex", alignItems: "center", gap: 14 }}
              >
                <div style={{ width: 40, height: 40, borderRadius: 8, display: "grid", placeItems: "center", background: "var(--brand-surface, #e6f0fa)", color: "var(--brand-action, var(--primary))", flexShrink: 0 }}>
                  {link.icon}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)" }}>{link.label}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{link.desc}</div>
                </div>
              </button>
            ))}
          </div>

          <div style={{ marginBottom: 24 }}>
            <h5 style={{ margin: "0 0 12px 0", fontSize: 15, color: "var(--text-main)" }}>Recent Bills</h5>
            <Table
              minWidth={700}
              headings={["Bill ID", "Patient", "Amount", "Paid", "Status", "Date"]}
              empty="No recent bills."
              rows={recentBills.map((bill) => {
                const [bg, color] = statusColors[bill.billingStatus] || ["var(--surface)", "var(--text-secondary)"];
                return [
                  bill.billId || "-",
                  bill.patient?.name || "-",
                  `Rs ${money(bill.totalAmount)}`,
                  `Rs ${money(bill.totalPaid || 0)}`,
                  <span key="status" style={{ background: bg, color, padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 800, textTransform: "capitalize" }}>{bill.billingStatus}</span>,
                  formatDate(bill.createdAt),
                ];
              })}
            />
          </div>

          <div className="form-card" style={{ padding: 18, borderRadius: 8, display: "flex", justifyContent: "center", gap: 18, flexWrap: "wrap" }}>
            <a href="/billing" style={{ color: "var(--brand-action, var(--primary))", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>{Icons.arrowRight} Go to Billing Center</a>
            <a href="/accounts/chart" style={{ color: "var(--brand-action, var(--primary))", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>{Icons.arrowRight} View Full Chart of Accounts</a>
          </div>
        </>
      )}
    </div>
  );
}
