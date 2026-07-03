const colors = {
  neutral: ["var(--surface)", "var(--text-secondary)"],
  good: ["#ecfdf5", "#047857"],
  warn: ["#fffbeb", "#b45309"],
  info: ["#eff6ff", "#1d4ed8"],
};

export default function Badge({ children, tone = "neutral" }) {
  const [background, color] = colors[tone] || colors.neutral;
  return (
    <span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 6, background, color, fontSize: 12, fontWeight: 800 }}>
      {children}
    </span>
  );
}
