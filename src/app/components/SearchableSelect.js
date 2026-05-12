"use client";
import { useState, useRef, useEffect } from "react";
import { Icons } from "./Icons";

export default function SearchableSelect({ 
  options = [], 
  value = "", 
  onChange, 
  placeholder = "Select...", 
  name = "", 
  className = "",
  error = false 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef(null);

  // Sync searchTerm with value when value changes or when dropdown opens
  useEffect(() => {
    if (value) {
      const selectedOption = options.find(opt => opt.value === value);
      if (selectedOption) setSearchTerm(selectedOption.label);
    } else {
      setSearchTerm("");
    }
  }, [value, options]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        // Reset search term to current selected value's label if user didn't pick anything
        const selectedOption = options.find(opt => opt.value === value);
        setSearchTerm(selectedOption ? selectedOption.label : "");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [value, options]);

  const filteredOptions = options.filter(opt => {
    const searchStr = searchTerm.toLowerCase();
    return (
      opt.label.toLowerCase().includes(searchStr) || 
      (opt.sublabel && opt.sublabel.toLowerCase().includes(searchStr)) ||
      (opt.searchTerms && opt.searchTerms.toLowerCase().includes(searchStr))
    );
  });

  const handleSelect = (option) => {
    onChange({ target: { name, value: option.value } });
    setSearchTerm(option.label);
    setIsOpen(false);
  };

  const handleInputChange = (e) => {
    setSearchTerm(e.target.value);
    if (!isOpen) setIsOpen(true);
    // If input is cleared, clear the value
    if (e.target.value === "") {
        onChange({ target: { name, value: "" } });
    }
  };

  return (
    <div className="searchable-select-container" ref={containerRef} style={{ position: "relative", zIndex: isOpen ? 100 : 1 }}>
      <div className="searchable-select-input-wrapper">
        <input
          type="text"
          className={`lims-input ${className} ${error ? 'invalid' : ''}`}
          placeholder={placeholder}
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          autoComplete="off"
        />
        <div className="searchable-select-icon" style={{ 
          position: "absolute", 
          right: "12px", 
          top: "50%", 
          transform: "translateY(-50%)",
          color: "var(--text-muted)",
          pointerEvents: "none"
        }}>
          {Icons.chevronDown || "▼"}
        </div>
      </div>

      {isOpen && (
        <div className="searchable-select-dropdown" style={{
          position: "absolute",
          top: "calc(100% + 4px)",
          left: 0,
          right: 0,
          background: "#fff",
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-lg)",
          maxHeight: "250px",
          overflowY: "auto",
          zIndex: 1000
        }}>
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <div
                key={option.value}
                className="searchable-select-item"
                onClick={() => handleSelect(option)}
                style={{
                  padding: "10px 14px",
                  cursor: "pointer",
                  fontSize: "13.5px",
                  borderBottom: "1px solid var(--border-light)",
                  backgroundColor: value === option.value ? "var(--primary-50)" : "transparent"
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = "var(--primary-50)"}
                onMouseLeave={(e) => e.target.style.backgroundColor = value === option.value ? "var(--primary-50)" : "transparent"}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: value === option.value ? "600" : "400", color: value === option.value ? "var(--primary-600)" : "inherit" }}>
                      {option.label}
                  </div>
                  {option.sublabel && (
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", background: "var(--surface)", padding: "2px 6px", borderRadius: "4px" }}>
                      {option.sublabel}
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div style={{ padding: "12px", textAlign: "center", color: "var(--text-muted)", fontSize: "12px" }}>
              No doctors found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
