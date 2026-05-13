"use client";
import { useEffect, useRef, useState } from "react";
import { Icons } from "./Icons";

export default function SearchableSelect({
  options = [],
  value = "",
  onChange,
  placeholder = "Select...",
  name = "",
  className = "",
  error = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef(null);
  const selectedOption = options.find((opt) => opt.value === value);
  const selectedLabel = selectedOption?.label || "";
  const inputValue = isOpen ? searchTerm : selectedLabel;

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

  const activeSearch = isOpen ? searchTerm.trim().toLowerCase() : "";
  const filteredOptions = options.filter((opt) => {
    if (!activeSearch) return true;

    return (
      opt.label.toLowerCase().includes(activeSearch) ||
      (opt.sublabel && opt.sublabel.toLowerCase().includes(activeSearch)) ||
      (opt.searchTerms && opt.searchTerms.toLowerCase().includes(activeSearch))
    );
  });

  const handleSelect = (option) => {
    onChange({ target: { name, value: option.value } });
    setSearchTerm("");
    setIsOpen(false);
  };

  const handleInputChange = (event) => {
    const nextValue = event.target.value;
    setSearchTerm(nextValue);

    if (!isOpen) setIsOpen(true);
    if (nextValue === "") {
      onChange({ target: { name, value: "" } });
    }
  };

  const handleFocus = () => {
    setIsOpen(true);
    setSearchTerm("");
  };

  return (
    <div
      className="searchable-select-container"
      ref={containerRef}
      style={{ position: "relative", zIndex: isOpen ? 100 : 1 }}
    >
      <div className="searchable-select-input-wrapper">
        <input
          type="text"
          className={`lims-input ${className} ${error ? "invalid" : ""}`}
          placeholder={placeholder}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          autoComplete="off"
        />
        <div
          className="searchable-select-icon"
          style={{
            position: "absolute",
            right: "12px",
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--text-muted)",
            pointerEvents: "none",
          }}
        >
          {Icons.chevronDown || "v"}
        </div>
      </div>

      {isOpen && (
        <div
          className="searchable-select-dropdown"
          style={{
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
            zIndex: 1000,
          }}
        >
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
                  backgroundColor: value === option.value ? "var(--primary-50)" : "transparent",
                }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.backgroundColor = "var(--primary-50)";
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.backgroundColor =
                    value === option.value ? "var(--primary-50)" : "transparent";
                }}
              >
                <div
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                >
                  <div
                    style={{
                      fontWeight: value === option.value ? "600" : "400",
                      color: value === option.value ? "var(--primary-600)" : "inherit",
                    }}
                  >
                    {option.label}
                  </div>
                  {option.sublabel && (
                    <div
                      style={{
                        fontSize: "11px",
                        color: "var(--text-muted)",
                        background: "var(--surface)",
                        padding: "2px 6px",
                        borderRadius: "4px",
                      }}
                    >
                      {option.sublabel}
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div
              style={{
                padding: "12px",
                textAlign: "center",
                color: "var(--text-muted)",
                fontSize: "12px",
              }}
            >
              No matches found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
