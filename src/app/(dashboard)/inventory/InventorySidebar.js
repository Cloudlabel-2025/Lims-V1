"use client";
import React, { memo } from "react";
import { Icons } from "@/app/components/Icons";

const DetailRow = memo(function DetailRow({ icon, value, truncate = false }) {
  return (
    <div className="contact-row">
      <span className="contact-icon-mini">{icon}</span>
      <span className={truncate ? "text-truncate-2" : undefined}>{value || "Not provided"}</span>
    </div>
  );
});

function InventorySidebar({ item, onClose }) {
  if (!item) return null;

  const isLowStock = item.quantity <= item.lowStockThreshold;
  const isOutOfStock = item.quantity === 0;
  
  let statusText = "In Stock";
  if (isOutOfStock) {
    statusText = "Out of Stock";
  } else if (isLowStock) {
    statusText = "Low Stock";
  }

  return (
    <div className="sidebar-top">
      <div className="sidebar-header">
        <div className="sidebar-logo-flower">{Icons.flask}</div>
        <span className="sidebar-header-title">Item Details</span>
        <button className="sidebar-close-menu" onClick={onClose}>
          {Icons.close}
        </button>
      </div>

      <div className="sidebar-photo-section">
        <div className="patient-name-header">
          <div className="patient-name-text">
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "20px", fontWeight: "700", color: "var(--text-primary)" }}>
                {item.name}
              </span>
              <span
                style={{ fontSize: "14px", color: "var(--text-secondary)", fontWeight: "600" }}
              >
                {item.category}
              </span>
            </div>
            <div className="patient-tag-id" style={{ marginTop: "4px" }}>
              {item.sku || "No SKU"}
            </div>
          </div>
          <button className="patient-more-btn" type="button" aria-label="More item actions">
            {Icons.dots}
          </button>
        </div>

        <div className="teal-brand-card" style={{ marginBottom: "24px", width: "100%" }}>
          <div className="brand-header-mini">
            <div className="brand-logo-mini">{Icons.activity}</div>
            <div className="brand-name-mini">Inventory Record</div>
          </div>

          <div className="brand-patient-info">
            <div className="brand-patient-name">{item.name}</div>
            <div className="brand-patient-id-mini">{item.manufacturer || "Unknown Brand"}</div>
          </div>

          <div
            style={{
              margin: "12px 0 20px",
              padding: "14px 16px",
              background: "rgba(255,255,255,0.12)",
              borderRadius: "14px",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "10px",
                borderBottom: "1px solid rgba(255,255,255,0.12)",
                paddingBottom: "10px",
                gap: "16px",
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  opacity: 0.9,
                  fontWeight: "500",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                Current Stock
              </div>
              <div style={{ fontSize: "14px", fontWeight: "700", color: isOutOfStock ? "#fecaca" : isLowStock ? "#fef08a" : "#fff" }}>
                {item.quantity} {item.unit}
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "16px" }}>
              <div
                style={{
                  fontSize: "11px",
                  opacity: 0.9,
                  fontWeight: "500",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                Status
              </div>
              <div style={{ fontSize: "13px", fontWeight: "700", textAlign: "right" }}>
                {statusText}
              </div>
            </div>
          </div>

          <div className="vitals-grid-mini">
            <div className="vital-mini-box">
              <div className="vital-icon-circle blood">{Icons.alertCircle}</div>
              <div className="vital-mini-label" style={{ fontSize: "10px", opacity: 1, fontWeight: "600" }}>
                LOW ALERT
              </div>
              <div className="vital-mini-value" style={{ fontSize: "13px", fontWeight: "700" }}>
                {item.lowStockThreshold} {item.unit}
              </div>
            </div>
            <div className="vital-mini-box">
              <div className="vital-icon-circle temp">{Icons.mapPin}</div>
              <div className="vital-mini-label" style={{ fontSize: "10px", opacity: 1, fontWeight: "600" }}>
                LOC
              </div>
              <div className="vital-mini-value" style={{ fontSize: "13px", fontWeight: "700" }}>
                {item.location ? (item.location.length > 8 ? item.location.substring(0, 8) + '...' : item.location) : "N/A"}
              </div>
            </div>
            <div className="vital-mini-box">
              <div className="vital-icon-circle weight">{Icons.thermometer}</div>
              <div className="vital-mini-label" style={{ fontSize: "10px", opacity: 1, fontWeight: "600" }}>
                TEMP
              </div>
              <div className="vital-mini-value" style={{ fontSize: "13px", fontWeight: "700" }}>
                {item.storageConditions ? (item.storageConditions.length > 8 ? item.storageConditions.substring(0, 8) + '...' : item.storageConditions) : "N/A"}
              </div>
            </div>
          </div>
        </div>

        <div className="patient-contact-grid">
          <DetailRow icon={Icons.mapPin} value={item.location} />
          <DetailRow icon={Icons.thermometer} value={item.storageConditions} truncate />
          {item.expiryDate && (
            <DetailRow icon={Icons.clock} value={`Exp: ${new Date(item.expiryDate).toLocaleDateString()}`} />
          )}
        </div>
      </div>

      <div className="sidebar-detail-grid" style={{ gridTemplateColumns: "1fr" }}>
        <div className="detail-item">
          <div className="detail-value">{item.manufacturer || "Not assigned"}</div>
          <div className="detail-label">Manufacturer / Brand</div>
        </div>
        <div className="detail-item">
          <div className="detail-value">{item.category}</div>
          <div className="detail-label">Category</div>
        </div>
        <div className="detail-item">
          <div className="detail-value">{item.sku || "N/A"}</div>
          <div className="detail-label">SKU / Item Code</div>
        </div>
      </div>
    </div>
  );
}

export default memo(InventorySidebar);
