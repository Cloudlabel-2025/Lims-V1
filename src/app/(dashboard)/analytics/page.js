"use client";

import { useCallback, useEffect, useState } from "react";
import { Icons } from "@/app/components/Icons";
import { cachedJsonFetch } from "@/app/lib/use-current-user";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

function money(v) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Number(v || 0));
}

function pct(value, total) {
  if (!total) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

const statusColors = {
  paid: "#059669", partial: "#d97706", unpaid: "#dc2626", draft: "#6b7280",
  completed: "#2563eb", verified: "#16a34a", released: "#059669",
  pending: "#ca8a04", collected: "#2563eb", processing: "#7c3aed",
  reported: "#059669", rejected: "#dc2626",
};

const PIE_COLORS = ["#059669", "#2563eb", "#7c3aed", "#d97706", "#dc2626", "#6b7280", "#0d9488", "#ca8a04", "#16a34a"];

function ChartTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", fontSize: 13 }}>
      <div style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>{label}</div>
      {payload.map((entry, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-secondary)" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: entry.color, display: "inline-block" }} />
          <span>{entry.name || entry.dataKey}: <strong style={{ color: "var(--text-primary)" }}>{formatter ? formatter(entry.value) : entry.value}</strong></span>
        </div>
      ))}
    </div>
  );
}

function StatusPills({ counts }) {
  const total = counts.reduce((s, c) => s + c.count, 0);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {counts.map((c) => {
        const bg = c._id ? `${statusColors[c._id]}15` : "var(--surface)";
        const color = statusColors[c._id] || "var(--text-secondary)";
        return (
          <div key={c._id} style={{ background: bg, color, borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 800 }}>
            {c._id} — {c.count} ({pct(c.count, total)})
          </div>
        );
      })}
      {!counts.length && <span style={{ color: "var(--text-muted)", fontSize: 13 }}>No data</span>}
    </div>
  );
}

function SkeletonGrid() {
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 24 }}>
        {[1, 2, 3, 4].map((i) => <div key={i} className="lims-skeleton" style={{ height: 100 }} />)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 }}>
        <div className="lims-skeleton" style={{ height: 320 }} />
        <div className="lims-skeleton" style={{ height: 320 }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <div className="lims-skeleton" style={{ height: 340 }} />
        <div className="lims-skeleton" style={{ height: 340 }} />
      </div>
    </>
  );
}

function ChartToggle({ views, active, onChange }) {
  return (
    <div className="chart-toggle-group">
      {views.map((v) => (
        <button
          key={v}
          type="button"
          className={`chart-toggle-btn${active === v ? " active" : ""}`}
          onClick={() => onChange(v)}
        >
          {v.charAt(0).toUpperCase() + v.slice(1)}
        </button>
      ))}
    </div>
  );
}

function ExpandButton({ onClick }) {
  return (
    <button type="button" onClick={onClick} style={{ all: "unset", cursor: "pointer", color: "var(--text-muted)", fontSize: 16, padding: "2px 6px", borderRadius: 4 }} title="Expand">
      ⛶
    </button>
  );
}

function renderPieDonut(data, dataKey, nameKey, height, innerR) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey={dataKey} nameKey={nameKey} cx="50%" cy="50%" outerRadius={height > 300 ? 140 : 90} innerRadius={innerR} paddingAngle={2}>
          {data.map((entry, i) => (
            <Cell key={entry._id || i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<ChartTooltip formatter={(v) => `₹${money(v)}`} />} />
        <Legend iconType="circle" fontSize={11} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function renderBarHorizontal(data, dataKey, nameKey, height) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis type="number" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
        <YAxis dataKey={nameKey} type="category" tick={{ fontSize: 12, fill: "var(--text-secondary)" }} width={140} />
        <Tooltip content={<ChartTooltip formatter={(v) => `₹${money(v)}`} />} />
        <Bar dataKey={dataKey} fill="var(--primary)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function ExpenseTable({ data }) {
  const total = data.reduce((s, e) => s + (e.amount || 0), 0);
  return (
    <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ color: "var(--text-muted)", fontWeight: 800 }}>
          <th style={{ textAlign: "left", padding: "4px 0" }}>Category</th>
          <th style={{ textAlign: "right", padding: "4px 0" }}>Amount</th>
          <th style={{ textAlign: "right", padding: "4px 0" }}>Entries</th>
          <th style={{ textAlign: "right", padding: "4px 0" }}>% of Total</th>
        </tr>
      </thead>
      <tbody>
        {data.map((d, i) => (
          <tr key={i} style={{ borderTop: "1px solid var(--border-light)" }}>
            <td style={{ padding: "6px 0", color: "var(--text-primary)", fontWeight: 600, textTransform: "capitalize" }}>{d._id || "—"}</td>
            <td style={{ padding: "6px 0", textAlign: "right" }}>₹{money(d.amount)}</td>
            <td style={{ padding: "6px 0", textAlign: "right" }}>{d.count}</td>
            <td style={{ padding: "6px 0", textAlign: "right", color: "#6b7280" }}>{pct(d.amount, total)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DoctorLegend({ data }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 16px", marginTop: 8, justifyContent: "center" }}>
      {data.map((entry, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-secondary)" }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: PIE_COLORS[i % PIE_COLORS.length], display: "inline-block", flexShrink: 0 }} />
          <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{entry.name || "—"}</span>
          <span>— ₹{money(entry.revenue)}</span>
        </div>
      ))}
    </div>
  );
}

function InventoryTable({ data }) {
  const totalVal = data.reduce((s, e) => s + (e.totalValue || 0), 0);
  return (
    <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ color: "var(--text-muted)", fontWeight: 800 }}>
          <th style={{ textAlign: "left", padding: "4px 0" }}>Category</th>
          <th style={{ textAlign: "right", padding: "4px 0" }}>Items</th>
          <th style={{ textAlign: "right", padding: "4px 0" }}>Stock</th>
          <th style={{ textAlign: "right", padding: "4px 0" }}>Total Value</th>
        </tr>
      </thead>
      <tbody>
        {data.map((d, i) => (
          <tr key={i} style={{ borderTop: "1px solid var(--border-light)" }}>
            <td style={{ padding: "6px 0", color: "var(--text-primary)", fontWeight: 600 }}>{d._id || "—"}</td>
            <td style={{ padding: "6px 0", textAlign: "right" }}>{d.items}</td>
            <td style={{ padding: "6px 0", textAlign: "right" }}>{d.totalStock}</td>
            <td style={{ padding: "6px 0", textAlign: "right" }}>₹{money(d.totalValue)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [range, setRange] = useState("30");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [revenueView, setRevenueView] = useState("area");
  const [reportView, setReportView] = useState("pills");
  const [sampleView, setSampleView] = useState("pills");
  const [testsView, setTestsView] = useState("bar");
  const [doctorView, setDoctorView] = useState("bar");
  const [expenseView, setExpenseView] = useState("pie");
  const [inventoryView, setInventoryView] = useState("bar");

  const [expanded, setExpanded] = useState(null);

  const load = useCallback(async (r = range) => {
    setLoading(true);
    setError("");
    try {
      const { response, data: d } = await cachedJsonFetch(`/api/analytics?range=${r}`, { ttl: 30_000 });
      if (!response.ok) throw new Error(d.error || "Unable to load analytics");
      setData(d);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  const trend = data?.revenueSeries?.length > 1
    ? ((data.revenueSeries.at(-1).revenue - data.revenueSeries[0].revenue) / (data.revenueSeries[0].revenue || 1)) * 100
    : 0;

  const collectionPct = data?.summary?.totalBills
    ? Math.round((data.summary.paidBills / data.summary.totalBills) * 100)
    : 0;

  const expandedTitle = {
    revenue: "Revenue Trend",
    "report-pie": "Report Status",
    "sample-pie": "Sample Status",
    tests: "Top Tests by Volume",
    doctors: "Doctor Referrals",
    expenses: "Expense Breakdown",
    inventory: "Inventory Valuation",
  }[expanded];

  function renderExpandedChart() {
    if (!data) return null;
    switch (expanded) {
      case "revenue":
        return (
          <ResponsiveContainer width="100%" height={400}>
            {revenueView === "area" ? (
              <AreaChart data={data.revenueSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="_id" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                <Tooltip content={<ChartTooltip formatter={(v) => `₹${money(v)}`} />} />
                <Area type="monotone" dataKey="revenue" fill="var(--primary)" stroke="var(--primary)" fillOpacity={0.15} strokeWidth={2} />
              </AreaChart>
            ) : revenueView === "bar" ? (
              <BarChart data={data.revenueSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="_id" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                <Tooltip content={<ChartTooltip formatter={(v) => `₹${money(v)}`} />} />
                <Bar dataKey="revenue" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : (
              <LineChart data={data.revenueSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="_id" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                <Tooltip content={<ChartTooltip formatter={(v) => `₹${money(v)}`} />} />
                <Line type="monotone" dataKey="revenue" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            )}
          </ResponsiveContainer>
        );
      case "report-pie":
        return (
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie data={data.reportStatusCounts} dataKey="count" nameKey="_id" cx="50%" cy="50%" outerRadius={140} innerRadius={reportView === "donut" ? 80 : 0} paddingAngle={2}>
                {data.reportStatusCounts?.map((entry) => (
                  <Cell key={entry._id} fill={statusColors[entry._id] || "#6b7280"} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
              <Legend iconType="circle" fontSize={11} />
            </PieChart>
          </ResponsiveContainer>
        );
      case "sample-pie":
        return (
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie data={data.sampleStatusCounts} dataKey="count" nameKey="_id" cx="50%" cy="50%" outerRadius={140} innerRadius={sampleView === "donut" ? 80 : 0} paddingAngle={2}>
                {data.sampleStatusCounts?.map((entry) => (
                  <Cell key={entry._id} fill={statusColors[entry._id] || "#6b7280"} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
              <Legend iconType="circle" fontSize={11} />
            </PieChart>
          </ResponsiveContainer>
        );
      case "tests":
        return (
          <ResponsiveContainer width="100%" height={400}>
            {testsView === "bar" ? (
              <BarChart data={data.testVolume} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                <YAxis dataKey="_id" type="category" tick={{ fontSize: 12, fill: "var(--text-secondary)" }} width={140} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" fill="#7c3aed" radius={[0, 4, 4, 0]} />
              </BarChart>
            ) : (
              <PieChart>
                <Pie data={data.testVolume} dataKey="count" nameKey="_id" cx="50%" cy="50%" outerRadius={140} innerRadius={testsView === "donut" ? 80 : 0} paddingAngle={2}>
                  {data.testVolume.map((entry, i) => (
                    <Cell key={entry._id || i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend iconType="circle" fontSize={11} />
              </PieChart>
            )}
          </ResponsiveContainer>
        );
      case "doctors":
        return (
          <>
            <ResponsiveContainer width="100%" height={400}>
              {doctorView === "bar" ? (
                <BarChart data={data.doctorReferrals} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 12, fill: "var(--text-secondary)" }} width={140} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="bills" fill="#0d9488" radius={[0, 4, 4, 0]} />
                </BarChart>
              ) : (
                <>
                  <PieChart>
                    <Pie data={data.doctorReferrals} dataKey="revenue" nameKey="name" cx="50%" cy="50%" outerRadius={140} innerRadius={doctorView === "donut" ? 80 : 0} paddingAngle={2}>
                      {data.doctorReferrals.map((entry, i) => (
                        <Cell key={entry.doctorId || i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip formatter={(v) => `₹${money(v)}`} />} />
                  </PieChart>
                  <DoctorLegend data={data.doctorReferrals} />
                </>
              )}
            </ResponsiveContainer>
            {doctorView === "bar" && (
              <div style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ color: "var(--text-muted)", fontWeight: 800 }}>
                      <th style={{ textAlign: "left", padding: "4px 0" }}>Doctor</th>
                      <th style={{ textAlign: "right", padding: "4px 0" }}>Revenue</th>
                      <th style={{ textAlign: "right", padding: "4px 0" }}>Commission</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.doctorReferrals.map((d, i) => (
                      <tr key={i} style={{ borderTop: "1px solid var(--border-light)" }}>
                        <td style={{ padding: "6px 0", color: "var(--text-primary)", fontWeight: 600 }}>{d.name || "—"}</td>
                        <td style={{ padding: "6px 0", textAlign: "right" }}>₹{money(d.revenue)}</td>
                        <td style={{ padding: "6px 0", textAlign: "right", color: "#b45309" }}>₹{money(d.commission)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        );
      case "expenses":
        return (
          <>
            {expenseView === "bar"
              ? renderBarHorizontal(data.expenseBreakdown, "amount", "_id", 400)
              : renderPieDonut(data.expenseBreakdown, "amount", "_id", 400, expenseView === "donut" ? 80 : 0)}
            {data.expenseBreakdown?.length > 0 && (
              <div style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                <ExpenseTable data={data.expenseBreakdown} />
              </div>
            )}
          </>
        );
      case "inventory":
        return (
          <>
            {inventoryView === "bar"
              ? renderBarHorizontal(data.inventoryValuation, "totalValue", "_id", 400)
              : renderPieDonut(data.inventoryValuation, "totalValue", "_id", 400, inventoryView === "donut" ? 80 : 0)}
            {data.inventoryValuation?.length > 0 && (
              <div style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                <InventoryTable data={data.inventoryValuation} />
              </div>
            )}
          </>
        );
      default:
        return null;
    }
  }

  const hasExpenses = data?.expenseBreakdown?.length > 0;
  const hasInventory = data?.inventoryValuation?.length > 0;

  return (
    <div style={{ width: "100%", paddingBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <div>
          <p className="module-kicker">Business Intelligence</p>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>Analytics</h1>
          <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>Revenue, test volume, referrals, and workflow metrics.</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="lims-input"
            style={{ height: 38, width: 140 }}
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="180">Last 180 days</option>
            <option value="365">Last 365 days</option>
          </select>
          <button className="dash-btn-secondary" onClick={() => load(range)} style={{ height: 38 }}>
            {Icons.refresh} Refresh
          </button>
        </div>
      </div>

      {error && <div className="module-alert">{error}</div>}

      {loading ? <SkeletonGrid /> : data && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 24 }}>
            <div className="stat-card-upgraded">
              <div className="accent-bar" style={{ background: "var(--primary)" }} />
              <div className="label">Revenue Collected</div>
              <div className="value" style={{ color: "var(--primary)" }}>₹{money(data.summary.totalRevenue)}</div>
              <div className="sub">
                {trend !== 0 && (
                  <span className={trend > 0 ? "trend-up" : "trend-down"}>
                    {trend > 0 ? "▲" : "▼"} {Math.abs(Math.round(trend))}%
                  </span>
                )}
              </div>
            </div>
            <div className="stat-card-upgraded">
              <div className="accent-bar" style={{ background: "#2563eb" }} />
              <div className="label">Total Bills</div>
              <div className="value">{data.summary.totalBills || 0}</div>
              <div className="sub">{data.summary.paidBills || 0} paid</div>
            </div>
            <div className="stat-card-upgraded">
              <div className="accent-bar" style={{ background: "#7c3aed" }} />
              <div className="label">New Patients</div>
              <div className="value">{data.summary.newPatients || 0}</div>
              <div className="sub">{data.summary.totalPatients || 0} total</div>
            </div>
            <div className="stat-card-upgraded">
              <div className="accent-bar" style={{ background: "#d97706" }} />
              <div className="label">Collection Rate</div>
              <div className="value" style={{ color: "#d97706" }}>{collectionPct}%</div>
              <div className="sub">{data.summary.paidBills || 0} of {data.summary.totalBills || 0} paid</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 }}>
            <div className="chart-card">
              <div className="chart-card-header">
                <div className="chart-card-title"><span style={{ color: "var(--primary)" }}>{Icons.barChart}</span> Revenue Trend</div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <ChartToggle views={["line", "bar", "area", "composed"]} active={revenueView} onChange={setRevenueView} />
                  <ExpandButton onClick={() => setExpanded("revenue")} />
                </div>
              </div>
              {data.revenueSeries?.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  {revenueView === "area" ? (
                    <AreaChart data={data.revenueSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="_id" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                      <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                      <Tooltip content={<ChartTooltip formatter={(v) => `₹${money(v)}`} />} />
                      <Area type="monotone" dataKey="revenue" fill="var(--primary)" stroke="var(--primary)" fillOpacity={0.15} strokeWidth={2} />
                    </AreaChart>
                  ) : revenueView === "bar" ? (
                    <BarChart data={data.revenueSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="_id" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                      <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                      <Tooltip content={<ChartTooltip formatter={(v) => `₹${money(v)}`} />} />
                      <Bar dataKey="revenue" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  ) : revenueView === "composed" ? (
                    <ComposedChart data={data.revenueSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="_id" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                      <Tooltip content={<ChartTooltip formatter={(v) => `₹${money(v)}`} />} />
                      <Bar yAxisId="left" dataKey="revenue" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                      <Line yAxisId="right" type="monotone" dataKey="bills" stroke="#7c3aed" strokeWidth={2} dot={{ r: 3 }} />
                    </ComposedChart>
            ) : revenueView === "composed" ? (
              <ComposedChart data={data.revenueSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="_id" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                <Tooltip content={<ChartTooltip formatter={(v) => `₹${money(v)}`} />} />
                <Bar yAxisId="left" dataKey="revenue" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="bills" stroke="#7c3aed" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            ) : (
                    <LineChart data={data.revenueSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="_id" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                      <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                      <Tooltip content={<ChartTooltip formatter={(v) => `₹${money(v)}`} />} />
                      <Line type="monotone" dataKey="revenue" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              ) : (
                <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>No revenue data</div>
              )}
            </div>

            <div className="chart-card">
              <div className="chart-card-header">
                <div className="chart-card-title"><span style={{ color: "var(--primary)" }}>{Icons.report}</span> Report Status</div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <ChartToggle views={["pills", "pie", "donut"]} active={reportView} onChange={setReportView} />
                  <ExpandButton onClick={() => setExpanded("report-pie")} />
                </div>
              </div>
              {reportView === "pills" ? (
                <StatusPills counts={data.reportStatusCounts} />
              ) : (
                data.reportStatusCounts?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={data.reportStatusCounts}
                        dataKey="count"
                        nameKey="_id"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        innerRadius={reportView === "donut" ? 50 : 0}
                        paddingAngle={2}
                      >
                        {data.reportStatusCounts.map((entry) => (
                          <Cell key={entry._id} fill={statusColors[entry._id] || "#6b7280"} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                      <Legend iconType="circle" fontSize={11} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>No data</div>
                )
              )}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 }}>
            <div className="chart-card">
              <div className="chart-card-header">
                <div className="chart-card-title"><span style={{ color: "var(--primary)" }}>{Icons.clock}</span> Sample Status</div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <ChartToggle views={["pills", "pie", "donut"]} active={sampleView} onChange={setSampleView} />
                  <ExpandButton onClick={() => setExpanded("sample-pie")} />
                </div>
              </div>
              {sampleView === "pills" ? (
                <StatusPills counts={data.sampleStatusCounts} />
              ) : (
                data.sampleStatusCounts?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={data.sampleStatusCounts}
                        dataKey="count"
                        nameKey="_id"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        innerRadius={sampleView === "donut" ? 50 : 0}
                        paddingAngle={2}
                      >
                        {data.sampleStatusCounts.map((entry) => (
                          <Cell key={entry._id} fill={statusColors[entry._id] || "#6b7280"} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                      <Legend iconType="circle" fontSize={11} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>No data</div>
                )
              )}
            </div>

            <div className="chart-card">
              <div className="chart-card-header">
                <div className="chart-card-title"><span style={{ color: "var(--primary)" }}>{Icons.flask}</span> Top Tests by Volume</div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <ChartToggle views={["bar", "pie", "donut"]} active={testsView} onChange={setTestsView} />
                  <ExpandButton onClick={() => setExpanded("tests")} />
                </div>
              </div>
              {data.testVolume?.length > 0 ? (
                testsView === "bar" ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data.testVolume} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis type="number" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                      <YAxis dataKey="_id" type="category" tick={{ fontSize: 12, fill: "var(--text-secondary)" }} width={140} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="count" fill="#7c3aed" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={data.testVolume} dataKey="count" nameKey="_id" cx="50%" cy="50%" outerRadius={110} innerRadius={testsView === "donut" ? 60 : 0} paddingAngle={2}>
                        {data.testVolume.map((entry, i) => (
                          <Cell key={entry._id || i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                      <Legend iconType="circle" fontSize={11} />
                    </PieChart>
                  </ResponsiveContainer>
                )
              ) : (
                <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>No data</div>
              )}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
            <div className="chart-card">
              <div className="chart-card-header">
                <div className="chart-card-title"><span style={{ color: "var(--primary)" }}>{Icons.stethoscope}</span> Doctor Referrals</div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <ChartToggle views={["bar", "pie", "donut"]} active={doctorView} onChange={setDoctorView} />
                  <ExpandButton onClick={() => setExpanded("doctors")} />
                </div>
              </div>
              {data.doctorReferrals?.length > 0 ? (
                <>
                  {doctorView === "bar" ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={data.doctorReferrals} layout="vertical" margin={{ left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis type="number" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                        <YAxis dataKey="name" type="category" tick={{ fontSize: 12, fill: "var(--text-secondary)" }} width={140} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="bills" fill="#0d9488" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <Pie data={data.doctorReferrals} dataKey="revenue" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={doctorView === "donut" ? 50 : 0} paddingAngle={2}>
                            {data.doctorReferrals.map((entry, i) => (
                              <Cell key={entry.doctorId || i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip content={<ChartTooltip formatter={(v) => `₹${money(v)}`} />} />
                        </PieChart>
                      </ResponsiveContainer>
                      <DoctorLegend data={data.doctorReferrals} />
                    </>
                  )}
                  <div style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                    <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ color: "var(--text-muted)", fontWeight: 800 }}>
                          <th style={{ textAlign: "left", padding: "4px 0" }}>Doctor</th>
                          <th style={{ textAlign: "right", padding: "4px 0" }}>Revenue</th>
                          <th style={{ textAlign: "right", padding: "4px 0" }}>Commission</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.doctorReferrals.map((d, i) => (
                          <tr key={i} style={{ borderTop: "1px solid var(--border-light)" }}>
                            <td style={{ padding: "6px 0", color: "var(--text-primary)", fontWeight: 600 }}>{d.name || "—"}</td>
                            <td style={{ padding: "6px 0", textAlign: "right" }}>₹{money(d.revenue)}</td>
                            <td style={{ padding: "6px 0", textAlign: "right", color: "#b45309" }}>₹{money(d.commission)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>No data</div>
              )}
            </div>

            {(hasExpenses || hasInventory) && (
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                {hasExpenses ? (
                  <div className="chart-card">
                    <div className="chart-card-header">
                      <div className="chart-card-title"><span style={{ color: "var(--primary)" }}>{Icons.wallet}</span> Expense Breakdown</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <ChartToggle views={["pie", "bar", "donut"]} active={expenseView} onChange={setExpenseView} />
                        <ExpandButton onClick={() => setExpanded("expenses")} />
                      </div>
                    </div>
                    {expenseView === "bar"
                      ? renderBarHorizontal(data.expenseBreakdown, "amount", "_id", 250)
                      : renderPieDonut(data.expenseBreakdown, "amount", "_id", 250, expenseView === "donut" ? 50 : 0)}
                    <div style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                      <ExpenseTable data={data.expenseBreakdown} />
                    </div>
                  </div>
                ) : (
                  <div className="chart-card" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200 }}>
                    <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>No expense data</div>
                  </div>
                )}
                {hasInventory ? (
                  <div className="chart-card">
                    <div className="chart-card-header">
                      <div className="chart-card-title"><span style={{ color: "var(--primary)" }}>{Icons.grid}</span> Inventory Valuation</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <ChartToggle views={["bar", "pie", "donut"]} active={inventoryView} onChange={setInventoryView} />
                        <ExpandButton onClick={() => setExpanded("inventory")} />
                      </div>
                    </div>
                    {inventoryView === "bar"
                      ? renderBarHorizontal(data.inventoryValuation, "totalValue", "_id", 250)
                      : renderPieDonut(data.inventoryValuation, "totalValue", "_id", 250, inventoryView === "donut" ? 50 : 0)}
                    <div style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                      <InventoryTable data={data.inventoryValuation} />
                    </div>
                  </div>
                ) : (
                  <div className="chart-card" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200 }}>
                    <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>No inventory data</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {expanded && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}
          onClick={() => setExpanded(null)}
        >
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "90%", maxWidth: 900, maxHeight: "90vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <strong style={{ fontSize: 16 }}>{expandedTitle}</strong>
              <button onClick={() => setExpanded(null)} style={{ all: "unset", cursor: "pointer", fontSize: 20, color: "var(--text-muted)" }}>✕</button>
            </div>
            {renderExpandedChart()}
          </div>
        </div>
      )}
    </div>
  );
}
