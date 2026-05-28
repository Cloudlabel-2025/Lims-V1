"use client";
import React, { memo } from "react";
import { Icons } from "@/app/components/Icons";

function InventoryTable({ items, selectedItemId, onSelectItem, onEditItem }) {
  return (
    <div className="form-card" style={{ padding: "0", overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
        <thead>
          <tr style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
            {["Item Name", "Category", "SKU / Code", "Stock Level", "Unit", "Status", "Actions"].map((heading) => (
              <th
                key={heading}
                style={{
                  padding: "12px 20px",
                  textAlign: heading === "Actions" ? "center" : "left",
                  color: "var(--text-secondary)",
                  fontWeight: "600",
                }}
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const isLowStock = item.quantity <= item.lowStockThreshold;
            const isOutOfStock = item.quantity === 0;
            
            let statusColor = "var(--success)";
            let statusBg = "var(--success-50, #f0fdf4)";
            let statusText = "In Stock";
            
            if (isOutOfStock) {
              statusColor = "var(--danger)";
              statusBg = "var(--danger-50, #fef2f2)";
              statusText = "Out of Stock";
            } else if (isLowStock) {
              statusColor = "var(--warning)";
              statusBg = "var(--warning-50, #fffbeb)";
              statusText = "Low Stock";
            }

            return (
              <tr 
                key={item._id}
                onClick={() => onSelectItem(item)}
                style={{
                  borderBottom: "1px solid var(--border-light)",
                  cursor: "pointer",
                  background: selectedItemId === item._id ? "var(--primary-50)" : "transparent",
                  transition: "background 0.2s",
                }}
                onMouseOver={(event) => {
                  if (selectedItemId !== item._id) {
                    event.currentTarget.style.background = "#f8fafc";
                  }
                }}
                onMouseOut={(event) => {
                  if (selectedItemId !== item._id) {
                    event.currentTarget.style.background = "transparent";
                  }
                }}
              >
                <td style={{ padding: "12px 20px" }}>
                  <div style={{ fontWeight: "600", color: "var(--text-primary)" }}>
                    {item.name}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
                    {item.manufacturer || "Unknown Brand"}
                  </div>
                </td>
                <td style={{ padding: "12px 20px" }}>
                  <span style={{
                    background: "var(--border-light)",
                    padding: "2px 8px",
                    borderRadius: "4px",
                    fontSize: "12px",
                    fontWeight: "500",
                    color: "var(--text-secondary)"
                  }}>
                    {item.category}
                  </span>
                </td>
                <td style={{ padding: "12px 20px", color: "var(--text-secondary)" }}>
                  {item.sku || "-"}
                </td>
                <td style={{ padding: "12px 20px" }}>
                  <div style={{ 
                    fontWeight: "600", 
                    color: isOutOfStock ? "var(--danger)" : isLowStock ? "var(--warning)" : "var(--text-primary)" 
                  }}>
                    {item.quantity}
                  </div>
                </td>
                <td style={{ padding: "12px 20px", color: "var(--text-secondary)" }}>
                  {item.unit}
                </td>
                <td style={{ padding: "12px 20px" }}>
                  <span style={{
                    background: statusBg,
                    color: statusColor,
                    padding: "4px 8px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: "600"
                  }}>
                    {statusText}
                  </span>
                </td>
                <td style={{ padding: "12px 20px", textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                  <button 
                    title="Edit Item"
                    onClick={() => onEditItem(item._id)}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                      padding: "6px",
                      borderRadius: "6px",
                      transition: "all 0.2s",
                      marginRight: "4px"
                    }}
                    onMouseOver={(event) => {
                      event.currentTarget.style.color = "var(--brand-action, var(--primary))";
                      event.currentTarget.style.background = "var(--primary-50)";
                    }}
                    onMouseOut={(event) => {
                      event.currentTarget.style.color = "var(--text-muted)";
                      event.currentTarget.style.background = "transparent";
                    }}
                  >
                    {Icons.edit}
                  </button>
                  <button 
                    title="Update Stock"
                    onClick={() => onEditItem(item._id)}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                      padding: "6px",
                      borderRadius: "6px",
                      transition: "all 0.2s",
                    }}
                    onMouseOver={(event) => {
                      event.currentTarget.style.color = "var(--brand-action, var(--primary))";
                      event.currentTarget.style.background = "var(--primary-50)";
                    }}
                    onMouseOut={(event) => {
                      event.currentTarget.style.color = "var(--text-muted)";
                      event.currentTarget.style.background = "transparent";
                    }}
                  >
                    {Icons.activity}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default memo(InventoryTable);
