"use client";
import { useState, useRef, useEffect } from "react";
import { Icons } from "@/app/components/Icons";

export default function DownloadDropdown({ onDownload, disabled, label = "Download" }) {
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    function handleKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  const handleSelect = async (format) => {
    setOpen(false);
    setDownloading(true);
    try {
      await onDownload(format);
    } catch (err) {
      console.error(err);
    } finally {
      setDownloading(false);
    }
  };

  const btnStyle = {
    height: 34,
    padding: "0 14px",
    fontSize: 12,
    border: "1px solid #16a34a",
    background: "#f0fdf4",
    color: "#16a34a",
    cursor: disabled || downloading ? "not-allowed" : "pointer",
    opacity: disabled || downloading ? 0.6 : 1,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    borderRadius: 6,
    position: "relative",
  };

  const itemStyle = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    fontSize: 13,
    cursor: "pointer",
    whiteSpace: "nowrap",
    border: "none",
    background: "none",
    width: "100%",
    textAlign: "left",
    color: "var(--text-main)",
  };

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        className="dash-btn-secondary"
        style={btnStyle}
        disabled={disabled || downloading}
        onClick={() => setOpen((p) => !p)}
      >
        {Icons.download} {downloading ? "Downloading..." : label} ▾
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            marginTop: 4,
            minWidth: 160,
            background: "#fff",
            border: "1px solid var(--border, #e5e7eb)",
            borderRadius: 8,
            boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
            zIndex: 10,
            overflow: "hidden",
          }}
        >
          <button
            type="button"
            style={itemStyle}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#f0fdf4"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
            onClick={() => handleSelect("xlsx")}
          >
            {Icons.download} Excel (.xlsx)
          </button>
          <button
            type="button"
            style={itemStyle}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#f0fdf4"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
            onClick={() => handleSelect("pdf")}
          >
            {Icons.report} PDF (.pdf)
          </button>
          <button
            type="button"
            style={itemStyle}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#f0fdf4"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
            onClick={() => handleSelect("csv")}
          >
            {Icons.list} CSV (.csv)
          </button>
        </div>
      )}
    </div>
  );
}
