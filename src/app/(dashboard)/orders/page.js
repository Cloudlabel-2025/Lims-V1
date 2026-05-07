"use client";

import { useEffect, useMemo, useState } from "react";
import { Icons } from "@/app/components/Icons";

export default function OrdersPage() {
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

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [patientResponse, testResponse, orderResponse] = await Promise.all([
        fetch("/api/patient", { credentials: "include" }),
        fetch("/api/tests/definitions?status=active", { credentials: "include" }),
        fetch("/api/orders", { credentials: "include" }),
      ]);
      const [patientData, testData, orderData] = await Promise.all([
        patientResponse.json(),
        testResponse.json(),
        orderResponse.json(),
      ]);

      if (!patientResponse.ok) throw new Error(patientData.error || "Unable to load patients");
      if (!testResponse.ok) throw new Error(testData.error || "Unable to load tests");
      if (!orderResponse.ok) throw new Error(orderData.error || "Unable to load orders");

      setPatients(Array.isArray(patientData) ? patientData : []);
      setTests(testData.tests || []);
      setOrders(orderData.orders || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

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
    <div className="module-page">
      <div className="module-header">
        <div>
          <p className="module-kicker">Test Orders</p>
          <h1>Orders</h1>
          <span>Create patient test orders and generate pending samples.</span>
        </div>
        <button className="dash-btn-secondary" type="button" onClick={loadData}>
          {Icons.logo} Refresh
        </button>
      </div>

      {error && <div className="module-alert">{error}</div>}

      <div className="module-grid">
        <section className="module-panel">
          <div className="module-panel-header">
            <h2>Create Order</h2>
            <p>Select patient and one or more active test definitions.</p>
          </div>

          <form className="module-form" onSubmit={createOrder}>
            <div className="module-form-grid">
              <label>
                Patient
                <select value={patient} onChange={(e) => setPatient(e.target.value)} required>
                  <option value="">Select patient</option>
                  {patients.map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.name} · {item.patientId}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Priority
                <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                  <option value="routine">Routine</option>
                  <option value="urgent">Urgent</option>
                </select>
              </label>
            </div>

            <div className="order-test-grid">
              {tests.map((test) => (
                <label key={test._id} className={`order-test-option ${selectedTests.includes(test._id) ? "selected" : ""}`}>
                  <input
                    type="checkbox"
                    checked={selectedTests.includes(test._id)}
                    onChange={() => toggleTest(test._id)}
                  />
                  <span>
                    <strong>{test.name}</strong>
                    <small>{test.category?.name || "General"} · {test.parameters?.length || 0} params</small>
                  </span>
                  <em>₹{Number(test.price || 0).toFixed(0)}</em>
                </label>
              ))}
            </div>

            <label className="module-full-label">
              Notes
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Optional order notes" />
            </label>

            <div className="order-total-row">
              <span>{selectedTests.length} tests selected</span>
              <strong>₹{selectedTotal.toFixed(0)}</strong>
            </div>

            <button className="dash-btn-primary module-save" disabled={!patient || selectedTests.length === 0 || saving}>
              {saving ? "Creating..." : "Create Order And Samples"}
            </button>
          </form>
        </section>

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
                <strong>{order.status}</strong>
              </article>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
