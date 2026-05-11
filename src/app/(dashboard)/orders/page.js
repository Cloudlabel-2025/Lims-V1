"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Icons } from "@/app/components/Icons";
import { hasPermission } from "@/app/lib/client-rbac";
import { useCurrentUser } from "@/app/lib/use-current-user";

export default function OrdersPage() {
  const user = useCurrentUser();
  const [patients, setPatients] = useState([]);
  const [tests, setTests] = useState([]);
  const [orders, setOrders] = useState([]);
  const [patient, setPatient] = useState("");
  const [selectedTests, setSelectedTests] = useState([]);
  const [priority, setPriority] = useState("routine");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedTotal = useMemo(
    () =>
      tests
        .filter((test) => selectedTests.includes(test._id))
        .reduce((sum, test) => sum + (Number(test.price) || 0), 0),
    [tests, selectedTests]
  );
  const canCreateOrders = hasPermission(user, "orders.create");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [patientResponse, testResponse, orderResponse] = await Promise.all([
        canCreateOrders ? fetch("/api/patient", { credentials: "include" }) : Promise.resolve(null),
        canCreateOrders ? fetch("/api/tests/definitions?status=active", { credentials: "include" }) : Promise.resolve(null),
        fetch("/api/orders", { credentials: "include" }),
      ]);
      const [patientData, testData, orderData] = await Promise.all([
        patientResponse ? patientResponse.json() : Promise.resolve([]),
        testResponse ? testResponse.json() : Promise.resolve({ tests: [] }),
        orderResponse.json(),
      ]);

      if (patientResponse && !patientResponse.ok) throw new Error(patientData.error || "Unable to load patients");
      if (testResponse && !testResponse.ok) throw new Error(testData.error || "Unable to load tests");
      if (!orderResponse.ok) throw new Error(orderData.error || "Unable to load orders");

      setPatients(Array.isArray(patientData) ? patientData : []);
      setTests(testData.tests || []);
      setOrders(orderData.orders || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [canCreateOrders]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function toggleTest(testId) {
    setSelectedTests((current) =>
      current.includes(testId)
        ? current.filter((id) => id !== testId)
        : [...current, testId]
    );
  }

  async function createOrder(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ patient, tests: selectedTests, priority, notes }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.details || "Unable to create order");

      setOrders((current) => [data.order, ...current]);
      setPatient("");
      setSelectedTests([]);
      setPriority("routine");
      setNotes("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="module-page">Loading orders...</div>;

  return (
    <div className="billing-module-page" style={{ padding: '4px' }}>
      
      {/* PAGE HEADER */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="page-header-icon" style={{ background: 'var(--primary-50)', color: 'var(--primary)' }}>
            {Icons.logo}
          </div>
          <div className="page-header-text">
            <h4 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>Billing & Registration</h4>
            <small style={{ color: 'var(--text-secondary)' }}>Create orders, apply discounts and record payments</small>
          </div>
        </div>
      </div>

      {error && <div className="module-alert">{error}</div>}

      <div className="module-grid">
        {canCreateOrders && (
        <section className="module-panel">
          <div className="module-panel-header">
            <h2>Create Order</h2>
            <p>Select patient and one or more active test definitions.</p>
          </div>

          {/* 3. Payment Breakdown */}
          <div className="form-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h6 style={{ fontSize: '13px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-muted)' }}>3. Payment Breakdown</h6>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Split Payment</span>
                <div 
                  onClick={() => setIsSplitPayment(!isSplitPayment)}
                  style={{ width: '40px', height: '20px', background: isSplitPayment ? 'var(--primary)' : 'var(--border)', borderRadius: '10px', position: 'relative', cursor: 'pointer', transition: 'all 0.3s' }}
                >
                  <div style={{ width: '16px', height: '16px', background: '#fff', borderRadius: '50%', position: 'absolute', top: '2px', left: isSplitPayment ? '22px' : '2px', transition: 'all 0.3s' }}></div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {payments.map((p, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '12px', alignItems: 'center' }}>
                  <select className="lims-input" value={p.mode} onChange={(e) => updatePayment(idx, "mode", e.target.value)}>
                    {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: '700', color: 'var(--text-muted)' }}>₹</span>
                    <input 
                      type="number" 
                      className="lims-input" 
                      style={{ paddingLeft: '28px' }} 
                      value={p.amount} 
                      onChange={(e) => updatePayment(idx, "amount", e.target.value)} 
                    />
                  </div>
                  {isSplitPayment && idx > 0 && (
                    <button style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer' }} onClick={() => removePaymentRow(idx)}>{Icons.trash}</button>
                  )}
                </div>
              ))}
              {isSplitPayment && (
                <button 
                  onClick={addPaymentRow}
                  style={{ border: '1.5px dashed var(--primary)', background: 'var(--primary-50)', color: 'var(--primary)', padding: '10px', borderRadius: '10px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', marginTop: '8px' }}
                >
                  + Add Payment Mode
                </button>
              )}
            </div>

            <div style={{ marginTop: '20px', padding: '12px', borderRadius: '10px', background: balanceDue === 0 ? '#f0fdf4' : '#fff7ed', border: balanceDue === 0 ? '1px solid #bbf7d0' : '1px solid #ffedd5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: balanceDue === 0 ? '#166534' : '#9a3412' }}>
                {balanceDue === 0 ? "Full Amount Covered" : balanceDue > 0 ? `Remaining: ₹${balanceDue}` : `Excess: ₹${Math.abs(balanceDue)}`}
              </div>
              <div style={{ height: '6px', width: '100px', background: 'rgba(0,0,0,0.05)', borderRadius: '3px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, (totalPaid / netAmount) * 100)}%`, background: balanceDue === 0 ? '#22c55e' : 'var(--primary)', transition: 'width 0.3s' }}></div>
              </div>
            </div>
          </div>
        </section>
        )}

        <aside className="module-panel">
          <div className="module-panel-header">
            <h2>Recent Orders</h2>
            <p>{orders.length} orders listed</p>
          </div>
          <div className="test-card-list">
            {orders.map((order) => (
              <article key={order._id} className="test-card">
                <div>
                  <h3>{order.orderId}</h3>
                  <span>{order.patient?.name} · {order.items?.length || 0} tests</span>
                </div>
              </div>

              <button className="btn-lims-primary" style={{ width: '100%', height: '54px', fontSize: '16px' }} disabled={!selectedPatient || cart.length === 0}>
                Complete Order & Print
              </button>
            </div>
          </div>
        </aside>
      </div>

      <style jsx>{`
        .search-result-item:hover {
          background: var(--surface);
        }
        .search-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid var(--border);
          border-top-color: var(--primary);
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
