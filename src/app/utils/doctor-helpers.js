export const getInitials = (name) => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(p => !["Dr.", "Dr"].includes(p));
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : parts[0]?.[0]?.toUpperCase() || "?";
};

export const formatDate = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
};

export const getStatusStyle = (status) => {
  switch (status) {
    case "Active": return { bg: "#ecfdf5", color: "#065f46", dot: "#10b981" };
    case "On Leave": return { bg: "#fffbeb", color: "#92400e", dot: "#f59e0b" };
    case "Inactive": return { bg: "#fff1f2", color: "#9f1239", dot: "#f43f5e" };
    default: return { bg: "#f1f5f9", color: "#64748b", dot: "#94a3b8" };
  }
};
