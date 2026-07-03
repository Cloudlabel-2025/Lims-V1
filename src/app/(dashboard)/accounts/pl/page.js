"use client";
import { useState, useEffect } from "react";
import { Icons } from "@/app/components/Icons";
import { money, inputStyle } from "../_components/helpers";
import Field from "../_components/Field";

function PlStatement({ pl }) {
  const { revenue, expenses, totalRevenue, totalExpenses, netProfit } = pl;
  const isProfit = netProfit >= 0;
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        <div className="form-card" style={{ padding: 18, borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 800 }}>TOTAL REVENUE</div>
          <div style={{ marginTop: 8, fontSize: 22, fontWeight: 900, color: "#047857" }}>Rs {money(totalRevenue)}</div>
        </div>
        <div className="form-card" style={{ padding: 18, borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 800 }}>TOTAL EXPENSES</div>
          <div style={{ marginTop: 8, fontSize: 22, fontWeight: 900, color: "#b91c1c" }}>Rs {money(totalExpenses)}</div>
        </div>
        <div className="form-card" style={{ padding: 18, borderRadius: 8, background: isProfit ? "#ecfdf5" : "#fef2f2" }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 800 }}>NET {isProfit ? "PROFIT" : "LOSS"}</div>
          <div style={{ marginTop: 8, fontSize: 22, fontWeight: 900, color: isProfit ? "#047857" : "#b91c1c" }}>Rs {money(Math.abs(netProfit))}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div className="form-card" style={{ padding: 0, borderRadius: 8, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", background: "var(--surface)", borderBottom: "1px solid var(--border)", fontSize: 13, fontWeight: 800 }}>Revenue</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <tbody>
              {revenue.map((a) => (
                <tr key={a.code} style={{ borderBottom: "1px solid var(--border-light)" }}>
                  <td style={{ padding: "10px 16px", color: "var(--text-secondary)" }}>{a.code}</td>
                  <td style={{ padding: "10px 16px" }}>{a.name}</td>
                  <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 700, color: "#047857" }}>Rs {money(a.balance)}</td>
                </tr>
              ))}
              {revenue.length === 0 && <tr><td colSpan={3} style={{ padding: 20, textAlign: "center", color: "var(--text-muted)" }}>No revenue entries</td></tr>}
              <tr style={{ background: "var(--surface)", borderTop: "2px solid var(--border)" }}>
                <td colSpan={2} style={{ padding: "10px 16px", fontWeight: 800 }}>Total Revenue</td>
                <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 900, color: "#047857" }}>Rs {money(totalRevenue)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="form-card" style={{ padding: 0, borderRadius: 8, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", background: "var(--surface)", borderBottom: "1px solid var(--border)", fontSize: 13, fontWeight: 800 }}>Expenses</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <tbody>
              {expenses.map((a) => (
                <tr key={a.code} style={{ borderBottom: "1px solid var(--border-light)", background: a.subtype === "referral-commission-expense" ? "#fffbeb" : "transparent" }}>
                  <td style={{ padding: "10px 16px", color: "var(--text-secondary)" }}>{a.code}</td>
                  <td style={{ padding: "10px 16px" }}>
                    {a.name}
                    {a.subtype === "referral-commission-expense" && (
                      <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 800, color: "#b45309", background: "#fef3c7", padding: "2px 6px", borderRadius: 4 }}>Doctor Payout</span>
                    )}
                  </td>
                  <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 700, color: "#b91c1c" }}>Rs {money(a.balance)}</td>
                </tr>
              ))}
              {expenses.length === 0 && <tr><td colSpan={3} style={{ padding: 20, textAlign: "center", color: "var(--text-muted)" }}>No expense entries</td></tr>}
              <tr style={{ background: "var(--surface)", borderTop: "2px solid var(--border)" }}>
                <td colSpan={2} style={{ padding: "10px 16px", fontWeight: 800 }}>Total Expenses</td>
                <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 900, color: "#b91c1c" }}>Rs {money(totalExpenses)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function PlPage() {
  const [pl, setPl] = useState(null);
  const [plFilter, setPlFilter] = useState({ from: "", to: "" });
  const [plLoading, setPlLoading] = useState(false);
  const [error, setError] = useState("");

  async function fetchJson(url) {
    const response = await fetch(url, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  async function loadPl(from, to) {
    setError("");
    if (from && to && new Date(from) > new Date(to)) {
      setError("To date must be after From date");
      return;
    }
    setPlLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const data = await fetchJson(`/api/accounting/pl?${params.toString()}`);
      setPl(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setPlLoading(false);
    }
  }

  useEffect(() => {
    if (!pl) loadPl("", "");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div className="form-card" style={{ padding: 14, borderRadius: 8, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, alignItems: "end" }}>
        <Field label="From">
          <input type="date" className="lims-input" value={plFilter.from} onChange={(e) => { setPlFilter({ ...plFilter, from: e.target.value }); setError(""); }} style={inputStyle()} />
        </Field>
        <Field label="To">
          <input type="date" className="lims-input" value={plFilter.to} onChange={(e) => { setPlFilter({ ...plFilter, to: e.target.value }); setError(""); }} style={inputStyle()} />
        </Field>
        <button type="button" className="btn-lims-primary" onClick={() => loadPl(plFilter.from, plFilter.to)} style={{ height: 38 }}>
          {plLoading ? "Loading..." : "Apply"}
        </button>
      </div>
      {error && <div style={{ padding: "10px 14px", borderRadius: 8, background: "#fef2f2", color: "#b91c1c", fontSize: 13, fontWeight: 700 }}>{error}</div>}
      {plLoading ? (
        <div className="form-card" style={{ padding: 28, borderRadius: 8 }}>Loading P&L...</div>
      ) : (
        pl && <PlStatement pl={pl} />
      )}
    </div>
  );
}
