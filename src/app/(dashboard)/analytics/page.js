"use client";

import { useCallback, useEffect, useState } from "react";
import { Icons } from "@/app/components/Icons";
import { cachedJsonFetch } from "@/app/lib/use-current-user";

function money(v) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Number(v || 0));
}

function pct(value, total) {
  if (!total) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" }}>
      <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color: color || "var(--text-primary)", marginTop: 8 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function BarChart({ data, valueKey, labelKey, color, formatValue }) {
  if (!data?.length) return <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>No data</div>;
  const max = Math.max(...data.map((d) => d[valueKey] || 0)) || 1;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {data.map((item, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 3fr auto", gap: 10, alignItems: "center" }}>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={item[labelKey]}>
            {item[labelKey] || "—"}
          </div>
          <div style={{ background: "var(--surface)", borderRadius: 4, height: 20, overflow: "hidden" }}>
            <div style={{ width: pct(item[valueKey] || 0, max), height: "100%", background: color || "var(--primary)", borderRadius: 4, transition: "width 0.4s ease" }} />
          </div>
          <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-primary)", whiteSpace: "nowrap" }}>
            {formatValue ? formatValue(item[valueKey]) : item[valueKey]}
          </div>
        </div>
      ))}
    </div>
  );
}

function LineChart({ series }) {
  if (!series?.length) return <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>No data</div>;
  const W = 600, H = 140, PAD = 10;
  const values = series.map((d) => d.revenue || 0);
  const max = Math.max(...values) || 1;
  const points = series.map((d, i) => {
    const x = PAD + (i / Math.max(series.length - 1, 1)) * (W - PAD * 2);
    const y = H - PAD - ((d.revenue || 0) / max) * (H - PAD * 2);
    return `${x},${y}`;
  });
  const area = `M${points[0]} L${points.join(" L")} L${PAD + (W - PAD * 2)},${H - PAD} L${PAD},${H - PAD} Z`;
  const line = `M${points[0]} L${points.join(" L")}`;
  return (
    <div style={{ overflowX: "auto" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", minWidth: 300, height: H }}>
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#areaGrad)" />
        <path d={line} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinejoin="round" />
        {series.map((d, i) => {
          const [x, y] = points[i].split(",").map(Number);
          return <circle key={i} cx={x} cy={y} r="3" fill="var(--primary)" />;
        })}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>
        <span>{series[0]?._id}</span>
        <span>{series[series.length - 1]?._id}</span>
      </div>
    </div>
  );
}

function StatusPills({ counts }) {
  const colors = {
    paid: ["#ecfdf5", "#047857"],
    partial: ["#fffbeb", "#b45309"],
    unpaid: ["#fef2f2", "#b91c1c"],
    draft: ["#f1f5f9", "#475569"],
    completed: ["#eff6ff", "#1d4ed8"],
    verified: ["#f0fdf4", "#15803d"],
    released: ["#ecfdf5", "#047857"],
    pending: ["#fef9c3", "#854d0e"],
    collected: ["#eff6ff", "#1d4ed8"],
    processing: ["#f5f3ff", "#6d28d9"],
    reported: ["#ecfdf5", "#047857"],
    rejected: ["#fef2f2", "#b91c1c"],
  };
  const total = counts.reduce((s, c) => s + c.count, 0);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {counts.map((c) => {
        const [bg, color] = colors[c._id] || ["var(--surface)", "var(--text-secondary)"];
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

export default function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [range, setRange] = useState("30");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  useEffect(() => { load(range); }, [range]);

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

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading analytics...</div>
      ) : data && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 24 }}>
            <StatCard label="Revenue Collected" value={`₹${money(data.summary.totalRevenue)}`} color="var(--primary)" />
            <StatCard label="Total Bills" value={data.summary.totalBills} sub={`${data.summary.paidBills} paid`} />
            <StatCard label="New Patients" value={data.summary.newPatients} sub={`${data.summary.totalPatients} total`} />
            <StatCard label="Collection Rate" value={data.summary.totalBills ? pct(data.summary.paidBills, data.summary.totalBills) : "—"} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 }}>
            <Panel title="Revenue Trend" icon={Icons.barChart}>
              <LineChart series={data.revenueSeries} />
            </Panel>
            <Panel title="Report Status" icon={Icons.report}>
              <StatusPills counts={data.reportStatusCounts} />
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase" }}>Sample Status</div>
                <StatusPills counts={data.sampleStatusCounts} />
              </div>
            </Panel>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
            <Panel title="Top Tests by Volume" icon={Icons.flask}>
              <BarChart
                data={data.testVolume}
                labelKey="_id"
                valueKey="count"
                color="#7c3aed"
              />
            </Panel>
            <Panel title="Doctor Referrals" icon={Icons.stethoscope}>
              <BarChart
                data={data.doctorReferrals.map((d) => ({ ...d, label: d.name || "Unknown" }))}
                labelKey="label"
                valueKey="bills"
                color="#0d9488"
                formatValue={(v) => `${v} bills`}
              />
              {data.doctorReferrals.length > 0 && (
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
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

function Panel({ title, icon, children }) {
  return (
    <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, fontWeight: 800, fontSize: 15 }}>
        <span style={{ color: "var(--primary)" }}>{icon}</span> {title}
      </div>
      {children}
    </div>
  );
}
