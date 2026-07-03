"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Icons } from "@/app/components/Icons";
import SuccessDialog from "@/app/components/SuccessDialog";

const emptyItem = {
  itemCode: "",
  name: "",
  genericName: "",
  itemType: "reagent",
  category: "",
  subCategory: "",
  baseUom: "",
  purchaseUom: "",
  purchaseToBaseFactor: 1,
  openingQuantityBase: 0,
  minimumStockBase: 0,
  reorderLevelBase: 0,
  maximumStockBase: 0,
  preferredSupplier: "",
  manufacturer: "",
  storageCondition: "",
  defaultLocation: "",
  batchNo: "",
  expiryDate: "",
  costPerBaseUnit: 0,
  trackExpiry: true,
  notes: "",
};

const emptyMovement = {
  itemId: "",
  batchId: "",
  movementType: "receipt",
  quantityBase: 0,
  newBalanceBase: 0,
  batchNo: "",
  supplier: "",
  expiryDate: "",
  costPerBaseUnit: 0,
  referenceNo: "",
  reason: "",
  toLocation: "",
};

function Field({ label, children }) {
  return (
    <label style={{ display: "grid", gap: "6px", fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)" }}>
      {label}
      {children}
    </label>
  );
}

function StatCard({ icon, label, value, tone }) {
  return (
    <div className="form-card" style={{ padding: 18, borderRadius: 8, minHeight: 104 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 700 }}>{label}</div>
          <div style={{ marginTop: 8, fontSize: 24, fontWeight: 800, color: "var(--text-primary)" }}>{value}</div>
        </div>
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 8,
            display: "grid",
            placeItems: "center",
            color: tone || "var(--brand-action, var(--primary))",
            background: "var(--surface)",
            border: "1px solid var(--border)",
          }}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function Badge({ children, tone = "neutral" }) {
  const colors = {
    neutral: ["var(--surface)", "var(--text-secondary)"],
    good: ["#ecfdf5", "#047857"],
    warn: ["#fffbeb", "#b45309"],
    danger: ["#fef2f2", "#b91c1c"],
    info: ["#eff6ff", "#1d4ed8"],
  };
  const [bg, color] = colors[tone] || colors.neutral;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "4px 8px", borderRadius: 6, background: bg, color, fontSize: 12, fontWeight: 700 }}>
      {children}
    </span>
  );
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function isExponential(value) {
  if (value === undefined || value === null) return false;
  return /[eE]/.test(String(value));
}

function hasUrl(value) {
  return /https?:\/\//.test(value);
}

function isValidName(value) {
  return /^[A-Za-z0-9 .&'\/,()@_-]*$/.test(value);
}

function isLettersOnly(value) {
  return /^[A-Za-z\s]*$/.test(value);
}

function ErrorMsg({ message }) {
  return message ? <small style={{ color: "var(--error)", fontSize: 10, display: "block", marginTop: 2 }}>{message}</small> : null;
}

function inputStyle() {
  return { height: 38, fontSize: 13 };
}

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [inventory, setInventory] = useState({ categories: [], uoms: [], items: [], movements: [], stats: {} });
  const [categorySearch, setCategorySearch] = useState("");
  const [categoryForm, setCategoryForm] = useState({ name: "", code: "", parentCategory: "", description: "" });
  const [categoryFormErrors, setCategoryFormErrors] = useState({});
  const [uomForm, setUomForm] = useState({ name: "", symbol: "", type: "count", conversionToBase: 1, baseSymbol: "" });
  const [uomFormErrors, setUomFormErrors] = useState({});
  const [itemForm, setItemForm] = useState(emptyItem);
  const [itemFormErrors, setItemFormErrors] = useState({});
  const [editingItemId, setEditingItemId] = useState("");
  const [movementForm, setMovementForm] = useState(emptyMovement);
  const [movementFormErrors, setMovementFormErrors] = useState({});

  const parentCategories = inventory.categories.filter((category) => !category.parentCategory);
  const subCategories = inventory.categories.filter((category) => category.parentCategory);
  const selectedMovementItem = inventory.items.find((item) => item._id === movementForm.itemId);

  const filteredItems = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    if (!needle) return inventory.items;
    return inventory.items.filter((item) =>
      [item.name, item.itemCode, item.genericName, item.manufacturer, item.category?.name, item.subCategory?.name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    );
  }, [inventory.items, searchQuery]);

  async function loadInventory() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/inventory", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load inventory");
      setInventory(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInventory();
  }, []);

  async function postInventory(payload, success) {
    setSaving(true);
    setError("");
    setSuccessMessage("");
    try {
      const response = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save inventory");
      success?.(data);
      await loadInventory();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveItem(event) {
    event.preventDefault();

    const errors = {};
    if (!itemForm.itemCode) errors.itemCode = "Item code is required";
    else if (!isValidName(itemForm.itemCode)) errors.itemCode = "Item code contains invalid characters";
    if (hasUrl(itemForm.itemCode)) errors.itemCode = "URLs are not allowed";
    if (!itemForm.name) errors.name = "Item name is required";
    else if (!isValidName(itemForm.name)) errors.name = "Name contains invalid characters";
    if (hasUrl(itemForm.name)) errors.name = "URLs are not allowed";
    if (!itemForm.genericName) errors.genericName = "Generic name is required";
    else if (!isValidName(itemForm.genericName)) errors.genericName = "Generic name contains invalid characters";
    if (hasUrl(itemForm.genericName)) errors.genericName = "URLs are not allowed";
    if (!itemForm.category) errors.category = "Category is required";
    if (!itemForm.subCategory) errors.subCategory = "Sub category is required";
    if (!itemForm.baseUom) errors.baseUom = "Base UOM is required";
    if (!itemForm.purchaseUom) errors.purchaseUom = "Purchase UOM is required";
    if (itemForm.purchaseToBaseFactor === "" || itemForm.purchaseToBaseFactor === undefined || itemForm.purchaseToBaseFactor === null) errors.purchaseToBaseFactor = "Conversion factor is required";
    else if (isExponential(itemForm.purchaseToBaseFactor)) errors.purchaseToBaseFactor = "Exponential notation is not allowed";
    else if (Number(itemForm.purchaseToBaseFactor) <= 0) errors.purchaseToBaseFactor = "Must be greater than 0";
    if (itemForm.minimumStockBase === "" || itemForm.minimumStockBase === undefined || itemForm.minimumStockBase === null) errors.minimumStockBase = "Min stock is required";
    else if (isExponential(itemForm.minimumStockBase)) errors.minimumStockBase = "Exponential notation is not allowed";
    else if (Number(itemForm.minimumStockBase) < 0) errors.minimumStockBase = "Cannot be negative";
    if (itemForm.reorderLevelBase === "" || itemForm.reorderLevelBase === undefined || itemForm.reorderLevelBase === null) errors.reorderLevelBase = "Reorder level is required";
    else if (isExponential(itemForm.reorderLevelBase)) errors.reorderLevelBase = "Exponential notation is not allowed";
    else if (Number(itemForm.reorderLevelBase) < 0) errors.reorderLevelBase = "Cannot be negative";
    if (itemForm.minimumStockBase !== "" && itemForm.minimumStockBase !== undefined && itemForm.minimumStockBase !== null &&
        itemForm.reorderLevelBase !== "" && itemForm.reorderLevelBase !== undefined && itemForm.reorderLevelBase !== null) {
      if (Number(itemForm.minimumStockBase) > Number(itemForm.reorderLevelBase)) {
        errors.reorderLevelBase = "Reorder level should be >= Min stock";
      }
    }
    if (itemForm.openingQuantityBase === "" || itemForm.openingQuantityBase === undefined || itemForm.openingQuantityBase === null) errors.openingQuantityBase = "Opening quantity is required";
    else if (isExponential(itemForm.openingQuantityBase)) errors.openingQuantityBase = "Exponential notation is not allowed";
    else if (Number(itemForm.openingQuantityBase) < 0) errors.openingQuantityBase = "Cannot be negative";
    if (!itemForm.manufacturer) errors.manufacturer = "Manufacturer is required";
    else if (!isValidName(itemForm.manufacturer)) errors.manufacturer = "Manufacturer contains invalid characters";
    if (hasUrl(itemForm.manufacturer)) errors.manufacturer = "URLs are not allowed";
    if (!itemForm.preferredSupplier) errors.preferredSupplier = "Supplier is required";
    else if (!isValidName(itemForm.preferredSupplier)) errors.preferredSupplier = "Supplier contains invalid characters";
    if (hasUrl(itemForm.preferredSupplier)) errors.preferredSupplier = "URLs are not allowed";
    if (!itemForm.batchNo) errors.batchNo = "Batch No is required";
    else if (!isValidName(itemForm.batchNo)) errors.batchNo = "Batch No contains invalid characters";
    if (hasUrl(itemForm.batchNo)) errors.batchNo = "URLs are not allowed";
    if (!itemForm.defaultLocation) errors.defaultLocation = "Location is required";
    else if (!isValidName(itemForm.defaultLocation)) errors.defaultLocation = "Location contains invalid characters";
    if (hasUrl(itemForm.defaultLocation)) errors.defaultLocation = "URLs are not allowed";
    if (!itemForm.storageCondition) errors.storageCondition = "Storage condition is required";
    else if (!isValidName(itemForm.storageCondition)) errors.storageCondition = "Storage condition contains invalid characters";
    if (hasUrl(itemForm.storageCondition)) errors.storageCondition = "URLs are not allowed";
    setItemFormErrors(errors);
    if (Object.keys(errors).length) return;

    if (!editingItemId) {
      await postInventory({ action: "item", ...itemForm }, (data) => {
        setItemForm(emptyItem);
        setItemFormErrors({});
        setSuccessMessage(`Inventory item "${data.item?.name || itemForm.name}" created successfully.`);
      });
      return;
    }

    setSaving(true);
    setError("");
    setSuccessMessage("");
    try {
      const response = await fetch(`/api/inventory/${editingItemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(itemForm),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update item");
      setEditingItemId("");
      setItemForm(emptyItem);
      setSuccessMessage(`Inventory item "${data.item?.name || itemForm.name}" updated successfully.`);
      await loadInventory();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function editItem(item) {
    setEditingItemId(item._id);
    setItemForm({
      ...emptyItem,
      itemCode: item.itemCode,
      name: item.name,
      genericName: item.genericName || "",
      itemType: item.itemType,
      category: item.category?._id || "",
      subCategory: item.subCategory?._id || "",
      baseUom: item.baseUom?._id || "",
      purchaseUom: item.purchaseUom?._id || "",
      purchaseToBaseFactor: item.purchaseToBaseFactor || 1,
      minimumStockBase: item.minimumStockBase || 0,
      reorderLevelBase: item.reorderLevelBase || 0,
      maximumStockBase: item.maximumStockBase || 0,
      preferredSupplier: item.preferredSupplier || "",
      manufacturer: item.manufacturer || "",
      storageCondition: item.storageCondition || "",
      defaultLocation: item.defaultLocation || "",
      trackExpiry: item.trackExpiry !== false,
      notes: item.notes || "",
    });
    setActiveTab("items");
  }

  const tabs = [
    ["dashboard", "Dashboard", Icons.barChart],
    ["items", "Item Master", Icons.flask],
    ["categories", "Category", Icons.grid],
    ["uom", "UOM", Icons.settings],
    ["stock", "Stock", Icons.activity],
    ["expiry", "Expiry/Wastage", Icons.alertCircle],
    ["movements", "Ledger", Icons.list],
  ];

  return (
    <div className="patients-page" style={{ paddingBottom: 40 }}>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 18, flexWrap: "wrap", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div className="page-header-icon" style={{ background: "var(--brand-surface, #e6f0fa)", color: "var(--brand-action, var(--primary))", padding: 12, borderRadius: 8 }}>
            {Icons.flask}
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: 20, color: "var(--text-main)" }}>Inventory Management</h4>
            <small style={{ color: "var(--text-muted)" }}>Item master, stock ledger, UOM, expiry and wastage control</small>
          </div>
        </div>

        <div style={{ position: "relative", minWidth: 280, flex: "0 1 360px" }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}>{Icons.search}</span>
          <input className="lims-input" maxLength={35} value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search item, code, category..." style={{ ...inputStyle(), paddingLeft: 38 }} />
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 8, background: "#fef2f2", color: "#b91c1c", fontSize: 13, fontWeight: 700 }}>
          {error}
        </div>
      )}
      <SuccessDialog message={successMessage} onClose={() => setSuccessMessage("")} />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        {tabs.map(([key, label, icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={activeTab === key ? "btn-lims-primary" : "btn-lims-secondary"}
            style={{ height: 38, padding: "0 12px", display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 8, fontSize: 13 }}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="form-card" style={{ padding: 28, borderRadius: 8 }}>Loading inventory...</div>
      ) : (
        <>
          {activeTab === "dashboard" && (
            <div style={{ display: "grid", gap: 18 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14 }}>
                <StatCard icon={Icons.flask} label="Items" value={inventory.stats.totalItems || 0} />
                <StatCard icon={Icons.activity} label="Stock Units" value={formatNumber(inventory.stats.totalStock)} tone="#047857" />
                <StatCard icon={Icons.alertCircle} label="Low Stock" value={inventory.stats.lowStock || 0} tone="#b45309" />
                <StatCard icon={Icons.clock} label="Near Expiry" value={inventory.stats.nearExpiryBatches || 0} tone="#1d4ed8" />
                <StatCard icon={Icons.trash} label="Expired Batches" value={inventory.stats.expiredBatches || 0} tone="#b91c1c" />
                <StatCard icon={Icons.list} label="Stock Value" value={`Rs ${formatNumber(inventory.stats.inventoryValue)}`} />
              </div>
              <InventoryTable items={filteredItems} onEdit={editItem} />
            </div>
          )}

          {activeTab === "items" && (
            <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 420px) 1fr", gap: 18, alignItems: "start" }}>
              <form className="form-card" onSubmit={saveItem} style={{ padding: 20, borderRadius: 8, display: "grid", gap: 12 }}>
                <h5 style={{ margin: 0, fontSize: 16 }}>{editingItemId ? "Edit Item Master" : "Add Item Master"}</h5>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <Field label="Item Code">
                   <input className="lims-input" required maxLength={35} value={itemForm.itemCode} onChange={(e) => { const v = e.target.value; if (hasUrl(v)) { setItemFormErrors((p) => ({ ...p, itemCode: "URLs are not allowed" })); return; } if (v && !isValidName(v)) { setItemFormErrors((p) => ({ ...p, itemCode: "Code contains invalid characters" })); return; } setItemFormErrors((p) => ({ ...p, itemCode: "" })); setItemForm({ ...itemForm, itemCode: v }); }} style={inputStyle()} />
                  <ErrorMsg message={itemFormErrors.itemCode} />
                </Field>
                  <Field label="Type">
                    <select className="lims-input" value={itemForm.itemType} onChange={(e) => setItemForm({ ...itemForm, itemType: e.target.value })} style={inputStyle()}>
                      {["reagent", "consumable", "chemical", "control", "calibrator", "equipment", "stationery", "other"].map((type) => <option key={type} value={type}>{type}</option>)}
                    </select>
                  </Field>
                </div>
                <Field label="Item Name">
                   <input className="lims-input" required minLength={2} maxLength={35} value={itemForm.name} onChange={(e) => { const v = e.target.value; if (hasUrl(v)) { setItemFormErrors((p) => ({ ...p, name: "URLs are not allowed" })); return; } if (v && !isValidName(v)) { setItemFormErrors((p) => ({ ...p, name: "Name contains invalid characters" })); return; } setItemFormErrors((p) => ({ ...p, name: "" })); setItemForm({ ...itemForm, name: v }); }} style={inputStyle()} />
                  <ErrorMsg message={itemFormErrors.name} />
                </Field>
                <Field label="Generic / Alternate Name">
                   <input className="lims-input" maxLength={35} value={itemForm.genericName} onChange={(e) => { const v = e.target.value; if (hasUrl(v)) { setItemFormErrors((p) => ({ ...p, genericName: "URLs are not allowed" })); return; } if (v && !isValidName(v)) { setItemFormErrors((p) => ({ ...p, genericName: "Name contains invalid characters" })); return; } setItemFormErrors((p) => ({ ...p, genericName: "" })); setItemForm({ ...itemForm, genericName: v }); }} style={inputStyle()} />
                  <ErrorMsg message={itemFormErrors.genericName} />
                </Field>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <Field label="Category">
                    <select required className="lims-input" value={itemForm.category} onChange={(e) => { setItemFormErrors((p) => ({ ...p, category: "" })); setItemForm({ ...itemForm, category: e.target.value }); }} style={inputStyle()}>
                      <option value="">Select</option>
                      {parentCategories.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}
                    </select>
                    <ErrorMsg message={itemFormErrors.category} />
                  </Field>
                  <Field label="Sub Category">
                    <select required className="lims-input" value={itemForm.subCategory} onChange={(e) => { setItemFormErrors((p) => ({ ...p, subCategory: "" })); setItemForm({ ...itemForm, subCategory: e.target.value }); }} style={inputStyle()}>
                      <option value="">None</option>
                      {subCategories.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}
                    </select>
                    <ErrorMsg message={itemFormErrors.subCategory} />
                  </Field>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <Field label="Base UOM">
                    <select required className="lims-input" value={itemForm.baseUom} onChange={(e) => { setItemFormErrors((p) => ({ ...p, baseUom: "" })); setItemForm({ ...itemForm, baseUom: e.target.value }); }} style={inputStyle()}>
                      <option value="">Select</option>
                      {inventory.uoms.map((uom) => <option key={uom._id} value={uom._id}>{uom.symbol} - {uom.name}</option>)}
                    </select>
                    <ErrorMsg message={itemFormErrors.baseUom} />
                  </Field>
                  <Field label="Purchase UOM">
                    <select required className="lims-input" value={itemForm.purchaseUom} onChange={(e) => { setItemFormErrors((p) => ({ ...p, purchaseUom: "" })); setItemForm({ ...itemForm, purchaseUom: e.target.value }); }} style={inputStyle()}>
                      <option value="">Same as base</option>
                      {inventory.uoms.map((uom) => <option key={uom._id} value={uom._id}>{uom.symbol} - {uom.name}</option>)}
                    </select>
                    <ErrorMsg message={itemFormErrors.purchaseUom} />
                  </Field>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  <Field label="Conv. Factor">
                     <input className="lims-input" type="number" min="0" max="9999999999" step="0.001" value={itemForm.purchaseToBaseFactor} onChange={(e) => { const v = e.target.value; if (isExponential(v)) { setItemFormErrors((p) => ({ ...p, purchaseToBaseFactor: "Exponential notation is not allowed" })); return; } setItemFormErrors((p) => ({ ...p, purchaseToBaseFactor: "" })); setItemForm({ ...itemForm, purchaseToBaseFactor: v }); }} style={inputStyle()} />
                    <ErrorMsg message={itemFormErrors.purchaseToBaseFactor} />
                  </Field>
                  <Field label="Min Stock">
                     <input className="lims-input" type="number" min="0" max="9999999999" step="0.001" value={itemForm.minimumStockBase} onChange={(e) => { const v = e.target.value; if (isExponential(v)) { setItemFormErrors((p) => ({ ...p, minimumStockBase: "Exponential notation is not allowed" })); return; } setItemFormErrors((p) => ({ ...p, minimumStockBase: "" })); setItemForm({ ...itemForm, minimumStockBase: v }); }} style={inputStyle()} />
                    <ErrorMsg message={itemFormErrors.minimumStockBase} />
                  </Field>
                  <Field label="Reorder">
                     <input className="lims-input" type="number" min="0" max="9999999999" step="0.001" value={itemForm.reorderLevelBase} onChange={(e) => { const v = e.target.value; if (isExponential(v)) { setItemFormErrors((p) => ({ ...p, reorderLevelBase: "Exponential notation is not allowed" })); return; } setItemFormErrors((p) => ({ ...p, reorderLevelBase: "" })); setItemForm({ ...itemForm, reorderLevelBase: v }); }} style={inputStyle()} />
                    <ErrorMsg message={itemFormErrors.reorderLevelBase} />
                  </Field>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <Field label="Track Expiry">
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", height: 38 }}>
                      <input type="checkbox" checked={itemForm.trackExpiry !== false} onChange={(e) => setItemForm({ ...itemForm, trackExpiry: e.target.checked })} style={{ width: 16, height: 16 }} />
                      Enable expiry tracking
                    </label>
                  </Field>
                  {itemForm.trackExpiry !== false && !editingItemId && (
                    <Field label="Expiry Date">
                      <input className="lims-input" type="date" value={itemForm.expiryDate || ""} onChange={(e) => setItemForm({ ...itemForm, expiryDate: e.target.value })} style={inputStyle()} />
                    </Field>
                  )}
                  {itemForm.trackExpiry === false && <div />}
                </div>
                {!editingItemId && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <Field label="Opening Qty">
                       <input className="lims-input" type="number" min="0" max="9999999999" step="0.001" value={itemForm.openingQuantityBase} onChange={(e) => { const v = e.target.value; if (isExponential(v)) { setItemFormErrors((p) => ({ ...p, openingQuantityBase: "Exponential notation is not allowed" })); return; } setItemFormErrors((p) => ({ ...p, openingQuantityBase: "" })); setItemForm({ ...itemForm, openingQuantityBase: v }); }} style={inputStyle()} />
                      <ErrorMsg message={itemFormErrors.openingQuantityBase} />
                    </Field>
                    <Field label="Batch No">
                       <input className="lims-input" maxLength={35} value={itemForm.batchNo} onChange={(e) => { const v = e.target.value; if (hasUrl(v)) { setItemFormErrors((p) => ({ ...p, batchNo: "URLs are not allowed" })); return; } if (v && !isValidName(v)) { setItemFormErrors((p) => ({ ...p, batchNo: "Batch No contains invalid characters" })); return; } setItemFormErrors((p) => ({ ...p, batchNo: "" })); setItemForm({ ...itemForm, batchNo: v }); }} style={inputStyle()} />
                      <ErrorMsg message={itemFormErrors.batchNo} />
                    </Field>
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <Field label="Manufacturer">
                     <input className="lims-input" maxLength={35} value={itemForm.manufacturer} onChange={(e) => { const v = e.target.value; if (hasUrl(v)) { setItemFormErrors((p) => ({ ...p, manufacturer: "URLs are not allowed" })); return; } if (v && !isValidName(v)) { setItemFormErrors((p) => ({ ...p, manufacturer: "Manufacturer contains invalid characters" })); return; } setItemFormErrors((p) => ({ ...p, manufacturer: "" })); setItemForm({ ...itemForm, manufacturer: v }); }} style={inputStyle()} />
                    <ErrorMsg message={itemFormErrors.manufacturer} />
                  </Field>
                  <Field label="Supplier">
                     <input className="lims-input" maxLength={35} value={itemForm.preferredSupplier} onChange={(e) => { const v = e.target.value; if (hasUrl(v)) { setItemFormErrors((p) => ({ ...p, preferredSupplier: "URLs are not allowed" })); return; } if (v && !isValidName(v)) { setItemFormErrors((p) => ({ ...p, preferredSupplier: "Supplier contains invalid characters" })); return; } setItemFormErrors((p) => ({ ...p, preferredSupplier: "" })); setItemForm({ ...itemForm, preferredSupplier: v }); }} style={inputStyle()} />
                    <ErrorMsg message={itemFormErrors.preferredSupplier} />
                  </Field>
                </div>
                <Field label="Location">
                   <input className="lims-input" maxLength={35} value={itemForm.defaultLocation} onChange={(e) => { const v = e.target.value; if (hasUrl(v)) { setItemFormErrors((p) => ({ ...p, defaultLocation: "URLs are not allowed" })); return; } if (v && !isValidName(v)) { setItemFormErrors((p) => ({ ...p, defaultLocation: "Location contains invalid characters" })); return; } setItemFormErrors((p) => ({ ...p, defaultLocation: "" })); setItemForm({ ...itemForm, defaultLocation: v }); }} style={inputStyle()} />
                  <ErrorMsg message={itemFormErrors.defaultLocation} />
                </Field>
                <Field label="Storage Condition">
                   <input className="lims-input" maxLength={35} value={itemForm.storageCondition} onChange={(e) => { const v = e.target.value; if (hasUrl(v)) { setItemFormErrors((p) => ({ ...p, storageCondition: "URLs are not allowed" })); return; } if (v && !isValidName(v)) { setItemFormErrors((p) => ({ ...p, storageCondition: "Storage condition contains invalid characters" })); return; } setItemFormErrors((p) => ({ ...p, storageCondition: "" })); setItemForm({ ...itemForm, storageCondition: v }); }} style={inputStyle()} />
                  <ErrorMsg message={itemFormErrors.storageCondition} />
                </Field>
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="btn-lims-primary" disabled={saving} style={{ height: 38, flex: 1 }}>{saving ? "Saving..." : editingItemId ? "Update Item" : "Create Item"}</button>
                  {editingItemId && <button type="button" className="btn-lims-secondary" onClick={() => { setEditingItemId(""); setItemForm(emptyItem); }} style={{ height: 38 }}>Cancel</button>}
                </div>
              </form>
              <InventoryTable items={filteredItems} onEdit={editItem} />
            </div>
          )}

          {activeTab === "categories" && (
            <MastersPanel
              title="Category & Sub Category"
              form={categoryForm}
              setForm={setCategoryForm}
              onSubmit={(event) => {
                event.preventDefault();
                const errors = {};
                if (!categoryForm.name) errors.name = "Category name is required";
                else if (!isValidName(categoryForm.name)) errors.name = "Name contains invalid characters";
                if (hasUrl(categoryForm.name)) errors.name = "URLs are not allowed";
                if (!categoryForm.code) errors.code = "Category code is required";
                if (categoryForm.code && !isValidName(categoryForm.code)) errors.code = "Code contains invalid characters";
                if (hasUrl(categoryForm.code)) errors.code = "URLs are not allowed";
                setCategoryFormErrors(errors);
                if (Object.keys(errors).length) return;
                postInventory({ action: "category", ...categoryForm }, (data) => {
                  setCategoryForm({ name: "", code: "", parentCategory: "", description: "" });
                  setCategoryFormErrors({});
                  setSuccessMessage(`Inventory category "${data.category?.name || categoryForm.name}" created successfully.`);
                });
              }}
              saving={saving}
              fields={<>
                <Field label="Name">
                  <input required className="lims-input" maxLength={35} value={categoryForm.name} onChange={(e) => { const v = e.target.value; if (hasUrl(v)) { setCategoryFormErrors((p) => ({ ...p, name: "URLs are not allowed" })); return; } if (v && !isValidName(v)) { setCategoryFormErrors((p) => ({ ...p, name: "Name contains invalid characters" })); return; } setCategoryFormErrors((p) => ({ ...p, name: "" })); setCategoryForm({ ...categoryForm, name: v }); }} style={inputStyle()} />
                  <ErrorMsg message={categoryFormErrors.name} />
                </Field>
                <Field label="Code">
                  <input required className="lims-input" maxLength={35} value={categoryForm.code} onChange={(e) => { const v = e.target.value; if (hasUrl(v)) { setCategoryFormErrors((p) => ({ ...p, code: "URLs are not allowed" })); return; } if (v && !isValidName(v)) { setCategoryFormErrors((p) => ({ ...p, code: "Code contains invalid characters" })); return; } setCategoryFormErrors((p) => ({ ...p, code: "" })); setCategoryForm({ ...categoryForm, code: v }); }} style={inputStyle()} />
                  <ErrorMsg message={categoryFormErrors.code} />
                </Field>
                <Field label="Parent Category">
                  <select className="lims-input" value={categoryForm.parentCategory} onChange={(e) => setCategoryForm({ ...categoryForm, parentCategory: e.target.value })} style={inputStyle()}>
                    <option value="">Main category</option>
                    {parentCategories.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}
                  </select>
                </Field>
                <Field label="Description"><input className="lims-input" maxLength={150} value={categoryForm.description} onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })} style={inputStyle()} /></Field>
              </>}
            >
              <div style={{ display: "grid", gap: 10 }}>
                <input className="lims-input" maxLength={35} value={categorySearch} onChange={(e) => setCategorySearch(e.target.value)} placeholder="Search categories..." style={{ ...inputStyle(), maxWidth: 300 }} />
                <MasterTable headings={["Name", "Code", "Parent", "Status"]} rows={inventory.categories.filter((c) => { const q = categorySearch.toLowerCase(); return !q || c.name.toLowerCase().includes(q) || (c.code || "").toLowerCase().includes(q) || (c.parentCategory?.name || "").toLowerCase().includes(q); }).map((category) => [category.name, category.code || "-", category.parentCategory?.name || "Main", category.status])} />
              </div>
            </MastersPanel>
          )}

          {activeTab === "uom" && (
            <MastersPanel
              title="UOM Management & Conversion"
              form={uomForm}
              setForm={setUomForm}
              onSubmit={(event) => {
                event.preventDefault();
                const errors = {};
                if (!uomForm.name) errors.name = "UOM name is required";
                else if (!isLettersOnly(uomForm.name)) errors.name = "Name must contain only letters";
                if (hasUrl(uomForm.name)) errors.name = "URLs are not allowed";
                if (!uomForm.symbol) errors.symbol = "Symbol is required";
                else if (!isValidName(uomForm.symbol)) errors.symbol = "Symbol contains invalid characters";
                if (hasUrl(uomForm.symbol)) errors.symbol = "URLs are not allowed";
                if (!uomForm.conversionToBase && uomForm.conversionToBase !== 0) errors.conversionToBase = "Conversion to base is required";
                else if (isExponential(uomForm.conversionToBase)) errors.conversionToBase = "Exponential notation is not allowed";
                else if (Number(uomForm.conversionToBase) <= 0) errors.conversionToBase = "Must be greater than 0";
                if (!uomForm.baseSymbol) errors.baseSymbol = "Base symbol is required";
                else if (!isValidName(uomForm.baseSymbol)) errors.baseSymbol = "Base symbol contains invalid characters";
                if (hasUrl(uomForm.baseSymbol)) errors.baseSymbol = "URLs are not allowed";
                setUomFormErrors(errors);
                if (Object.keys(errors).length) return;
                postInventory({ action: "uom", ...uomForm }, (data) => {
                  setUomForm({ name: "", symbol: "", type: "count", conversionToBase: 1, baseSymbol: "" });
                  setUomFormErrors({});
                  setSuccessMessage(`Inventory UOM "${data.uom?.symbol || uomForm.symbol}" created successfully.`);
                });
              }}
              saving={saving}
              fields={<>
                <Field label="Name">
                  <input required className="lims-input" maxLength={35} value={uomForm.name} onChange={(e) => { const v = e.target.value; if (hasUrl(v)) { setUomFormErrors((p) => ({ ...p, name: "URLs are not allowed" })); return; } if (v && !isLettersOnly(v)) { setUomFormErrors((p) => ({ ...p, name: "Name must contain only letters" })); return; } setUomFormErrors((p) => ({ ...p, name: "" })); setUomForm({ ...uomForm, name: v }); }} style={inputStyle()} />
                  <ErrorMsg message={uomFormErrors.name} />
                </Field>
                <Field label="Symbol">
                  <input required className="lims-input" maxLength={35} value={uomForm.symbol} onChange={(e) => { const v = e.target.value; if (hasUrl(v)) { setUomFormErrors((p) => ({ ...p, symbol: "URLs are not allowed" })); return; } if (v && !isValidName(v)) { setUomFormErrors((p) => ({ ...p, symbol: "Symbol contains invalid characters" })); return; } setUomFormErrors((p) => ({ ...p, symbol: "" })); setUomForm({ ...uomForm, symbol: v }); }} style={inputStyle()} />
                  <ErrorMsg message={uomFormErrors.symbol} />
                </Field>
                <Field label="Type">
                  <select className="lims-input" value={uomForm.type} onChange={(e) => setUomForm({ ...uomForm, type: e.target.value })} style={inputStyle()}>
                    {["count", "volume", "weight", "length", "time", "pack", "other"].map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </Field>
                <Field label="Conversion to Base">
                  <input required className="lims-input" type="number" min="0" max="9999999999" step="0.001" value={uomForm.conversionToBase} onChange={(e) => { const v = e.target.value; if (isExponential(v)) { setUomFormErrors((p) => ({ ...p, conversionToBase: "Exponential notation is not allowed" })); return; } setUomFormErrors((p) => ({ ...p, conversionToBase: "" })); setUomForm({ ...uomForm, conversionToBase: v }); }} style={inputStyle()} />
                  <ErrorMsg message={uomFormErrors.conversionToBase} />
                </Field>
                <Field label="Base Symbol">
                  <input required className="lims-input" maxLength={35} value={uomForm.baseSymbol} onChange={(e) => { const v = e.target.value; if (hasUrl(v)) { setUomFormErrors((p) => ({ ...p, baseSymbol: "URLs are not allowed" })); return; } if (v && !isValidName(v)) { setUomFormErrors((p) => ({ ...p, baseSymbol: "Base symbol contains invalid characters" })); return; } setUomFormErrors((p) => ({ ...p, baseSymbol: "" })); setUomForm({ ...uomForm, baseSymbol: v }); }} style={inputStyle()} />
                  <ErrorMsg message={uomFormErrors.baseSymbol} />
                </Field>
              </>}
            >
              <MasterTable headings={["Name", "Symbol", "Type", "Conversion", "Base"]} rows={inventory.uoms.map((uom) => [uom.name, uom.symbol, uom.type, uom.conversionToBase, uom.baseSymbol || uom.symbol])} />
            </MastersPanel>
          )}

          {activeTab === "stock" && (
            <StockPanel
              form={movementForm}
              setForm={setMovementForm}
              item={selectedMovementItem}
              items={inventory.items}
              saving={saving}
              errors={movementFormErrors}
              setErrors={setMovementFormErrors}
              onSubmit={(event) => {
                event.preventDefault();
                const errors = {};
                if (!movementForm.itemId) errors.itemId = "Item is required";
                if (movementForm.movementType !== "receipt" && movementForm.movementType !== "adjustment" && !movementForm.batchId) errors.batchId = "Batch is required";
                const supplierVal = movementForm.supplier || "";
                const toLocVal = movementForm.toLocation || "";
                if (movementForm.movementType === "receipt") {
                  if (!supplierVal) errors.supplier = "Supplier is required";
                  else if (!isValidName(supplierVal)) errors.supplier = "Supplier contains invalid characters";
                  if (hasUrl(supplierVal)) errors.supplier = "URLs are not allowed";
                } else {
                  if (!toLocVal) errors.toLocation = "To location is required";
                  else if (!isValidName(toLocVal)) errors.toLocation = "Location contains invalid characters";
                  if (hasUrl(toLocVal)) errors.toLocation = "URLs are not allowed";
                }
                const refNo = movementForm.referenceNo || "";
                if (!refNo) errors.referenceNo = "Reference No is required";
                else if (!isValidName(refNo)) errors.referenceNo = "Reference No contains invalid characters";
                if (hasUrl(refNo)) errors.referenceNo = "URLs are not allowed";
                const reason = movementForm.reason || "";
                if (!reason) errors.reason = "Reason is required";
                else if (!isValidName(reason)) errors.reason = "Reason contains invalid characters";
                if (hasUrl(reason)) errors.reason = "URLs are not allowed";
                if (isExponential(movementForm.quantityBase)) errors.quantityBase = "Exponential notation is not allowed";
                if (isExponential(movementForm.newBalanceBase)) errors.newBalanceBase = "Exponential notation is not allowed";
                setMovementFormErrors(errors);
                if (Object.keys(errors).length) return;
                postInventory({ action: "movement", ...movementForm }, () => {
                  setMovementForm({ ...emptyMovement, itemId: movementForm.itemId, movementType: movementForm.movementType });
                  setMovementFormErrors({});
                  setSuccessMessage("Stock transaction posted successfully.");
                });
              }}
            />
          )}

          {activeTab === "expiry" && (
            <ExpiryPanel items={filteredItems} onWaste={(item, batch) => {
              setMovementForm({ ...emptyMovement, itemId: item._id, batchId: batch._id, movementType: "wastage", quantityBase: batch.quantityBase, reason: "Expired/damaged stock wastage" });
              setActiveTab("stock");
            }} />
          )}

          {activeTab === "movements" && <MovementLedger movements={inventory.movements} />}
        </>
      )}
    </div>
  );
}

function InventoryTable({ items, onEdit }) {
  return (
    <div className="form-card" style={{ padding: 0, overflowX: "auto", borderRadius: 8 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 880 }}>
        <thead>
          <tr style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
            {["Item", "Category", "Stock", "Min/Reorder", "Expiry", "Location", "Status", "Action"].map((heading) => (
              <th key={heading} style={{ padding: "12px 14px", textAlign: "left", color: "var(--text-secondary)", fontWeight: 700 }}>{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const low = item.stockOnHandBase <= item.minimumStockBase;
            const reorder = item.reorderLevelBase && item.stockOnHandBase <= item.reorderLevelBase;
            const expiryTone = item.expiredBatches ? "danger" : item.nearExpiryBatches ? "warn" : "good";
            return (
              <tr key={item._id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                <td style={{ padding: "12px 14px" }}>
                  <div style={{ fontWeight: 800, color: "var(--text-primary)" }}>{item.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{item.itemCode} {item.manufacturer ? `- ${item.manufacturer}` : ""}</div>
                </td>
                <td style={{ padding: "12px 14px" }}>
                  <div>{item.category?.name || "-"}</div>
                  <small style={{ color: "var(--text-muted)" }}>{item.subCategory?.name || item.itemType}</small>
                </td>
                <td style={{ padding: "12px 14px", fontWeight: 800, color: low ? "#b91c1c" : "var(--text-primary)" }}>
                  {formatNumber(item.stockOnHandBase)} {item.baseUom?.symbol}
                </td>
                <td style={{ padding: "12px 14px" }}>{formatNumber(item.minimumStockBase)} / {formatNumber(item.reorderLevelBase)}</td>
                <td style={{ padding: "12px 14px" }}><Badge tone={expiryTone}>{item.expiredBatches ? "Expired" : item.nearExpiryBatches ? "Near expiry" : formatDate(item.nextExpiryDate)}</Badge></td>
                <td style={{ padding: "12px 14px" }}>{item.defaultLocation || "-"}</td>
                <td style={{ padding: "12px 14px" }}><Badge tone={reorder ? "warn" : low ? "danger" : "good"}>{reorder ? "Reorder" : low ? "Low" : "OK"}</Badge></td>
                <td style={{ padding: "12px 14px" }}><button className="btn-lims-secondary" onClick={() => onEdit(item)} style={{ height: 32, padding: "0 10px" }}>{Icons.edit}</button></td>
              </tr>
            );
          })}
          {items.length === 0 && (
            <tr><td colSpan="8" style={{ padding: 28, textAlign: "center", color: "var(--text-muted)" }}>No inventory items found.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function MastersPanel({ title, fields, onSubmit, saving, children }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(300px, 380px) 1fr", gap: 18, alignItems: "start" }}>
      <form className="form-card" onSubmit={onSubmit} style={{ padding: 20, borderRadius: 8, display: "grid", gap: 12 }}>
        <h5 style={{ margin: 0, fontSize: 16 }}>{title}</h5>
        {fields}
        <button className="btn-lims-primary" disabled={saving} style={{ height: 38 }}>{saving ? "Saving..." : "Save Master"}</button>
      </form>
      {children}
    </div>
  );
}

function MasterTable({ headings, rows }) {
  return (
    <div className="form-card" style={{ padding: 0, overflowX: "auto", borderRadius: 8 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead><tr style={{ background: "var(--surface)" }}>{headings.map((heading) => <th key={heading} style={{ padding: 12, textAlign: "left" }}>{heading}</th>)}</tr></thead>
        <tbody>
          {rows.map((row, index) => <tr key={index} style={{ borderTop: "1px solid var(--border-light)" }}>{row.map((cell, cellIndex) => <td key={cellIndex} style={{ padding: 12 }}>{cell}</td>)}</tr>)}
          {rows.length === 0 && <tr><td colSpan={headings.length} style={{ padding: 28, textAlign: "center", color: "var(--text-muted)" }}>No records yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function StockPanel({ form, setForm, item, items, saving, onSubmit, errors = {}, setErrors }) {
  const isAdjustment = form.movementType === "adjustment";
  const isReceipt = form.movementType === "receipt";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 440px) 1fr", gap: 18, alignItems: "start" }}>
      <form className="form-card" onSubmit={onSubmit} style={{ padding: 20, borderRadius: 8, display: "grid", gap: 12 }}>
        <h5 style={{ margin: 0, fontSize: 16 }}>Stock Transaction</h5>
        <Field label="Item">
          <select required className="lims-input" value={form.itemId} onChange={(e) => { setErrors?.({}); setForm({ ...form, itemId: e.target.value, batchId: "" }); }} style={inputStyle()}>
            <option value="">Select item</option>
            {items.map((stockItem) => <option key={stockItem._id} value={stockItem._id}>{stockItem.itemCode} - {stockItem.name}</option>)}
          </select>
          <ErrorMsg message={errors.itemId} />
        </Field>
        <Field label="Transaction">
          <select className="lims-input" value={form.movementType} onChange={(e) => setForm({ ...form, movementType: e.target.value })} style={inputStyle()}>
            {["receipt", "issue", "adjustment", "transfer", "wastage", "expiry"].map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </Field>
        {!isReceipt && (
          <Field label="Batch">
            <select required className="lims-input" value={form.batchId} onChange={(e) => { setErrors?.((p) => ({ ...p, batchId: "" })); setForm({ ...form, batchId: e.target.value }); }} style={inputStyle()}>
              <option value="">Auto select available batch</option>
              {(item?.batches || []).filter((batch) => batch.quantityBase > 0).map((batch) => (
                <option key={batch._id} value={batch._id}>{batch.batchNo || "Batch"} - {formatNumber(batch.quantityBase)} {item?.baseUom?.symbol}</option>
              ))}
            </select>
            <ErrorMsg message={errors.batchId} />
          </Field>
        )}
        {isReceipt && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Batch No"><input className="lims-input" maxLength={35} value={form.batchNo} onChange={(e) => { const v = e.target.value; if (hasUrl(v)) { setErrors?.((p) => ({ ...p, batchNo: "URLs are not allowed" })); return; } if (v && !isValidName(v)) { setErrors?.((p) => ({ ...p, batchNo: "Batch No contains invalid characters" })); return; } setErrors?.((p) => ({ ...p, batchNo: "" })); setForm({ ...form, batchNo: v }); }} style={inputStyle()} /></Field>
            <Field label="Expiry"><input className="lims-input" type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} style={inputStyle()} /></Field>
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label={isAdjustment ? "Current Batch Balance" : "Quantity"}>
            <input required className="lims-input" type="number" min="0" max="9999999999" step="0.001" value={isAdjustment ? form.newBalanceBase : form.quantityBase} onChange={(e) => { const v = e.target.value; if (isExponential(v)) { setErrors?.((p) => ({ ...p, [isAdjustment ? "newBalanceBase" : "quantityBase"]: "Exponential notation is not allowed" })); return; } setErrors?.((p) => ({ ...p, [isAdjustment ? "newBalanceBase" : "quantityBase"]: "" })); setForm({ ...form, [isAdjustment ? "newBalanceBase" : "quantityBase"]: v }); }} style={inputStyle()} />
            <ErrorMsg message={isAdjustment ? errors.newBalanceBase : errors.quantityBase} />
          </Field>
          <Field label="Cost / Base Unit"><input className="lims-input" type="number" min="0" max="9999999999" step="0.01" value={form.costPerBaseUnit} onChange={(e) => setForm({ ...form, costPerBaseUnit: e.target.value })} style={inputStyle()} /></Field>
        </div>
        <Field label="Supplier / To Location">
          <input className="lims-input" maxLength={35} value={isReceipt ? form.supplier : form.toLocation} onChange={(e) => { const v = e.target.value; const key = isReceipt ? "supplier" : "toLocation"; if (hasUrl(v)) { setErrors?.((p) => ({ ...p, [key]: "URLs are not allowed" })); return; } if (v && !isValidName(v)) { setErrors?.((p) => ({ ...p, [key]: "Field contains invalid characters" })); return; } setErrors?.((p) => ({ ...p, [key]: "" })); setForm({ ...form, [key]: v }); }} style={inputStyle()} />
          <ErrorMsg message={isReceipt ? errors.supplier : errors.toLocation} />
        </Field>
        <Field label="Reference No">
          <input className="lims-input" maxLength={35} value={form.referenceNo} onChange={(e) => { const v = e.target.value; if (hasUrl(v)) { setErrors?.((p) => ({ ...p, referenceNo: "URLs are not allowed" })); return; } if (v && !isValidName(v)) { setErrors?.((p) => ({ ...p, referenceNo: "Reference No contains invalid characters" })); return; } setErrors?.((p) => ({ ...p, referenceNo: "" })); setForm({ ...form, referenceNo: v }); }} style={inputStyle()} />
          <ErrorMsg message={errors.referenceNo} />
        </Field>
        <Field label="Reason">
          <input className="lims-input" maxLength={150} value={form.reason} onChange={(e) => { const v = e.target.value; if (hasUrl(v)) { setErrors?.((p) => ({ ...p, reason: "URLs are not allowed" })); return; } if (v && !isValidName(v)) { setErrors?.((p) => ({ ...p, reason: "Reason contains invalid characters" })); return; } setErrors?.((p) => ({ ...p, reason: "" })); setForm({ ...form, reason: v }); }} style={inputStyle()} />
          <ErrorMsg message={errors.reason} />
        </Field>
        <button className="btn-lims-primary" disabled={saving} style={{ height: 38 }}>{saving ? "Posting..." : "Post Transaction"}</button>
      </form>
      <div className="form-card" style={{ padding: 20, borderRadius: 8 }}>
        <h5 style={{ margin: "0 0 12px", fontSize: 16 }}>Batch Balances</h5>
        {!item ? <p style={{ color: "var(--text-muted)" }}>Select an item to view batches.</p> : (
          <MasterTable headings={["Batch", "Qty", "Expiry", "Location", "Status"]} rows={(item.batches || []).map((batch) => [batch.batchNo || "-", `${formatNumber(batch.quantityBase)} ${item.baseUom?.symbol || ""}`, formatDate(batch.expiryDate), batch.location || "-", batch.status])} />
        )}
      </div>
    </div>
  );
}

function ExpiryPanel({ items, onWaste }) {
  const batches = items.flatMap((item) => (item.batches || []).map((batch) => ({ item, batch }))).filter(({ batch }) => batch.quantityBase > 0 && batch.expiryDate);
  const today = new Date();
  const warning = new Date(today);
  warning.setDate(warning.getDate() + 30);

  return (
    <div className="form-card" style={{ padding: 0, overflowX: "auto", borderRadius: 8 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 760 }}>
        <thead><tr style={{ background: "var(--surface)" }}>{["Item", "Batch", "Qty", "Expiry", "Risk", "Action"].map((heading) => <th key={heading} style={{ padding: 12, textAlign: "left" }}>{heading}</th>)}</tr></thead>
        <tbody>
          {batches.map(({ item, batch }) => {
            const expiry = new Date(batch.expiryDate);
            const expired = expiry < today;
            const near = expiry >= today && expiry <= warning;
            return (
              <tr key={`${item._id}-${batch._id}`} style={{ borderTop: "1px solid var(--border-light)" }}>
                <td style={{ padding: 12 }}><strong>{item.name}</strong><br /><small>{item.itemCode}</small></td>
                <td style={{ padding: 12 }}>{batch.batchNo || "-"}</td>
                <td style={{ padding: 12 }}>{formatNumber(batch.quantityBase)} {item.baseUom?.symbol}</td>
                <td style={{ padding: 12 }}>{formatDate(batch.expiryDate)}</td>
                <td style={{ padding: 12 }}><Badge tone={expired ? "danger" : near ? "warn" : "good"}>{expired ? "Expired" : near ? "Near expiry" : "Valid"}</Badge></td>
                <td style={{ padding: 12 }}><button className="btn-lims-secondary" onClick={() => onWaste(item, batch)} style={{ height: 32 }}>Log Wastage</button></td>
              </tr>
            );
          })}
          {batches.length === 0 && <tr><td colSpan="6" style={{ padding: 28, textAlign: "center", color: "var(--text-muted)" }}>No expiry-tracked batches.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function MovementLedger({ movements }) {
  return (
    <MasterTable
      headings={["Date", "Item", "Type", "Qty", "Balance", "Reference", "Reason"]}
      rows={movements.map((movement) => [
        formatDate(movement.movementDate),
        movement.item ? `${movement.item.itemCode} - ${movement.item.name}` : "-",
        movement.movementType,
        formatNumber(movement.quantityBase),
        formatNumber(movement.balanceAfterBase),
        movement.referenceNo || "-",
        movement.reason || "-",
      ])}
    />
  );
}
