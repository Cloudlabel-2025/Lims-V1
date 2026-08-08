"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icons } from "@/app/components/Icons";
import SuccessDialog from "@/app/components/SuccessDialog";
import { cachedJsonFetch, clearCachedApi } from "@/app/lib/use-current-user";
import { getISTNow } from "@/app/utils/patient-helpers";

export default function SampleRegistration() {
  const router = useRouter();
  const [patients, setPatients] = useState([]);
  const [tests, setTests] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [uoms, setUoms] = useState([]);
  const [reservedInventory, setReservedInventory] = useState([]);
  const [form, setForm] = useState({ patient: "", testDefinition: "", sampleType: "", batchId: "", collectionTime: "", receivedTime: "" });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    setForm((prev) => ({ ...prev, receivedTime: getISTNow() }));
    async function fetchData() {
      try {
        const [patRes, testRes, invRes] = await Promise.all([
          cachedJsonFetch("/api/patient", { ttl: 15_000 }),
          cachedJsonFetch("/api/tests/definitions", { ttl: 30_000 }),
          fetch("/api/inventory?limit=100").then(r => r.json()).catch(() => ({})),
        ]);
        if (patRes.response?.ok || patRes.patients) setPatients(patRes.patients || patRes.data?.patients || []);
        if (testRes.response?.ok || testRes.tests) setTests(testRes.tests || testRes.data?.tests || []);
        if (invRes.items) setInventoryItems(invRes.items || []);
        if (invRes.uoms) setUoms(invRes.uoms || []);
      } catch (err) {
        console.error("Failed to fetch registration data:", err);
      }
    }
    fetchData();
  }, []);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => {
      let cleaned = value;
      if (name === "sampleType") cleaned = value.replace(/[^a-zA-Z0-9 ]/g, "").slice(0, 25);
      if (name === "batchId") cleaned = value.replace(/[^a-zA-Z0-9-]/g, "").toUpperCase().slice(0, 15);
      return { ...prev, [name]: cleaned };
    });
  }

  const addInventoryRow = () => {
    setReservedInventory([...reservedInventory, { item: "", quantity: "", uom: "", searchQuery: "", isOpen: false }]);
  };

  const updateInventoryRow = (index, field, value) => {
    setReservedInventory(
      reservedInventory.map((row, i) => {
        if (i !== index) return row;
        if (field === "item") {
          const selectedItem = inventoryItems.find((inv) => inv._id === value);
          const uomId = selectedItem?.baseUom?._id || selectedItem?.baseUom || "";
          return {
            ...row,
            item: value,
            uom: uomId,
            searchQuery: selectedItem ? `${selectedItem.itemCode} - ${selectedItem.name}` : "",
            isOpen: false
          };
        }
        if (field === "search") {
          const matchedItem = inventoryItems.find(
            (inv) => `${inv.itemCode} - ${inv.name}`.toLowerCase() === value.toLowerCase()
          );
          return {
            ...row,
            searchQuery: value,
            item: matchedItem ? matchedItem._id : "",
            uom: matchedItem ? (matchedItem.baseUom?._id || matchedItem.baseUom || "") : "",
            isOpen: true
          };
        }
        return { ...row, [field]: value };
      })
    );
  };

  const removeInventoryRow = (index) => {
    setReservedInventory(reservedInventory.filter((_, i) => i !== index));
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!form.patient) { setError("Please select a patient"); return; }
    if (!form.testDefinition) { setError("Please select a test"); return; }

    const newErrors = {};
    if (!form.receivedTime) newErrors.receivedTime = "Received time is required";
    else if (isNaN(new Date(form.receivedTime).getTime())) newErrors.receivedTime = "Invalid received time";
    else if (new Date(form.receivedTime) > new Date()) newErrors.receivedTime = "Received time cannot be in the future";
    if (form.collectionTime) {
      if (isNaN(new Date(form.collectionTime).getTime())) newErrors.collectionTime = "Invalid collection time";
      else if (new Date(form.collectionTime) > new Date()) newErrors.collectionTime = "Collection time cannot be in the future";
      else if (new Date(form.receivedTime) < new Date(form.collectionTime)) newErrors.collectionTime = "Collection time must be before received time";
    }
    const patient = patients.find((p) => p._id === form.patient);
    if (patient?.dob) {
      const dobDate = new Date(patient.dob);
      if (form.collectionTime && new Date(form.collectionTime) < dobDate) newErrors.collectionTime = "Collection time cannot be before date of birth";
      if (form.receivedTime && new Date(form.receivedTime) < dobDate) newErrors.receivedTime = "Received time cannot be before date of birth";
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setError("Please correct the highlighted errors.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/samples", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...form,
          reservedInventory: reservedInventory.filter(ri => ri.item && ri.quantity && ri.uom)
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to register sample");

      clearCachedApi("/api/samples?status=all");
      clearCachedApi("/api/dashboard/stats");

      setSuccess(`Sample ${data.sample.sampleId} registered successfully.`);
      setForm({ patient: "", testDefinition: "", sampleType: "", batchId: "", collectionTime: "", receivedTime: getISTNow() });
      setReservedInventory([]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-icon">{Icons.vial}</div>
        <div className="page-header-text">
          <h4>Register Sample</h4>
          <small>Create a new sample record independent of billing</small>
        </div>
        <button className="btn-view-patients" onClick={() => router.push("/samples")}>
          {Icons.list} View Samples
        </button>
      </div>

      <SuccessDialog message={success} onClose={() => setSuccess("")} />

      {error && (
        <div className="lims-alert danger" role="alert" style={{ marginBottom: 20 }}>
          <span>{error}</span>
          <button className="lims-alert-close" onClick={() => setError("")}>{Icons.close}</button>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-card">
          <div className="form-card-header"><h6>Sample Details</h6></div>
          <div className="form-card-body">
            <div className="row g-3">
              <div className="col-md-6">
                <label className="lims-label">Patient <span className="required">*</span></label>
                <select name="patient" className="lims-select" value={form.patient} onChange={handleChange} required>
                  <option value="">Select patient</option>
                  {patients.map((p) => (
                    <option key={p._id} value={p._id}>{p.name} · {p.patientId}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-6">
                <label className="lims-label">Test <span className="required">*</span></label>
                <select name="testDefinition" className="lims-select" value={form.testDefinition} onChange={handleChange} required>
                  <option value="">Select test</option>
                  {tests.map((t) => (
                    <option key={t._id} value={t._id}>{t.name} · {t.category?.name || "General"}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-4">
                <label className="lims-label">Sample Type</label>
                <input name="sampleType" className="lims-input" value={form.sampleType} onChange={handleChange} placeholder="e.g. Blood, Urine" minLength={2} maxLength={25} />
              </div>
              <div className="col-md-4">
                <label className="lims-label">Batch / Order ID</label>
                <input name="batchId" className="lims-input" value={form.batchId} onChange={handleChange} placeholder="e.g. BATCH-001" maxLength={15} />
              </div>
            </div>
          </div>
        </div>

        <div className="form-card">
          <div className="form-card-header"><h6>Sample Timing</h6></div>
          <div className="form-card-body">
            <div className="row g-3">
              <div className="col-md-6">
                <label className="lims-label">Collection Time <span className="optional">(optional)</span></label>
                <input type="datetime-local" name="collectionTime" className={`lims-input ${errors.collectionTime ? 'invalid' : ''}`} value={form.collectionTime} onChange={handleChange} />
                {errors.collectionTime && <div className="lims-error-text">{errors.collectionTime}</div>}
              </div>
              <div className="col-md-6">
                <label className="lims-label">Received Time <span className="required">*</span></label>
                <input type="datetime-local" name="receivedTime" className={`lims-input ${errors.receivedTime ? 'invalid' : ''}`} value={form.receivedTime} onChange={handleChange} />
                {errors.receivedTime && <div className="lims-error-text">{errors.receivedTime}</div>}
              </div>
            </div>
          </div>
        </div>

        {/* Inventory Consumption Form */}
        <div className="form-card">
          <div className="form-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h6>Inventory Consumption (Optional)</h6>
            <button
              type="button"
              className="btn-lims-secondary"
              style={{ padding: "4px 10px", fontSize: 12, height: "auto" }}
              onClick={addInventoryRow}
            >
              + Add Item Used
            </button>
          </div>
          <div className="form-card-body">
            {reservedInventory.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {reservedInventory.map((entry, index) => (
                  <div key={index} style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
                    <div style={{ flex: 2, position: "relative" }}>
                      <label className="lims-label" style={{ fontSize: 11 }}>Inventory Item</label>
                      <input
                        type="text"
                        className="lims-input"
                        placeholder="Search by name or code..."
                        value={entry.searchQuery || ""}
                        onChange={(e) => updateInventoryRow(index, "search", e.target.value)}
                        onFocus={() => updateInventoryRow(index, "isOpen", true)}
                        onBlur={() => {
                          setTimeout(() => {
                            updateInventoryRow(index, "isOpen", false);
                          }, 250);
                        }}
                        required
                      />
                      {entry.isOpen && (
                        <div style={{
                          position: "absolute",
                          top: "100%",
                          left: 0,
                          right: 0,
                          background: "#fff",
                          border: "1.5px solid var(--border, #e2e8f0)",
                          borderRadius: 6,
                          maxHeight: 180,
                          overflowY: "auto",
                          zIndex: 1000,
                          boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
                          marginTop: 4
                        }}>
                          {inventoryItems
                            .filter(item => {
                              const query = (entry.searchQuery || "").trim().toLowerCase();
                              if (!query) return true;
                              return (
                                (item.name || "").toLowerCase().includes(query) ||
                                (item.itemCode || "").toLowerCase().includes(query)
                              );
                            })
                            .map((item) => (
                              <div
                                key={item._id}
                                style={{
                                  padding: "8px 12px",
                                  cursor: "pointer",
                                  fontSize: 13,
                                  borderBottom: "1px solid #f1f5f9",
                                  transition: "background 0.2s"
                                }}
                                onMouseDown={() => {
                                  updateInventoryRow(index, "item", item._id);
                                }}
                                onMouseEnter={(e) => e.target.style.background = "#f1f5f9"}
                                onMouseLeave={(e) => e.target.style.background = "#fff"}
                              >
                                <strong>{item.itemCode}</strong> - {item.name}
                                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                                  Stock: {item.stockOnHandBase} {item.baseUom?.symbol}
                                </div>
                              </div>
                            ))
                          }
                        </div>
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="lims-label" style={{ fontSize: 11 }}>Quantity</label>
                      <input
                        type="number"
                        className="lims-input"
                        step="any"
                        min="0"
                        value={entry.quantity}
                        onChange={(e) => updateInventoryRow(index, "quantity", e.target.value)}
                        placeholder="0"
                        required
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="lims-label" style={{ fontSize: 11 }}>Unit of Measure</label>
                      <select
                        className="lims-select"
                        value={entry.uom}
                        onChange={(e) => updateInventoryRow(index, "uom", e.target.value)}
                        disabled
                        required
                      >
                        <option value="">Select UOM</option>
                        {uoms.map((uom) => (
                          <option key={uom._id} value={uom._id}>
                            {uom.name} ({uom.symbol})
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      className="btn-lims-secondary"
                      style={{ padding: "8px 12px", border: "1px solid #fee2e2", color: "#dc2626", height: 38 }}
                      onClick={() => removeInventoryRow(index)}
                      aria-label="Remove item"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: "#64748b", margin: 0, fontSize: 13 }}>
                No inventory items selected. Add reagents or materials if consumed during sample collection.
              </p>
            )}
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn-lims-secondary" onClick={() => {
            setForm({ patient: "", testDefinition: "", sampleType: "", batchId: "", collectionTime: "", receivedTime: getISTNow() });
            setReservedInventory([]);
          }}>Reset</button>
          <button type="submit" className="btn-lims-primary" disabled={loading}>{loading ? "Registering..." : "Register Sample"}</button>
        </div>
      </form>
    </>
  );
}
