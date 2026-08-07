"use client";

import { useState, useRef, useEffect } from "react";
import { format, parse, isValid } from "date-fns";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";

function ScrollableDropdown({ name, options, value, onChange, ...props }) {
  const [yearOpen, setYearOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!yearOpen) return;
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setYearOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [yearOpen]);

  if (name !== "year") {
    return (
      <select
        className="rdp-dropdown"
        value={value}
        onChange={onChange}
        aria-label={props["aria-label"]}
      >
        {options?.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  const selectedLabel = options?.find((o) => String(o.value) === String(value))?.label || value;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        className="rdp-dropdown"
        onClick={() => setYearOpen((p) => !p)}
        aria-label={props["aria-label"]}
        style={{ cursor: "pointer", width: "100%" }}
      >
        {selectedLabel}
      </button>
      {yearOpen && (
        <div className="date-picker-year-list">
          {options?.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={opt.disabled}
              onClick={() => { onChange({ target: { value: opt.value } }); setYearOpen(false); }}
              className={`date-picker-year-option${String(opt.value) === String(value) ? " selected" : ""}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DatePicker({ value, onChange, max, className, error, onDraftChange }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const prevValue = useRef(value);

  const selectedDate = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined;
  const displayValue = typed || (selectedDate && isValid(selectedDate) ? format(selectedDate, "dd/MM/yyyy") : "");

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (value === "" && prevValue.current !== "") setTyped("");
    prevValue.current = value;
  }, [value]);

  const maxDate = max ? (typeof max === "string" ? parse(max, "yyyy-MM-dd", new Date()) : max) : undefined;
  const minDate = new Date();
  minDate.setFullYear(minDate.getFullYear() - 150);

  function commit(date) {
    if (date && isValid(date)) {
      onChange({ target: { name: "dob", value: format(date, "yyyy-MM-dd") } });
      setTyped(format(date, "dd/MM/yyyy"));
      onDraftChange?.(format(date, "dd/MM/yyyy"));
    }
    setOpen(false);
  }

  function handleInputChange(e) {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 8);
    if (raw.length === 0) {
      setTyped("");
      onDraftChange?.("");
      onChange({ target: { name: "dob", value: "" } });
      return;
    }

    let out = "";
    // DD/MM/YYYY — build display progressively from raw digits
    if (raw.length <= 2) {
      // Still typing day
      out = raw;
    } else if (raw.length <= 4) {
      // Day complete, typing month
      out = raw.slice(0, 2) + "/" + raw.slice(2);
    } else {
      // Day and month complete, typing year
      out = raw.slice(0, 2) + "/" + raw.slice(2, 4) + "/" + raw.slice(4);
    }

    setTyped(out);
    onDraftChange?.(out);

    // Only attempt to parse a full DD/MM/YYYY (8 digits)
    if (raw.length === 8) {
      const dd = raw.slice(0, 2);
      const mm = raw.slice(2, 4);
      const yyyy = raw.slice(4, 8);
      const fullStr = dd + "/" + mm + "/" + yyyy;
      const parsed = parseTyped(fullStr);
      onChange({ target: { name: "dob", value: parsed && isValid(parsed) ? format(parsed, "yyyy-MM-dd") : "" } });
    } else {
      onChange({ target: { name: "dob", value: "" } });
    }
  }

  function parseTyped(v) {
    const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return null;
    const [, dd, mm, yyyy] = m;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd), 12, 0, 0, 0);
    if (d.getFullYear() !== Number(yyyy) || d.getMonth() !== Number(mm) - 1 || d.getDate() !== Number(dd)) return null;
    return d;
  }

  function handleInputKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      const v = typed.trim();
      if (!v) return;
      const d = parseTyped(v);
      if (d) commit(d);
    }
  }

  return (
    <div className="date-picker-container" ref={containerRef}>
      <div className="date-picker-input-wrap">
        <input
          ref={inputRef}
          type="text"
          className={`lims-input date-picker-trigger${error ? " invalid" : ""}${className ? ` ${className}` : ""}`}
          placeholder="DD/MM/YYYY"
          value={displayValue}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown}
        />
        <svg
          className="date-picker-cal-icon"
          width="18" height="18" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round"
          onMouseDown={(e) => { e.preventDefault(); inputRef.current?.focus(); }}
          onClick={() => setOpen((prev) => !prev)}
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </div>
      {open && (
        <div className="date-picker-popover">
          <DayPicker
            mode="single"
            captionLayout="dropdown"
            startMonth={new Date(minDate.getFullYear(), 0, 1)}
            endMonth={new Date(new Date().getFullYear(), 11, 31)}
            selected={selectedDate && isValid(selectedDate) ? selectedDate : undefined}
            onSelect={(date) => {
              if (date && isValid(date)) {
                commit(date);
              }
            }}
            disabled={[
              { before: minDate },
              ...(maxDate ? [{ after: maxDate }] : []),
            ]}
            defaultMonth={selectedDate && isValid(selectedDate) ? selectedDate : undefined}
            components={{ Dropdown: ScrollableDropdown }}
          />
        </div>
      )}
    </div>
  );
}
