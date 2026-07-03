export default function Field({ label, children }) {
  return (
    <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>
      {label}
      {children}
    </label>
  );
}
