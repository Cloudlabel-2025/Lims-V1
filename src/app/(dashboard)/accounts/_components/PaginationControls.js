export default function PaginationControls({ pagination, loading, onPageChange }) {
  if (!pagination || pagination.totalPages <= 1) return null;

  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <span style={{ color: "var(--text-muted)", fontSize: 13, fontWeight: 700 }}>
        Page {pagination.page} of {pagination.totalPages}
      </span>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="btn-lims-secondary" disabled={loading || pagination.page <= 1} onClick={() => onPageChange(Math.max(1, pagination.page - 1))} style={{ height: 34, padding: "0 12px" }}>Previous</button>
        <button type="button" className="btn-lims-secondary" disabled={loading || pagination.page >= pagination.totalPages} onClick={() => onPageChange(Math.min(pagination.totalPages, pagination.page + 1))} style={{ height: 34, padding: "0 12px" }}>Next</button>
      </div>
    </div>
  );
}
