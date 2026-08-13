"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icons } from "@/app/components/Icons";
import { cachedJsonFetch } from "@/app/lib/use-current-user";
import styles from "./Analytics.module.css";
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
  draft: "#6b7280", reviewed: "#0891b2", approved: "#16a34a", released: "#059669",
  registered: "#ca8a04", collected: "#7c3aed", processing: "#e11d48",
  completed: "#2563eb", rejected: "#dc2626", archived: "#9333ea",
  paid: "#059669", partial: "#d97706", unpaid: "#dc2626", cancelled: "#6b7280",
  open: "#0d9488", "in-progress": "#ea580c",
  confirmed: "#16a34a", unknown: "#9ca3af",
};

const BRAND_COLOR = "var(--brand-action, var(--primary))";
const PIE_COLORS = [BRAND_COLOR, "#2563eb", "#7c3aed", "#d97706", "#dc2626", "#0891b2", "#16a34a", "#e11d48", "#4f46e5", "#ca8a04"];

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

function AnimatedNumber({ value, duration = 800 }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    const start = performance.now();
    const from = 0;
    const to = Number(value) || 0;
    function tick(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (progress < 1) ref.current = requestAnimationFrame(tick);
    }
    ref.current = requestAnimationFrame(tick);
    return () => { if (ref.current) cancelAnimationFrame(ref.current); };
  }, [value, duration]);
  return display;
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
            {c._id} — <AnimatedNumber value={c.count} /> (<AnimatedNumber value={total ? Math.round((c.count / total) * 100) : 0} duration={800} />%)
          </div>
        );
      })}
      {!counts.length && <span style={{ color: "var(--text-muted)", fontSize: 13 }}>No data</span>}
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="analytics-skeleton-layout">
      <div className="analytics-kpi-grid">
        {[1, 2, 3, 4].map((i) => <div key={i} className="lims-skeleton" style={{ height: 100 }} />)}
      </div>
      <div className="analytics-chart-grid analytics-chart-grid-primary">
        <div className="lims-skeleton" style={{ height: 320 }} />
        <div className="lims-skeleton" style={{ height: 320 }} />
      </div>
      <div className="analytics-chart-grid">
        <div className="lims-skeleton" style={{ height: 340 }} />
        <div className="lims-skeleton" style={{ height: 340 }} />
      </div>
    </div>
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
    <button type="button" onClick={onClick} className="analytics-expand-button" title="Expand chart" aria-label="Expand chart">
      {Icons.grid}
    </button>
  );
}

function ChartHeading({ icon, title, description }) {
  return (
    <div className={styles.chartHeading}>
      <span className={styles.chartIcon} aria-hidden="true">{icon}</span>
      <div>
        <div className={styles.chartTitle}>{title}</div>
        <p>{description}</p>
      </div>
    </div>
  );
}

function SectionHeading({ eyebrow, title, description }) {
  return (
    <div className={styles.sectionHeading}>
      <div>
        <span>{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      <p>{description}</p>
    </div>
  );
}

function renderPieDonut(data, dataKey, nameKey, height, innerR, chartKey) {
  return (
    <ResponsiveContainer key={chartKey} width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey={dataKey} nameKey={nameKey} cx="50%" cy="50%" outerRadius={height > 300 ? 140 : 90} innerRadius={innerR} paddingAngle={2} isAnimationActive animationDuration={1000} animationEasing="ease-out">
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

function renderBarHorizontal(data, dataKey, nameKey, height, chartKey) {
  return (
    <ResponsiveContainer key={chartKey} width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis type="number" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
        <YAxis dataKey={nameKey} type="category" tick={{ fontSize: 12, fill: "var(--text-secondary)" }} width={140} />
        <Tooltip content={<ChartTooltip formatter={(v) => `₹${money(v)}`} />} />
        <Bar dataKey={dataKey} radius={[0, 4, 4, 0]} isAnimationActive animationDuration={800} animationEasing="ease-out">
          {data.map((entry, i) => (
            <Cell key={entry._id || i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
          ))}
        </Bar>
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
  const [lastUpdated, setLastUpdated] = useState(null);

  const [revenueView, setRevenueView] = useState("area");
  const [reportView, setReportView] = useState("pie");
  const [sampleView, setSampleView] = useState("donut");
  const [testsView, setTestsView] = useState("bar");
  const [doctorView, setDoctorView] = useState("pie");
  const [expenseView, setExpenseView] = useState("donut");
  const [inventoryView, setInventoryView] = useState("bar");

  const [expanded, setExpanded] = useState(null);

  const load = useCallback(async (r = range) => {
    setLoading(true);
    setError("");
    try {
      const { response, data: d } = await cachedJsonFetch(`/api/analytics?range=${r}`, { ttl: 30_000 });
      if (!response.ok) throw new Error(d.error || "Unable to load analytics");
      setData(d);
      setLastUpdated(new Date());
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
          <ResponsiveContainer key={`revenue-${revenueView}`} width="100%" height={400}>
            {revenueView === "area" ? (
              <AreaChart data={data.revenueSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="_id" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                <Tooltip content={<ChartTooltip formatter={(v) => `₹${money(v)}`} />} />
                <Area type="monotone" dataKey="revenue" fill={BRAND_COLOR} stroke={BRAND_COLOR} fillOpacity={0.16} strokeWidth={2.5} isAnimationActive animationDuration={1200} animationEasing="ease-in-out" />
              </AreaChart>
            ) : revenueView === "bar" ? (
              <BarChart data={data.revenueSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="_id" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                <Tooltip content={<ChartTooltip formatter={(v) => `₹${money(v)}`} />} />
                <Bar dataKey="revenue" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={800} animationEasing="ease-out">
                  {data.revenueSeries.map((entry, i) => (
                    <Cell key={entry._id || i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            ) : (
              <LineChart data={data.revenueSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="_id" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                <Tooltip content={<ChartTooltip formatter={(v) => `₹${money(v)}`} />} />
                <Line type="monotone" dataKey="revenue" stroke={BRAND_COLOR} strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive animationDuration={1200} animationEasing="ease-in-out" />
              </LineChart>
            )}
          </ResponsiveContainer>
        );
      case "report-pie":
        return (
          <ResponsiveContainer key={`report-${reportView}`} width="100%" height={400}>
            <PieChart>
              <Pie data={data.reportStatusCounts} dataKey="count" nameKey="_id" cx="50%" cy="50%" outerRadius={140} innerRadius={reportView === "donut" ? 80 : 0} paddingAngle={2} isAnimationActive animationDuration={1000} animationEasing="ease-out">
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
          <ResponsiveContainer key={`sample-${sampleView}`} width="100%" height={400}>
            <PieChart>
              <Pie data={data.sampleStatusCounts} dataKey="count" nameKey="_id" cx="50%" cy="50%" outerRadius={140} innerRadius={sampleView === "donut" ? 80 : 0} paddingAngle={2} isAnimationActive animationDuration={1000} animationEasing="ease-out">
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
          <ResponsiveContainer key={`tests-${testsView}`} width="100%" height={400}>
            {testsView === "bar" ? (
              <BarChart data={data.testVolume} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                <YAxis dataKey="_id" type="category" tick={{ fontSize: 12, fill: "var(--text-secondary)" }} width={140} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} isAnimationActive animationDuration={800} animationEasing="ease-out">
                  {data.testVolume.map((entry, i) => (
                    <Cell key={entry._id || i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            ) : (
              <PieChart>
                <Pie data={data.testVolume} dataKey="count" nameKey="_id" cx="50%" cy="50%" outerRadius={140} innerRadius={testsView === "donut" ? 80 : 0} paddingAngle={2} isAnimationActive animationDuration={1000} animationEasing="ease-out">
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
            <ResponsiveContainer key={`doctors-${doctorView}`} width="100%" height={400}>
              {doctorView === "bar" ? (
                <BarChart data={data.doctorReferrals} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 12, fill: "var(--text-secondary)" }} width={140} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="bills" radius={[0, 4, 4, 0]} isAnimationActive animationDuration={800} animationEasing="ease-out">
                    {data.doctorReferrals.map((entry, i) => (
                      <Cell key={entry.doctorId || i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              ) : (
                <>
                  <PieChart>
                    <Pie data={data.doctorReferrals} dataKey="revenue" nameKey="name" cx="50%" cy="50%" outerRadius={140} innerRadius={doctorView === "donut" ? 80 : 0} paddingAngle={2} isAnimationActive animationDuration={1000} animationEasing="ease-out">
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
    <div className={`${styles.page} analytics-page`}>
      <header className={`${styles.pageHeader} analytics-page-header`}>
        <div className={styles.headingCopy}>
          <div className={styles.eyebrow}><span aria-hidden="true" /> Business intelligence</div>
          <h1>Analytics overview</h1>
          <p>Track financial health, laboratory throughput, referrals, and inventory performance in one workspace.</p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.periodControl}>
            <label htmlFor="analytics-range">Reporting period</label>
            <select
              id="analytics-range"
              value={range}
              onChange={(e) => setRange(e.target.value)}
              className="lims-input"
              aria-label="Analytics reporting period"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="180">Last 180 days</option>
              <option value="365">Last 365 days</option>
            </select>
          </div>
          <button className={styles.refreshButton} onClick={() => load(range)} disabled={loading}>
            {Icons.refresh} <span>{loading ? "Refreshing…" : "Refresh data"}</span>
          </button>
          {lastUpdated && (
            <span className={styles.updatedAt}>Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          )}
        </div>
      </header>

      {error && <div className="module-alert">{error}</div>}

      {loading ? <SkeletonGrid /> : data && (
        <>
          <section className={`${styles.kpiGrid} analytics-kpi-grid`} aria-label="Key performance indicators">
            <article className={`${styles.kpiCard} ${styles.kpiBrand} stat-card-upgraded analytics-kpi-card revenue`}>
              <div className={styles.kpiTopline}>
                <span className={styles.kpiIcon}>{Icons.wallet}</span>
                <span className={styles.kpiContext}>Revenue</span>
              </div>
              <div className="label">Revenue collected</div>
              <div className="value">₹{money(data.summary.totalRevenue)}</div>
              <div className="sub">
                {trend !== 0 && (
                  <span className={trend > 0 ? "trend-up" : "trend-down"}>
                    {trend > 0 ? "▲" : "▼"} {Math.abs(Math.round(trend))}%
                  </span>
                )}
                {trend === 0 && <span>Stable for this period</span>}
              </div>
            </article>
            <article className={`${styles.kpiCard} ${styles.kpiBlue} stat-card-upgraded analytics-kpi-card bills`}>
              <div className={styles.kpiTopline}>
                <span className={styles.kpiIcon}>{Icons.report}</span>
                <span className={styles.kpiContext}>Billing</span>
              </div>
              <div className="label">Total bills</div>
              <div className="value">{data.summary.totalBills || 0}</div>
              <div className="sub">{data.summary.paidBills || 0} paid</div>
            </article>
            <article className={`${styles.kpiCard} ${styles.kpiViolet} stat-card-upgraded analytics-kpi-card patients`}>
              <div className={styles.kpiTopline}>
                <span className={styles.kpiIcon}>{Icons.users}</span>
                <span className={styles.kpiContext}>Patients</span>
              </div>
              <div className="label">New patients</div>
              <div className="value">{data.summary.newPatients || 0}</div>
              <div className="sub">{data.summary.totalPatients || 0} total</div>
            </article>
            <article className={`${styles.kpiCard} ${styles.kpiAmber} stat-card-upgraded analytics-kpi-card collection`}>
              <div className={styles.kpiTopline}>
                <span className={styles.kpiIcon}>{Icons.activity}</span>
                <span className={styles.kpiContext}>Efficiency</span>
              </div>
              <div className="label">Collection rate</div>
              <div className="value">{collectionPct}%</div>
              <div className="sub">{data.summary.paidBills || 0} of {data.summary.totalBills || 0} paid</div>
            </article>
          </section>

          <SectionHeading
            eyebrow="Financial performance"
            title="Revenue and report delivery"
            description="Review collection movement and the current report pipeline for the selected period."
          />

          <div className="analytics-chart-grid analytics-chart-grid-primary">
            <div className="chart-card">
              <div className="chart-card-header">
                <ChartHeading icon={Icons.barChart} title="Revenue trend" description="Collections recorded across the selected period" />
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <ChartToggle views={["line", "bar", "area", "composed"]} active={revenueView} onChange={setRevenueView} />
                  <ExpandButton onClick={() => setExpanded("revenue")} />
                </div>
              </div>
              {data.revenueSeries?.length > 0 ? (
                <ResponsiveContainer key={`revenue-${revenueView}`} width="100%" height={350}>
                  {revenueView === "area" ? (
                    <AreaChart data={data.revenueSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="_id" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                      <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                      <Tooltip content={<ChartTooltip formatter={(v) => `₹${money(v)}`} />} />
                      <Area type="monotone" dataKey="revenue" fill={BRAND_COLOR} stroke={BRAND_COLOR} fillOpacity={0.16} strokeWidth={2.5} isAnimationActive animationDuration={1200} animationEasing="ease-in-out" />
                    </AreaChart>
                  ) : revenueView === "bar" ? (
                    <BarChart data={data.revenueSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="_id" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                      <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                      <Tooltip content={<ChartTooltip formatter={(v) => `₹${money(v)}`} />} />
                      <Bar dataKey="revenue" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={800} animationEasing="ease-out">
                          {data.revenueSeries.map((entry, i) => (
                            <Cell key={entry._id || i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Bar>
                    </BarChart>
                  ) : revenueView === "composed" ? (
                    <ComposedChart data={data.revenueSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="_id" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                      <Tooltip content={<ChartTooltip formatter={(v) => `₹${money(v)}`} />} />
                      <Bar yAxisId="left" dataKey="revenue" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={800} animationEasing="ease-out">
                        {data.revenueSeries.map((entry, i) => (
                          <Cell key={entry._id || i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Bar>
                      <Line yAxisId="right" type="monotone" dataKey="bills" stroke="#7c3aed" strokeWidth={2} dot={{ r: 3 }} isAnimationActive animationDuration={1200} animationEasing="ease-in-out" />
                    </ComposedChart>
                  ) : (
                    <LineChart data={data.revenueSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="_id" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                      <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                      <Tooltip content={<ChartTooltip formatter={(v) => `₹${money(v)}`} />} />
                      <Line type="monotone" dataKey="revenue" stroke={BRAND_COLOR} strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive animationDuration={1200} animationEasing="ease-in-out" />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              ) : (
                <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>No revenue data</div>
              )}
            </div>

            <div className="chart-card">
              <div className="chart-card-header">
                <ChartHeading icon={Icons.report} title="Report status" description="Distribution by stage in the reporting workflow" />
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <ChartToggle views={["pills", "pie", "donut"]} active={reportView} onChange={setReportView} />
                  <ExpandButton onClick={() => setExpanded("report-pie")} />
                </div>
              </div>
              {reportView === "pills" ? (
                <StatusPills counts={data.reportStatusCounts} />
              ) : (
                data.reportStatusCounts?.length > 0 ? (
                  <ResponsiveContainer key={`report-${reportView}`} width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={data.reportStatusCounts}
                        dataKey="count"
                        nameKey="_id"
                        cx="50%"
                        cy="50%"
                        outerRadius={110}
                        innerRadius={reportView === "donut" ? 60 : 0}
                        paddingAngle={2}
                        isAnimationActive
                        animationDuration={1000}
                        animationEasing="ease-out"
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

          <SectionHeading
            eyebrow="Laboratory operations"
            title="Samples and test demand"
            description="Understand current sample workload and the tests driving laboratory volume."
          />

          <div className="analytics-chart-grid">
            <div className="chart-card">
              <div className="chart-card-header">
                <ChartHeading icon={Icons.clock} title="Sample status" description="Workload grouped by the latest processing stage" />
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <ChartToggle views={["pills", "pie", "donut"]} active={sampleView} onChange={setSampleView} />
                  <ExpandButton onClick={() => setExpanded("sample-pie")} />
                </div>
              </div>
              {sampleView === "pills" ? (
                <StatusPills counts={data.sampleStatusCounts} />
              ) : (
                data.sampleStatusCounts?.length > 0 ? (
                  <ResponsiveContainer key={`sample-${sampleView}`} width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={data.sampleStatusCounts}
                        dataKey="count"
                        nameKey="_id"
                        cx="50%"
                        cy="50%"
                        outerRadius={110}
                        innerRadius={sampleView === "donut" ? 60 : 0}
                        paddingAngle={2}
                        isAnimationActive
                        animationDuration={1000}
                        animationEasing="ease-out"
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
                <ChartHeading icon={Icons.flask} title="Top tests by volume" description="Most frequently ordered tests in this period" />
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <ChartToggle views={["bar", "pie", "donut"]} active={testsView} onChange={setTestsView} />
                  <ExpandButton onClick={() => setExpanded("tests")} />
                </div>
              </div>
              {data.testVolume?.length > 0 ? (
                testsView === "bar" ? (
                  <ResponsiveContainer key={`tests-${testsView}`} width="100%" height={350}>
                    <BarChart data={data.testVolume} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis type="number" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                      <YAxis dataKey="_id" type="category" tick={{ fontSize: 12, fill: "var(--text-secondary)" }} width={140} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]} isAnimationActive animationDuration={800} animationEasing="ease-out">
                        {data.testVolume.map((entry, i) => (
                          <Cell key={entry._id || i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <ResponsiveContainer key={`tests-${testsView}`} width="100%" height={300}>
                    <PieChart>
                      <Pie data={data.testVolume} dataKey="count" nameKey="_id" cx="50%" cy="50%" outerRadius={110} innerRadius={testsView === "donut" ? 60 : 0} paddingAngle={2} isAnimationActive animationDuration={1000} animationEasing="ease-out">
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

          <SectionHeading
            eyebrow="Business performance"
            title="Referrals, costs, and assets"
            description="Compare referral contribution with operating expenses and inventory value."
          />

          <div className="analytics-chart-grid analytics-chart-grid-business">
            <div className="chart-card">
              <div className="chart-card-header">
                <ChartHeading icon={Icons.stethoscope} title="Doctor referrals" description="Revenue and bill contribution by referring doctor" />
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <ChartToggle views={["bar", "pie", "donut"]} active={doctorView} onChange={setDoctorView} />
                  <ExpandButton onClick={() => setExpanded("doctors")} />
                </div>
              </div>
              {data.doctorReferrals?.length > 0 ? (
                <>
                  {doctorView === "bar" ? (
                    <ResponsiveContainer key={`doctors-${doctorView}`} width="100%" height={350}>
                      <BarChart data={data.doctorReferrals} layout="vertical" margin={{ left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis type="number" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                        <YAxis dataKey="name" type="category" tick={{ fontSize: 12, fill: "var(--text-secondary)" }} width={140} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="bills" radius={[0, 4, 4, 0]} isAnimationActive animationDuration={800} animationEasing="ease-out">
                          {data.doctorReferrals.map((entry, i) => (
                            <Cell key={entry.doctorId || i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <>
                      <ResponsiveContainer key={`doctors-${doctorView}`} width="100%" height={250}>
                        <PieChart>
                          <Pie data={data.doctorReferrals} dataKey="revenue" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={doctorView === "donut" ? 50 : 0} paddingAngle={2} isAnimationActive animationDuration={1000} animationEasing="ease-out">
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
              <>
                {hasExpenses ? (
                  <div className="chart-card">
                    <div className="chart-card-header">
                      <ChartHeading icon={Icons.wallet} title="Expense breakdown" description="Operating spend grouped by expense category" />
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <ChartToggle views={["pie", "bar", "donut"]} active={expenseView} onChange={setExpenseView} />
                        <ExpandButton onClick={() => setExpanded("expenses")} />
                      </div>
                    </div>
                    {expenseView === "bar"
                      ? renderBarHorizontal(data.expenseBreakdown, "amount", "_id", 350, `expense-${expenseView}`)
                      : renderPieDonut(data.expenseBreakdown, "amount", "_id", 350, expenseView === "donut" ? 60 : 0, `expense-${expenseView}`)}
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
                      <ChartHeading icon={Icons.grid} title="Inventory valuation" description="Current stock value grouped by category" />
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <ChartToggle views={["bar", "pie", "donut"]} active={inventoryView} onChange={setInventoryView} />
                        <ExpandButton onClick={() => setExpanded("inventory")} />
                      </div>
                    </div>
                    {inventoryView === "bar"
                      ? renderBarHorizontal(data.inventoryValuation, "totalValue", "_id", 350, `inventory-${inventoryView}`)
                      : renderPieDonut(data.inventoryValuation, "totalValue", "_id", 350, inventoryView === "donut" ? 60 : 0, `inventory-${inventoryView}`)}
                    <div style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                      <InventoryTable data={data.inventoryValuation} />
                    </div>
                  </div>
                ) : (
                  <div className="chart-card" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200 }}>
                    <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>No inventory data</div>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {expanded && (
        <div
          className="analytics-modal-backdrop"
          onClick={() => setExpanded(null)}
        >
          <div className="analytics-modal" onClick={(e) => e.stopPropagation()}>
            <div className="analytics-modal-header">
              <div><small>Expanded analytics</small><strong>{expandedTitle}</strong></div>
              <button type="button" onClick={() => setExpanded(null)} aria-label="Close expanded chart">{Icons.close}</button>
            </div>
            <div className="analytics-modal-body">{renderExpandedChart()}</div>
          </div>
        </div>
      )}
    </div>
  );
}
