export default function StatCard({ label, value, icon }) {
  return (
    <div className="form-card" style={{ padding: 18, borderRadius: 8, minHeight: 98 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 800 }}>{label}</div>
          <div style={{ marginTop: 8, fontSize: 23, fontWeight: 900, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
        </div>
        <div style={{ width: 42, height: 42, borderRadius: 8, display: "grid", placeItems: "center", border: "1px solid var(--border)", color: "var(--brand-action, var(--primary))" }}>
          {icon}
        </div>
      </div>
    </div>
  );
}
