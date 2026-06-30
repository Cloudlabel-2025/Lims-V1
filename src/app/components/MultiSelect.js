"use client";
import { useState, useRef, useEffect } from "react";
import { Icons } from "./Icons";

export default function MultiSelect({ 
  options = [], 
  value = [], 
  onChange, 
  placeholder = "Select items...", 
  name = "",
  error = false 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt => 
    !value.includes(opt.value) && 
    (opt.label.toLowerCase().includes(searchTerm.toLowerCase()) || 
     (opt.sublabel && opt.sublabel.toLowerCase().includes(searchTerm.toLowerCase())))
  );

  const handleSelect = (optionValue) => {
    const newValue = [...value, optionValue];
    onChange({ target: { name, value: newValue } });
    setSearchTerm("");
  };

  const handleRemove = (optionValue) => {
    const newValue = value.filter(v => v !== optionValue);
    onChange({ target: { name, value: newValue } });
  };

  const selectedOptions = options.filter(opt => value.includes(opt.value));

  return (
    <div className="multi-select-container" ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <div 
        className={`lims-input ${error ? 'invalid' : ''}`} 
        style={{ 
          height: "auto", 
          minHeight: "48px", 
          padding: "9px 14px", 
          display: "flex", 
          flexWrap: "wrap", 
          gap: "6px", 
          cursor: "text",
          alignItems: "center",
          borderColor: isOpen ? "var(--brand-action, var(--primary))" : (error ? "var(--error)" : "var(--border)"),
          backgroundColor: "#fff",
          transition: "all 0.15s ease",
          boxShadow: isOpen ? "0 0 0 3px var(--primary-50)" : "none"
        }}
        onClick={() => setIsOpen(true)}
      >
        {selectedOptions.map(opt => (
          <div 
            key={opt.value} 
            style={{ 
              background: "#f3f4f6", 
              color: "#374151", 
              padding: "2px 8px", 
              borderRadius: "4px", 
              fontSize: "12px", 
              fontWeight: "600",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              border: "1px solid #e5e7eb",
              userSelect: "none"
            }}
          >
            <span>{opt.label}</span>
            <span 
              onClick={(e) => { e.stopPropagation(); handleRemove(opt.value); }} 
              style={{ 
                cursor: "pointer", 
                color: "#9ca3af",
                fontSize: "14px",
                lineHeight: "1",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "14px",
                height: "14px",
                borderRadius: "50%",
                transition: "all 0.15s ease"
              }}
              onMouseEnter={(e) => { e.target.style.background = "#d1d5db"; e.target.style.color = "#4b5563"; }}
              onMouseLeave={(e) => { e.target.style.background = "transparent"; e.target.style.color = "#9ca3af"; }}
            >
              ×
            </span>
          </div>
        ))}
        <input
          type="text"
          style={{ 
            border: "none", 
            outline: "none", 
            flex: 1, 
            minWidth: "120px", 
            background: "transparent",
            fontSize: "13.5px",
            padding: "4px 0",
            color: "var(--text)",
            margin: 0
          }}
          placeholder={value.length === 0 ? placeholder : ""}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => setIsOpen(true)}
          autoComplete="off"
        />
        <div style={{ 
          color: "#9ca3af", 
          fontSize: "10px", 
          marginLeft: "auto",
          pointerEvents: "none",
          transform: isOpen ? "rotate(180deg)" : "none",
          transition: "transform 0.2s"
        }}>
          {Icons.chevronDown || "▼"}
        </div>
      </div>

      {isOpen && (
        <div className="multi-select-dropdown" style={{
          position: "absolute",
          top: "calc(100% + 4px)",
          left: 0,
          right: 0,
          background: "#fff",
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--border)",
          boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
          maxHeight: "260px",
          overflowY: "auto",
          zIndex: 1000
        }}>
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <div
                key={option.value}
                onClick={() => handleSelect(option.value)}
                style={{
                  padding: "10px 14px",
                  cursor: "pointer",
                  borderBottom: "1px solid #f3f4f6",
                  transition: "background 0.15s ease"
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f9fafb"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: "600", fontSize: "13px", color: "var(--text)" }}>{option.label}</div>
                    {option.sublabel && <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px", fontWeight: "500", textTransform: "uppercase", letterSpacing: "0.2px" }}>{option.sublabel}</div>}
                  </div>
                  <div style={{ color: "var(--brand-action, var(--primary))", opacity: 0.5 }}>
                    {Icons.plus}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div style={{ padding: "24px", textAlign: "center", color: "#9ca3af", fontSize: "13px" }}>
              {searchTerm ? "No tests found" : "Start typing to search..."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

