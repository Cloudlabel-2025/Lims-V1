"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icons } from "@/app/components/Icons";
import { money, formatDate, inputStyle } from "../_components/helpers";
import StatCard from "../_components/StatCard";
import Badge from "../_components/Badge";
import Table from "../_components/Table";
import Field from "../_components/Field";
import PaginationControls from "../_components/PaginationControls";

function downloadExcel(url) {
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.click();
}

function DailyCollectionReport({ from, to, loadTrigger }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [fullView, setFullView] = useState(false);

  async function fetchDaily() {
    if (!from || !to) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ from, to, page: String(page), limit: "20" });
      if (fullView) params.set("fullView", "true");
      const res = await fetch(`/api/accounting/reports/daily-collection?${params}`, { cache: "no-store" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed");
      setData(d);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { setPage(1); }, [from, to, fullView, loadTrigger]);
  useEffect(() => { fetchDaily(); }, [from, to, page, fullView, loadTrigger]);

  if (loading) return <div className="form-card" style={{ padding: 28, borderRadius: 8, textAlign: "center" }}>Loading...</div>;
  if (!data) return <div className="form-card" style={{ padding: 28, borderRadius: 8, textAlign: "center", color: "var(--text-muted)" }}>Select a date range and click Load</div>;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
          <input type="checkbox" checked={fullView} onChange={(e) => { setFullView(e.target.checked); setPage(1); }} />
          Full View
        </label>
        <button type="button" className="btn-lims-secondary" onClick={() => downloadExcel(`/api/accounting/reports/daily-collection?from=${from}&to=${to}&export=xlsx`)} style={{ height: 34, padding: "0 10px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
          {Icons.download} Excel
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>
        <StatCard label="Total Collection" value={`Rs ${money(data.totalCollection)}`} icon={Icons.wallet} />
        <StatCard label="Cash" value={`Rs ${money(data.breakdown?.cash || 0)}`} icon={Icons.list} />
        <StatCard label="Card" value={`Rs ${money(data.breakdown?.card || 0)}`} icon={Icons.list} />
        <StatCard label="UPI" value={`Rs ${money(data.breakdown?.upi || 0)}`} icon={Icons.list} />
      </div>
      <Table
        minWidth={700}
        headings={["Date", "Cash", "Card", "UPI", "Other", "Total"]}
        empty="No data for this period."
        rows={(data.daily || []).map((d) => [
          formatDate(d.date),
          `Rs ${money(d.cash || 0)}`,
          `Rs ${money(d.card || 0)}`,
          `Rs ${money(d.upi || 0)}`,
          `Rs ${money(d.other || 0)}`,
          `Rs ${money(d.total || 0)}`,
        ])}
      />
      <PaginationControls pagination={data.pagination} loading={loading} onPageChange={setPage} />
    </div>
  );
}

function MonthlyRevenueReport({ from, to, loadTrigger }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [fullView, setFullView] = useState(false);

  async function fetchMonthly() {
    if (!from || !to) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ from, to, page: String(page), limit: "20" });
      if (fullView) params.set("fullView", "true");
      const res = await fetch(`/api/accounting/reports/monthly-revenue?${params}`, { cache: "no-store" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed");
      setData(d);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { setPage(1); }, [from, to, fullView, loadTrigger]);
  useEffect(() => { fetchMonthly(); }, [from, to, page, fullView, loadTrigger]);

  if (loading) return <div className="form-card" style={{ padding: 28, borderRadius: 8, textAlign: "center" }}>Loading...</div>;
  if (!data) return <div className="form-card" style={{ padding: 28, borderRadius: 8, textAlign: "center", color: "var(--text-muted)" }}>Select a date range and click Load</div>;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
          <input type="checkbox" checked={fullView} onChange={(e) => { setFullView(e.target.checked); setPage(1); }} />
          Full View
        </label>
        <button type="button" className="btn-lims-secondary" onClick={() => downloadExcel(`/api/accounting/reports/monthly-revenue?from=${from}&to=${to}&export=xlsx`)} style={{ height: 34, padding: "0 10px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
          {Icons.download} Excel
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>
        <StatCard label="Total Revenue" value={`Rs ${money(data.totalRevenue)}`} icon={Icons.barChart} />
        <StatCard label="Total Bills" value={String(data.totalBills || 0)} icon={Icons.report} />
      </div>
      <Table
        minWidth={700}
        headings={["Month", "Bills", "Revenue", "Collection", "Outstanding"]}
        empty="No data for this period."
        rows={(data.monthly || []).map((m) => [
          m.month,
          m.bills || 0,
          `Rs ${money(m.revenue || 0)}`,
          `Rs ${money(m.collection || 0)}`,
          `Rs ${money(m.outstanding || 0)}`,
        ])}
      />
      <PaginationControls pagination={data.pagination} loading={loading} onPageChange={setPage} />
    </div>
  );
}

function WeeklyCollectionReport({ from, to, loadTrigger }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [fullView, setFullView] = useState(false);

  async function fetchWeekly() {
    if (!from || !to) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ from, to, page: String(page), limit: "20" });
      if (fullView) params.set("fullView", "true");
      const res = await fetch(`/api/accounting/reports/weekly?${params}`, { cache: "no-store" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed");
      setData(d);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { setPage(1); }, [from, to, fullView, loadTrigger]);
  useEffect(() => { fetchWeekly(); }, [from, to, page, fullView, loadTrigger]);

  if (loading) return <div className="form-card" style={{ padding: 28, borderRadius: 8, textAlign: "center" }}>Loading...</div>;
  if (!data) return <div className="form-card" style={{ padding: 28, borderRadius: 8, textAlign: "center", color: "var(--text-muted)" }}>Select a date range and click Load</div>;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
          <input type="checkbox" checked={fullView} onChange={(e) => { setFullView(e.target.checked); setPage(1); }} />
          Full View
        </label>
        <button type="button" className="btn-lims-secondary" onClick={() => downloadExcel(`/api/accounting/reports/weekly?from=${from}&to=${to}&export=xlsx`)} style={{ height: 34, padding: "0 10px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
          {Icons.download} Excel
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>
        <StatCard label="Total Collection" value={`Rs ${money(data.totalCollection)}`} icon={Icons.wallet} />
        <StatCard label="Cash" value={`Rs ${money(data.breakdown?.cash || 0)}`} icon={Icons.list} />
        <StatCard label="Card" value={`Rs ${money(data.breakdown?.card || 0)}`} icon={Icons.list} />
      </div>
      <Table
        minWidth={700}
        headings={["Week", "Cash", "Card", "Other", "Total"]}
        empty="No data for this period."
        rows={(data.weekly || []).map((w) => [
          w.week,
          `Rs ${money(w.cash || 0)}`,
          `Rs ${money(w.card || 0)}`,
          `Rs ${money(w.other || 0)}`,
          `Rs ${money(w.total || 0)}`,
        ])}
      />
      <PaginationControls pagination={data.pagination} loading={loading} onPageChange={setPage} />
    </div>
  );
}

function IncomeExpenseReport({ from, to, loadTrigger }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [fullView, setFullView] = useState(false);

  async function fetchPnL() {
    if (!from || !to) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ from, to, page: String(page), limit: "20" });
      if (fullView) params.set("fullView", "true");
      const res = await fetch(`/api/accounting/reports/income-expense?${params}`, { cache: "no-store" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed");
      setData(d);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { setPage(1); }, [from, to, fullView, loadTrigger]);
  useEffect(() => { fetchPnL(); }, [from, to, page, fullView, loadTrigger]);

  if (loading) return <div className="form-card" style={{ padding: 28, borderRadius: 8, textAlign: "center" }}>Loading...</div>;
  if (!data) return <div className="form-card" style={{ padding: 28, borderRadius: 8, textAlign: "center", color: "var(--text-muted)" }}>Select a date range and click Load</div>;

  const { totals } = data;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
          <input type="checkbox" checked={fullView} onChange={(e) => { setFullView(e.target.checked); setPage(1); }} />
          Full View
        </label>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>
        <StatCard label="Revenue" value={`Rs ${money(totals?.netRevenue || 0)}`} icon={Icons.barChart} />
        <StatCard label="Expenses" value={`Rs ${money(totals?.expenses || 0)}`} icon={Icons.flask} />
        <StatCard label="Net Income" value={`Rs ${money(totals?.netIncome || 0)}`} icon={Icons.wallet} />
      </div>
      <Table
        minWidth={750}
        headings={["Month", "Revenue", "Discounts", "Net Revenue", "Expenses", "Net Income"]}
        empty="No data for this period."
        rows={(data.monthly || []).map((m) => [
          m.month,
          `Rs ${money(m.revenue)}`,
          `Rs ${money(m.discounts)}`,
          `Rs ${money(m.netRevenue)}`,
          `Rs ${money(m.expenses)}`,
          <span key="ni" style={{ color: m.netIncome >= 0 ? "var(--success, #16a34a)" : "var(--error, #dc2626)", fontWeight: 700 }}>Rs {money(m.netIncome)}</span>,
        ])}
      />
      <PaginationControls pagination={data.pagination} loading={loading} onPageChange={setPage} />
    </div>
  );
}

function OutstandingReport() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [fullView, setFullView] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });

  useEffect(() => { setPage(1); }, [fullView]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(page), limit: "20" });
        if (fullView) params.set("fullView", "true");
        const res = await fetch(`/api/accounting/reports/outstanding?${params}`, { cache: "no-store" });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || "Failed");
        setData(d);
        setPagination(d.pagination || { page, limit: 20, total: 0, totalPages: 1 });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [page, fullView]);

  if (loading) return <div className="form-card" style={{ padding: 28, borderRadius: 8, textAlign: "center" }}>Loading...</div>;
  if (!data) return null;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
          <input type="checkbox" checked={fullView} onChange={(e) => { setFullView(e.target.checked); }} />
          Full View
        </label>
        <button type="button" className="btn-lims-secondary" onClick={() => downloadExcel("/api/accounting/reports/outstanding?export=xlsx")} style={{ height: 34, padding: "0 10px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
          {Icons.download} Excel
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>
        <StatCard label="Total Outstanding" value={`Rs ${money(data.totalOutstanding)}`} icon={Icons.barChart} />
        <StatCard label="Total Billed" value={`Rs ${money(data.totalBilled)}`} icon={Icons.report} />
        <StatCard label="Total Collected" value={`Rs ${money(data.totalCollected)}`} icon={Icons.wallet} />
      </div>
      <Table
        minWidth={750}
        headings={["Entry", "Bill ID", "Description", "Amount", "Date"]}
        empty="No outstanding bills."
        rows={(data.rows || []).map((r) => [
          r.entryNumber || "-",
          r.billId || "-",
          r.description || "-",
          `Rs ${money(r.amount)}`,
          formatDate(r.date),
        ])}
      />
      <PaginationControls pagination={pagination} loading={loading} onPageChange={setPage} />
    </div>
  );
}

export default function ReportsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("daily");
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split("T")[0];
  });
  const [to, setTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [loadTrigger, setLoadTrigger] = useState(0);

  const tabs = [
    ["daily", "Daily Collection", Icons.wallet],
    ["weekly", "Weekly Collection", Icons.calendar],
    ["monthly", "Monthly Revenue", Icons.barChart],
    ["pl", "P&L Statement", Icons.activity],
    ["outstanding", "Outstanding Dues", Icons.list],
  ];

  const showDateRange = activeTab !== "outstanding";

  return (
    <div className="patients-page" style={{ paddingBottom: 40 }}>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 18, flexWrap: "wrap", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div className="page-header-icon" style={{ background: "var(--brand-surface, #e6f0fa)", color: "var(--brand-action, var(--primary))", padding: 12, borderRadius: 8 }}>
            {Icons.report}
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: 20, color: "var(--text-main)" }}>Financial Reports</h4>
            <small style={{ color: "var(--text-muted)" }}>Daily/weekly collection, monthly revenue, P&L, outstanding dues</small>
          </div>
        </div>
        <button type="button" className="btn-lims-secondary" onClick={() => router.push("/accounts")} style={{ height: 38, padding: "0 14px" }}>
          {Icons.arrowLeft} Dashboard
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        {tabs.map(([key, label, icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={activeTab === key ? "btn-lims-primary" : "btn-lims-secondary"}
            style={{ height: 38, padding: "0 12px", display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 8, fontSize: 13 }}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {showDateRange && (
        <div className="form-card" style={{ padding: 14, borderRadius: 8, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, alignItems: "end", marginBottom: 18 }}>
          <Field label="From">
            <input type="date" className="lims-input" value={from} onChange={(e) => setFrom(e.target.value)} style={inputStyle()} />
          </Field>
          <Field label="To">
            <input type="date" className="lims-input" value={to} onChange={(e) => setTo(e.target.value)} style={inputStyle()} />
          </Field>
          <button type="button" className="btn-lims-primary" onClick={() => setLoadTrigger((p) => p + 1)} style={{ height: 38 }}>
            Load
          </button>
          <button type="button" className="btn-lims-secondary" onClick={() => downloadExcel(`/api/accounting/reports/consolidated?from=${from}&to=${to}`)} style={{ height: 38, display: "inline-flex", alignItems: "center", gap: 6 }}>
            {Icons.download} Download All
          </button>
        </div>
      )}

      {activeTab === "daily" && <DailyCollectionReport key={`daily-${loadTrigger}`} from={from} to={to} loadTrigger={loadTrigger} />}
      {activeTab === "weekly" && <WeeklyCollectionReport key={`weekly-${loadTrigger}`} from={from} to={to} loadTrigger={loadTrigger} />}
      {activeTab === "monthly" && <MonthlyRevenueReport key={`monthly-${loadTrigger}`} from={from} to={to} loadTrigger={loadTrigger} />}
      {activeTab === "pl" && <IncomeExpenseReport key={`pl-${loadTrigger}`} from={from} to={to} loadTrigger={loadTrigger} />}
      {activeTab === "outstanding" && <OutstandingReport key={`outstanding-${loadTrigger}`} />}
    </div>
  );
}
