"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DoctorLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          subdomain: subdomain.trim(),
          portalType: "doctor",
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Doctor login failed. Check your credentials.");
      }

      router.push("/doctor/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", padding: 20 }}>
      <div style={{ maxWidth: 420, width: "100%", background: "#ffffff", padding: 32, borderRadius: 12, boxShadow: "0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.05)", border: "1px solid #e2e8f0" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <span style={{ fontSize: 32 }}>🩺</span>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", marginTop: 8, marginBottom: 4 }}>Doctor Portal Login</h2>
          <p style={{ fontSize: 13, color: "#64748b" }}>Access your referred patients, test packages &amp; reports</p>
        </div>

        {error && (
          <div style={{ padding: "10px 14px", borderRadius: 8, background: "#fee2e2", border: "1px solid #fca5a5", color: "#991b1b", fontSize: 13, marginBottom: 18 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>Laboratory Subdomain (Optional)</label>
            <input
              type="text"
              className="lims-input"
              placeholder="e.g. citylab"
              value={subdomain}
              onChange={(e) => setSubdomain(e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>Email or Doctor ID</label>
            <input
              type="email"
              required
              className="lims-input"
              placeholder="doctor@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>Password</label>
            <input
              type="password"
              required
              className="lims-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="btn-lims-primary"
            disabled={loading}
            style={{ width: "100%", padding: "10px 0", fontSize: 14, fontWeight: 700, marginTop: 8 }}
          >
            {loading ? "Signing in..." : "Sign in to Doctor Portal"}
          </button>
        </form>
      </div>
    </div>
  );
}
