"use client";

import { useState } from "react";
import { Icons } from "@/app/components/Icons";

export default function PasswordField({
  id,
  name,
  value,
  onChange,
  placeholder,
  autoComplete = "new-password",
  required = false,
  minLength,
  invalid = false,
  toggleLabel = "password",
}) {
  const [visible, setVisible] = useState(false);
  const hasValue = Boolean(value);

  return (
    <div className="password-field-wrapper">
      <input
        id={id}
        className={invalid ? "invalid" : ""}
        type={visible ? "text" : "password"}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
      />
      {hasValue && (
        <button
          type="button"
          className="password-toggle-button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? `Hide ${toggleLabel}` : `Show ${toggleLabel}`}
          title={visible ? `Hide ${toggleLabel}` : `Show ${toggleLabel}`}
        >
          {visible ? Icons.eyeOff : Icons.eye}
        </button>
      )}
    </div>
  );
}
