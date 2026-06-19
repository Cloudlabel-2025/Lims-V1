"use client";

import { useEffect } from "react";

export default function SuccessDialog({ message, onClose, title = "Completed Successfully" }) {
  useEffect(() => {
    if (!message) return undefined;

    const timer = window.setTimeout(onClose, 5000);
    return () => window.clearTimeout(timer);
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div className="cms-success-dialog-backdrop" role="presentation">
      <section
        className="cms-success-dialog"
        role="status"
        aria-live="polite"
        aria-label="Success message"
      >
        <button
          type="button"
          className="cms-success-dialog-close"
          onClick={onClose}
          aria-label="Close success message"
        >
          X
        </button>
        <div className="cms-success-dialog-icon">OK</div>
        <h2>{title}</h2>
        <p>{message}</p>
        <button type="button" className="developer-primary-link" onClick={onClose}>
          Okay
        </button>
      </section>
    </div>
  );
}
