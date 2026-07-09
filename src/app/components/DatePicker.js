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

export default function DatePicker({ value, onChange, max, className, error }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const pickingRef = useRef(false);

  const selectedDate = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined;
  const displayValue = typed || (selectedDate && isValid(selectedDate) ? format(selectedDate, "dd-MM-yyyy") : "");

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const maxDate = max ? (typeof max === "string" ? parse(max, "yyyy-MM-dd", new Date()) : max) : undefined;

  function commit(date) {
    if (date && isValid(date)) {
      onChange({ target: { name: "dob", value: format(date, "yyyy-MM-dd") } });
    }
    setTyped("");
    setOpen(false);
  }

  function handleInputChange(e) {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 8);
    if (raw.length === 0) { setTyped(""); return; }

    let rem = raw;
    let day = "", month = "", year = "";

    // Day — always 2-digit padded, with smart split if > 31
    if (rem.length >= 2) {
      const d = parseInt(rem.slice(0, 2), 10);
      if (d >= 1 && d <= 31) {
        day = rem.slice(0, 2);
        rem = rem.slice(2);
      } else {
        day = "0" + rem[0];
        rem = rem.slice(1);
      }
    } else {
      day = rem;
      rem = "";
    }

    // Month — 2-digit when possible, always padded; smart split if > 12
    if (rem.length >= 2) {
      const m = parseInt(rem.slice(0, 2), 10);
      if (m >= 1 && m <= 12) {
        month = rem.slice(0, 2);
        rem = rem.slice(2);
      } else {
        month = "0" + rem[0];
        rem = rem.slice(1);
      }
    } else if (rem.length === 1) {
      month = "0" + rem;
      rem = "";
    }

    // Year — up to 4 remaining digits
    if (rem.length > 0) {
      year = rem.slice(0, 4);
    }

    // Validate year range only when all 4 year digits are in
    if (year.length === 4) {
      const y = parseInt(year, 10);
      const cur = new Date().getFullYear();
      if (y < 1941 || y > cur) return;
      const full = day + "-" + month + "-" + year;
      if (!parse(full, "dd-MM-yyyy", new Date())) return;
    }

    // Validate full date when complete
    if (day.length === 2 && month.length === 2 && year.length === 4) {
      const full = day + "-" + month + "-" + year;
      if (!isValid(parse(full, "dd-MM-yyyy", new Date()))) return;
    }

    // Build display
    let out = day;
    if (month) out += "-" + month;
    if (year) out += "-" + year;
    setTyped(out);
  }

  function parseTyped(v) {
    const d = parse(v, "dd-MM-yyyy", new Date());
    if (isValid(d)) return d;
    return null;
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

  function handleInputBlur() {
    if (pickingRef.current) {
      pickingRef.current = false;
      return;
    }
    if (!open) {
      const v = typed.trim();
      if (!v) {
        if (selectedDate && isValid(selectedDate)) {
          setTyped("");
        }
        return;
      }
      const d = parseTyped(v);
      if (d) commit(d);
      else setTyped("");
    }
  }

  return (
    <div className="date-picker-container" ref={containerRef}>
      <div className="date-picker-input-wrap">
        <input
          ref={inputRef}
          type="text"
          className={`lims-input date-picker-trigger${error ? " invalid" : ""}${className ? ` ${className}` : ""}`}
          placeholder="DD-MM-YYYY"
          value={displayValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
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
        <div
          className="date-picker-popover"
          onMouseDown={() => { pickingRef.current = true; }}
          onMouseUp={() => { pickingRef.current = false; }}
        >
          <DayPicker
            mode="single"
            captionLayout="dropdown"
            startMonth={new Date(1940, 0, 1)}
            endMonth={new Date(new Date().getFullYear(), 11, 31)}
            selected={selectedDate && isValid(selectedDate) ? selectedDate : undefined}
            onSelect={(date) => {
              if (date && isValid(date)) {
                commit(date);
              }
            }}
            disabled={[
              { before: new Date(1941, 0, 1) },
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
