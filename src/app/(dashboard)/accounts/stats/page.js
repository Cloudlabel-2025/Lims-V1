"use client";
import { useEffect, useState } from "react";
import { Icons } from "@/app/components/Icons";
import { money } from "../_components/helpers";
import StatCard from "../_components/StatCard";
import DownloadDropdown from "../_components/DownloadDropdown";
import BackToDashboard from "../_components/BackToDashboard";

export default function StatisticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/accounting/reports/stats", { cache: "no-store" });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || "Failed to load statistics");
        setData(d);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="patients-page" style={{ paddingBottom: 40 }}>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 18, flexWrap: "wrap", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div className="page-header-icon" style={{ background: "var(--brand-surface, #e6f0fa)", color: "var(--brand-action, var(--primary))", padding: 12, borderRadius: 8 }}>
            {Icons.barChart}
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: 20, color: "var(--text-main)" }}>Statistics</h4>
            <small style={{ color: "var(--text-muted)" }}>Patients, lab income &amp; commission stats</small>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <BackToDashboard />
          <DownloadDropdown
            onDownload={async (format) => {
              const res = await fetch(`/api/accounting/reports/stats?export=${format}`, { credentials: "include" });
              if (!res.ok) throw new Error("Download failed");
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `statistics-report.${format}`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(a.href);
            }}
          />
        </div>
      </div>

      {error && <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 8, background: "#fef2f2", color: "#b91c1c", fontSize: 13, fontWeight: 800 }}>{error}</div>}

      {loading ? (
        <div className="form-card" style={{ padding: 28, borderRadius: 8 }}>Loading...</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 24 }}>
          <StatCard label="Total Patients" value={String(data?.totalPatients || 0)} icon={Icons.users} />
          <StatCard label="Total Lab Income" value={`Rs ${money(data?.totalLabIncome || 0)}`} icon={Icons.barChart} />
          <StatCard label="Pending Commission" value={`Rs ${money(data?.totalPendingCommission || 0)}`} icon={Icons.wallet} />
          <StatCard label="Paid Commission" value={`Rs ${money(data?.totalPaidCommission || 0)}`} icon={Icons.report} />
          <StatCard label="Total Commission" value={`Rs ${money(data?.totalCommission || 0)}`} icon={Icons.list} />
        </div>
      )}
    </div>
  );
}
