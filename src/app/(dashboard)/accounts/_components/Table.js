export default function Table({ headings, rows, empty, minWidth = 700 }) {
  return (
    <div className="form-card" style={{ padding: 0, overflowX: "auto", borderRadius: 8 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth }}>
        <thead>
          <tr style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
            {headings.map((heading) => (
              <th key={heading} style={{ padding: "12px 14px", textAlign: "left", color: "var(--text-secondary)", fontWeight: 800 }}>{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} style={{ borderBottom: "1px solid var(--border-light)" }}>
              {row.map((cell, cellIndex) => <td key={cellIndex} style={{ padding: "12px 14px", verticalAlign: "top" }}>{cell}</td>)}
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={headings.length} style={{ padding: 28, textAlign: "center", color: "var(--text-muted)" }}>{empty}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
