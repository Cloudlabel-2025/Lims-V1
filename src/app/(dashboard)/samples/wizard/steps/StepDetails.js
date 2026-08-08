"use client";

import { Icons } from "@/app/components/Icons";

export default function StepDetails({ sample, onNext, inventoryItems = [], uoms = [], reservedInventory = [], setReservedInventory }) {

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
          return { ...row, searchQuery: value, isOpen: true };
        }
        if (field === "isOpen") {
          return { ...row, isOpen: value };
        }
        return { ...row, [field]: value };
      })
    );
  };

  const removeInventoryRow = (index) => {
    setReservedInventory(reservedInventory.filter((_, i) => i !== index));
  };

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Sample Details</h2>

      <div className="row g-3" style={{ marginBottom: 24 }}>
        <div className="col-md-4">
          <div className="wizard-info-card">
            <small className="text-muted">Sample ID</small>
            <strong>{sample.sampleId}</strong>
          </div>
        </div>
        <div className="col-md-4">
          <div className="wizard-info-card">
            <small className="text-muted">Status</small>
            <strong>{sample.status}</strong>
          </div>
        </div>
        <div className="col-md-4">
          <div className="wizard-info-card">
            <small className="text-muted">Patient Name</small>
            <strong>{sample.patient?.name || "-"}</strong>
          </div>
        </div>
        <div className="col-md-4">
          <div className="wizard-info-card">
            <small className="text-muted">Patient ID</small>
            <strong>{sample.patient?.patientId || "-"}</strong>
          </div>
        </div>
        <div className="col-md-4">
          <div className="wizard-info-card">
            <small className="text-muted">Age / Gender</small>
            <strong>{sample.patient?.age || "-"} / {sample.patient?.gender || "-"}</strong>
          </div>
        </div>
        <div className="col-md-4">
          <div className="wizard-info-card">
            <small className="text-muted">Test Name</small>
            <strong>{sample.testSnapshot?.name || "-"}</strong>
          </div>
        </div>
        <div className="col-md-4">
          <div className="wizard-info-card">
            <small className="text-muted">Category</small>
            <strong>{sample.testSnapshot?.categoryName || "-"}</strong>
          </div>
        </div>
        <div className="col-md-4">
          <div className="wizard-info-card">
            <small className="text-muted">Sample Type</small>
            <strong>{sample.sampleType || sample.testSnapshot?.sampleType || "-"}</strong>
          </div>
        </div>
      </div>

      {/* Inventory Consumption (Optional) */}
      <div className="form-card" style={{ marginBottom: 24 }}>
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
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="lims-label" style={{ fontSize: 11 }}>Unit of Measure</label>
                    <select
                      className="lims-select"
                      value={entry.uom}
                      onChange={(e) => updateInventoryRow(index, "uom", e.target.value)}
                      disabled
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
              No inventory items selected. Add reagents or materials consumed during sample processing.
            </p>
          )}
        </div>
      </div>

      <div className="wizard-nav">
        <div />
        <button className="dash-btn-primary" onClick={onNext}>
          Next {Icons.arrowRight}
        </button>
      </div>
    </div>
  );
}
