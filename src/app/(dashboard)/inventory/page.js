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
  conversionFactorUnit: "mg",
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
  quarantineOnReceipt: false,
  status: "active",
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
  receivedDate: "",
  movementDate: new Date().toISOString().split("T")[0],
  costPerBaseUnit: 0,
  referenceNo: "",
  reason: "",
  toLocation: "",
  quantityUnit: "",
};

function Field({ label, children }) {
  return (
    <label style={{ display: "grid", gap: "8px", fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)" }}>
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

function isValidLocation(value) {
  return /^[A-Za-z0-9 .,/-]*$/.test(value);
}

function isValidItemCode(value) {
  return /^[A-Z0-9-]*$/.test(value);
}

function isLettersOnly(value) {
  return /^[A-Za-z\s]*$/.test(value);
}

function isValidDecimal(value, intMax = 4, fracMax = 3) {
  if (value === "" || value === undefined || value === null) return true;
  return new RegExp(`^\\d{0,${intMax}}(\\.\\d{0,${fracMax}})?$`).test(String(value));
}

function validateExpiryDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "Invalid expiry date";
  const year = date.getFullYear();
  if (year < 2000) return "Expiry year looks incorrect";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(year, date.getMonth(), date.getDate());
  if (expiry <= today) return "Expiry date must be in the future";
  const maxFuture = new Date(today.getFullYear() + 15, today.getMonth(), today.getDate());
  if (expiry > maxFuture) return "Expiry date is too far in the future";
  return "";
}

function ErrorMsg({ message }) {
  return message ? <small style={{ color: "var(--error)", fontSize: 10, display: "block", marginTop: 2 }}>{message}</small> : null;
}

function inputStyle() {
  return { height: 38, fontSize: 13 };
}

const COMMON_UOMS = [
  { symbol: "mcg", name: "Microgram", type: "weight", baseSymbol: "g", conversionToBase: 0.000001 },
  { symbol: "mg", name: "Milligram", type: "weight", baseSymbol: "g", conversionToBase: 0.001 },
  { symbol: "g", name: "Gram", type: "weight", baseSymbol: "g", conversionToBase: 1 },
  { symbol: "kg", name: "Kilogram", type: "weight", baseSymbol: "g", conversionToBase: 1000 },
  { symbol: "oz", name: "Ounce", type: "weight", baseSymbol: "g", conversionToBase: 28.3495 },
  { symbol: "lb", name: "Pound", type: "weight", baseSymbol: "g", conversionToBase: 453.592 },
  { symbol: "mL", name: "Milliliter", type: "volume", baseSymbol: "L", conversionToBase: 0.001 },
  { symbol: "L", name: "Liter", type: "volume", baseSymbol: "L", conversionToBase: 1 },
  { symbol: "dL", name: "Deciliter", type: "volume", baseSymbol: "L", conversionToBase: 0.1 },
  { symbol: "fl oz", name: "Fluid Ounce", type: "volume", baseSymbol: "mL", conversionToBase: 29.5735 },
  { symbol: "units", name: "Units", type: "count", baseSymbol: "units", conversionToBase: 1 },
  { symbol: "each", name: "Each", type: "count", baseSymbol: "each", conversionToBase: 1 },
  { symbol: "dozen", name: "Dozen", type: "count", baseSymbol: "each", conversionToBase: 12 },
  { symbol: "pair", name: "Pair", type: "count", baseSymbol: "each", conversionToBase: 2 },
  { symbol: "hundred", name: "Hundred", type: "count", baseSymbol: "each", conversionToBase: 100 },
  { symbol: "mm", name: "Millimeter", type: "length", baseSymbol: "m", conversionToBase: 0.001 },
  { symbol: "cm", name: "Centimeter", type: "length", baseSymbol: "m", conversionToBase: 0.01 },
  { symbol: "m", name: "Meter", type: "length", baseSymbol: "m", conversionToBase: 1 },
  { symbol: "inch", name: "Inch", type: "length", baseSymbol: "cm", conversionToBase: 2.54 },
  { symbol: "sec", name: "Second", type: "time", baseSymbol: "sec", conversionToBase: 1 },
  { symbol: "min", name: "Minute", type: "time", baseSymbol: "sec", conversionToBase: 60 },
  { symbol: "hr", name: "Hour", type: "time", baseSymbol: "sec", conversionToBase: 3600 },
  { symbol: "day", name: "Day", type: "time", baseSymbol: "sec", conversionToBase: 86400 },
  { symbol: "box10", name: "Box of 10", type: "pack", baseSymbol: "each", conversionToBase: 10 },
  { symbol: "box25", name: "Box of 25", type: "pack", baseSymbol: "each", conversionToBase: 25 },
  { symbol: "box50", name: "Box of 50", type: "pack", baseSymbol: "each", conversionToBase: 50 },
  { symbol: "strip6", name: "Strip of 6", type: "pack", baseSymbol: "each", conversionToBase: 6 },
  { symbol: "strip10", name: "Strip of 10", type: "pack", baseSymbol: "each", conversionToBase: 10 },
  { symbol: "vial", name: "Vial", type: "pack", baseSymbol: "each", conversionToBase: 1 },
  { symbol: "ampoule", name: "Ampoule", type: "pack", baseSymbol: "each", conversionToBase: 1 },
];

const BASE_UNIT_SYMBOLS = [...new Set(COMMON_UOMS.filter((u) => u.symbol === u.baseSymbol).map((u) => u.symbol))];

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [inventory, setInventory] = useState({ categories: [], uoms: [], items: [], movements: [], stats: {} });
  const [itemPage, setItemPage] = useState(1);
  const [itemPagination, setItemPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [categorySearch, setCategorySearch] = useState("");
  const [categoryForm, setCategoryForm] = useState({ name: "", code: "", parentCategory: "", description: "" });
  const [categoryFormErrors, setCategoryFormErrors] = useState({});
  const [uomForm, setUomForm] = useState({ name: "", symbol: "", type: "count", conversionToBase: 1, baseSymbol: "" });
  const [uomFormErrors, setUomFormErrors] = useState({});
  const [editingUomId, setEditingUomId] = useState(null);
  const [deleteUomTarget, setDeleteUomTarget] = useState(null);
  const [uomSearch, setUomSearch] = useState("");
  const [viewMode, setViewMode] = useState("form");
  const [itemForm, setItemForm] = useState(emptyItem);
  const [itemFormErrors, setItemFormErrors] = useState({});
  const [editingItemId, setEditingItemId] = useState("");
  const [editingItemStock, setEditingItemStock] = useState(null);
  const [movementForm, setMovementForm] = useState(emptyMovement);
  const [movementFormErrors, setMovementFormErrors] = useState({});
  const [movementPage, setMovementPage] = useState(1);
  const [movementFilters, setMovementFilters] = useState({ type: "", search: "", dateFrom: "", dateTo: "" });
  const [movementData, setMovementData] = useState([]);
  const [movementPagination, setMovementPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });
  const [suppliers, setSuppliers] = useState([]);
  const [supplierForm, setSupplierForm] = useState({ name: "", code: "", contactPerson: "", email: "", phone: "", address: "", leadTimeDays: 7, rating: 3, notes: "" });
  const [supplierFormErrors, setSupplierFormErrors] = useState({});
  const [editingSupplierId, setEditingSupplierId] = useState(null);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [poForm, setPoForm] = useState({ poNumber: "", supplier: "", items: [{ item: "", quantityOrdered: 1, unitCost: 0, notes: "" }], orderDate: "", expectedDeliveryDate: "", notes: "" });
  const [poFormErrors, setPoFormErrors] = useState({});
  const [editingPoId, setEditingPoId] = useState(null);
  const [poSearch, setPoSearch] = useState("");
  const [showImportModal, setShowImportModal] = useState(false);
  const [importType, setImportType] = useState("items");
  const [importFile, setImportFile] = useState(null);
  const [importResults, setImportResults] = useState(null);
  const [importing, setImporting] = useState(false);
  const [locations, setLocations] = useState([]);
  const [locationForm, setLocationForm] = useState({ name: "", code: "", description: "", parentLocation: "" });
  const [locationFormErrors, setLocationFormErrors] = useState({});
  const [editingLocationId, setEditingLocationId] = useState(null);
  const [locationSearch, setLocationSearch] = useState("");
  const [itemTypes, setItemTypes] = useState([]);
  const [typeInput, setTypeInput] = useState("");
  const [editingTypeId, setEditingTypeId] = useState(null);
  const [showTypeInput, setShowTypeInput] = useState(false);
  const [deleteTypeTarget, setDeleteTypeTarget] = useState(null);
  const [storageConditions, setStorageConditions] = useState([]);
  const [storageConditionInput, setStorageConditionInput] = useState("");
  const [editingStorageConditionId, setEditingStorageConditionId] = useState(null);
  const [showStorageConditionInput, setShowStorageConditionInput] = useState(false);
  const [deleteStorageConditionTarget, setDeleteStorageConditionTarget] = useState(null);

  const actionBtnStyle = { width: 30, height: 30, borderRadius: 6, cursor: "pointer", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", border: "none" };

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

  async function loadInventory(page) {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (page) params.set("page", page);
      params.set("limit", "20");
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      const response = await fetch(`/api/inventory?${params.toString()}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load inventory");
      setInventory(data);
      setItemTypes(data.itemTypes || []);
      setStorageConditions(data.storageConditions || []);
      setItemPagination(data.pagination || { page: page || 1, limit: 20, total: data.items?.length || 0, totalPages: 1 });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInventory(1);
  }, []);

  useEffect(() => {
    loadInventory(itemPage);
  }, [itemPage]);

  useEffect(() => {
    if (activeTab === "movements") loadMovements(1);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "suppliers") {
      (async () => {
        try {
          const r = await fetch("/api/inventory/suppliers");
          const d = await r.json();
          if (r.ok) setSuppliers(d.suppliers || []);
        } catch {}
      })();
    }
    if (activeTab === "purchaseOrders") {
      (async () => {
        try {
          const r = await fetch("/api/inventory/purchase-orders");
          const d = await r.json();
          if (r.ok) setPurchaseOrders(d.purchaseOrders || []);
        } catch {}
      })();
    }
    if (activeTab === "locations") {
      (async () => {
        try {
          const r = await fetch("/api/inventory/locations");
          const d = await r.json();
          if (r.ok) setLocations(d.locations || []);
        } catch {}
      })();
    }
    if (activeTab === "stock" || activeTab === "items") {
      (async () => {
        try {
          const r = await fetch("/api/inventory/locations");
          const d = await r.json();
          if (r.ok && (!locations || locations.length === 0)) setLocations(d.locations || []);
        } catch {}
      })();
    }
  }, [activeTab]);

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
      setItemPage(1);
      await loadInventory(1);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function loadMovements(pageNum) {
    const p = pageNum || movementPage;
    const params = new URLSearchParams({ page: p, limit: 50 });
    if (movementFilters.type) params.set("type", movementFilters.type);
    if (movementFilters.search) params.set("search", movementFilters.search);
    if (movementFilters.dateFrom) params.set("dateFrom", movementFilters.dateFrom);
    if (movementFilters.dateTo) params.set("dateTo", movementFilters.dateTo);
    try {
      const r = await fetch(`/api/inventory/movements?${params}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setMovementData(d.movements);
      setMovementPagination(d.pagination);
    } catch (e) { setError(e.message); }
  }

  async function saveItem(event) {
    event.preventDefault();

    const errors = {};
    if (!itemForm.itemCode && editingItemId) errors.itemCode = "Item code is required";
    else if (itemForm.itemCode && !isValidItemCode(itemForm.itemCode)) errors.itemCode = "Item code must contain only capital letters, numbers, and hyphens";
    if (itemForm.itemCode && itemForm.itemCode.length > 15) errors.itemCode = "Item code must not exceed 15 characters";
    if (!itemForm.name) errors.name = "Item name is required";
    else if (!isValidName(itemForm.name)) errors.name = "Name contains invalid characters";
    if (hasUrl(itemForm.name)) errors.name = "URLs are not allowed";
    if (itemForm.name && itemForm.name.length > 120) errors.name = "Name must not exceed 120 characters";
    if (!itemForm.genericName) errors.genericName = "Generic name is required";
    else if (!/^[A-Za-z0-9]*$/.test(itemForm.genericName)) errors.genericName = "Generic name must contain only letters and numbers";
    else if (itemForm.genericName.length > 20) errors.genericName = "Generic name must not exceed 20 characters";
    const validConvUnits = ["mg", "g", "kg", "ml", "l", "IU", "µg", "unit", "pack", "oz", "lb"];
    if (!itemForm.conversionFactorUnit) errors.conversionFactorUnit = "Conversion factor unit is required";
    else if (!validConvUnits.includes(itemForm.conversionFactorUnit)) errors.conversionFactorUnit = "Invalid conversion factor unit";
    if (!itemForm.itemType) errors.itemType = "Item type is required";
    else if (!itemTypes.some((t) => t.name === itemForm.itemType)) errors.itemType = "Invalid item type";
    if (!itemForm.category) errors.category = "Category is required";
    if (!itemForm.baseUom) errors.baseUom = "Base UOM is required";
    if (!itemForm.purchaseUom) errors.purchaseUom = "Purchase UOM is required";
    if (itemForm.purchaseToBaseFactor === "" || itemForm.purchaseToBaseFactor === undefined || itemForm.purchaseToBaseFactor === null) errors.purchaseToBaseFactor = "Conversion factor is required";
    else if (isExponential(itemForm.purchaseToBaseFactor)) errors.purchaseToBaseFactor = "Exponential notation is not allowed";
    else if (Number(itemForm.purchaseToBaseFactor) <= 0) errors.purchaseToBaseFactor = "Must be greater than 0";
    else if (!isValidDecimal(itemForm.purchaseToBaseFactor)) errors.purchaseToBaseFactor = "Max 4 digits before decimal, 3 after";
    if (itemForm.minimumStockBase === "" || itemForm.minimumStockBase === undefined || itemForm.minimumStockBase === null) errors.minimumStockBase = "Min stock is required";
    else if (isExponential(itemForm.minimumStockBase)) errors.minimumStockBase = "Exponential notation is not allowed";
    else if (Number(itemForm.minimumStockBase) < 0) errors.minimumStockBase = "Cannot be negative";
    else if (!isValidDecimal(itemForm.minimumStockBase)) errors.minimumStockBase = "Max 4 digits before decimal, 3 after";
    if (itemForm.reorderLevelBase === "" || itemForm.reorderLevelBase === undefined || itemForm.reorderLevelBase === null) errors.reorderLevelBase = "Reorder level is required";
    else if (isExponential(itemForm.reorderLevelBase)) errors.reorderLevelBase = "Exponential notation is not allowed";
    else if (Number(itemForm.reorderLevelBase) < 0) errors.reorderLevelBase = "Cannot be negative";
    else if (!isValidDecimal(itemForm.reorderLevelBase)) errors.reorderLevelBase = "Max 4 digits before decimal, 3 after";
    if (itemForm.maximumStockBase === "" || itemForm.maximumStockBase === undefined || itemForm.maximumStockBase === null) errors.maximumStockBase = "Max stock is required";
    else if (isExponential(itemForm.maximumStockBase)) errors.maximumStockBase = "Exponential notation is not allowed";
    else if (Number(itemForm.maximumStockBase) < 0) errors.maximumStockBase = "Cannot be negative";
    else if (!isValidDecimal(itemForm.maximumStockBase)) errors.maximumStockBase = "Max 4 digits before decimal, 3 after";
    if (itemForm.minimumStockBase !== "" && itemForm.minimumStockBase !== undefined && itemForm.minimumStockBase !== null &&
        itemForm.reorderLevelBase !== "" && itemForm.reorderLevelBase !== undefined && itemForm.reorderLevelBase !== null) {
      if (Number(itemForm.minimumStockBase) > Number(itemForm.reorderLevelBase)) {
        errors.reorderLevelBase = "Reorder level should be >= Min stock";
      }
    }
    if (itemForm.reorderLevelBase !== "" && itemForm.reorderLevelBase !== undefined && itemForm.reorderLevelBase !== null &&
        itemForm.maximumStockBase !== "" && itemForm.maximumStockBase !== undefined && itemForm.maximumStockBase !== null) {
      if (Number(itemForm.reorderLevelBase) > Number(itemForm.maximumStockBase)) {
        errors.maximumStockBase = "Max stock should be >= Reorder level";
      }
    }
    if (itemForm.minimumStockBase !== "" && itemForm.minimumStockBase !== undefined && itemForm.minimumStockBase !== null &&
        itemForm.maximumStockBase !== "" && itemForm.maximumStockBase !== undefined && itemForm.maximumStockBase !== null) {
      if (Number(itemForm.minimumStockBase) > Number(itemForm.maximumStockBase)) {
        errors.maximumStockBase = "Max stock should be >= Min stock";
      }
    }
    if (!editingItemId) {
      if (itemForm.openingQuantityBase === "" || itemForm.openingQuantityBase === undefined || itemForm.openingQuantityBase === null) errors.openingQuantityBase = "Opening quantity is required";
      else if (isExponential(itemForm.openingQuantityBase)) errors.openingQuantityBase = "Exponential notation is not allowed";
      else if (Number(itemForm.openingQuantityBase) < 0) errors.openingQuantityBase = "Cannot be negative";
      else if (!isValidDecimal(itemForm.openingQuantityBase)) errors.openingQuantityBase = "Max 4 digits before decimal, 3 after";
      if (!itemForm.batchNo) errors.batchNo = "Batch No is required";
      else if (!/^[A-Za-z0-9]*$/.test(itemForm.batchNo)) errors.batchNo = "Only letters and numbers allowed";
      else if (itemForm.batchNo.length > 15) errors.batchNo = "Batch No must not exceed 15 characters";
    }
    if (!itemForm.manufacturer) errors.manufacturer = "Manufacturer is required";
    else if (itemForm.manufacturer.length > 20) errors.manufacturer = "Manufacturer must not exceed 20 characters";
    else if (!/^[A-Z][A-Za-z\s]*$/.test(itemForm.manufacturer)) errors.manufacturer = "Only letters and spaces allowed, starting with capital letter";
    if (!itemForm.preferredSupplier) errors.preferredSupplier = "Supplier is required";
    else if (itemForm.preferredSupplier.length > 20) errors.preferredSupplier = "Supplier must not exceed 20 characters";
    else if (!/^[A-Z][A-Za-z\s]*$/.test(itemForm.preferredSupplier)) errors.preferredSupplier = "Only letters and spaces allowed, starting with capital letter";
    if (!itemForm.defaultLocation) errors.defaultLocation = "Location is required";
    else if (itemForm.defaultLocation.length > 75) errors.defaultLocation = "Location must not exceed 75 characters";
    else if (!/^[A-Za-z0-9 .,\/-]*$/.test(itemForm.defaultLocation)) errors.defaultLocation = "Only letters, numbers, spaces, and . , / - allowed";
    if (!itemForm.storageCondition) errors.storageCondition = "Storage condition is required";
    else if (storageConditions.length > 0 && !storageConditions.some((c) => c.name === itemForm.storageCondition)) {
      errors.storageCondition = "Invalid storage condition";
    }
    if (itemForm.notes && itemForm.notes.length > 500) errors.notes = "Notes must not exceed 500 characters";
    if (!editingItemId && itemForm.trackExpiry !== false) {
      if (!itemForm.expiryDate) errors.expiryDate = "Expiry date is required";
      else {
        const emsg = validateExpiryDate(itemForm.expiryDate);
        if (emsg) errors.expiryDate = emsg;
        else if (itemForm.receivedDate) {
          const expiry = new Date(itemForm.expiryDate);
          expiry.setHours(0, 0, 0, 0);
          const received = new Date(itemForm.receivedDate);
          received.setHours(0, 0, 0, 0);
          if (expiry <= received) errors.expiryDate = "Expiry date must be after received date";
        }
      }
    }
    if (editingItemId && itemForm.status && !["active", "inactive"].includes(itemForm.status)) {
      errors.status = "Status must be 'active' or 'inactive'";
    }
    setItemFormErrors(errors);
    if (Object.keys(errors).length) return;

    if (!editingItemId) {
      await postInventory({ action: "item", ...itemForm }, (data) => {
        setItemForm(emptyItem);
        setItemFormErrors({});
        const code = data.item?.itemCode || data.generatedCode;
        setSuccessMessage(code ? `Item "${data.item?.name || itemForm.name}" created — code: ${code}` : `Inventory item "${data.item?.name || itemForm.name}" created successfully.`);
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
      setEditingItemStock(null);
      setItemForm(emptyItem);
      setSuccessMessage(`Inventory item "${data.item?.name || itemForm.name}" updated successfully.`);
      setItemPage(1);
      await loadInventory(1);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function editItem(item) {
    setEditingItemId(item._id);
    setEditingItemStock({
      stockOnHandBase: item.stockOnHandBase || 0,
      baseUomSymbol: item.baseUom?.symbol || "",
    });
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
      conversionFactorUnit: item.conversionFactorUnit || "mg",
      minimumStockBase: item.minimumStockBase || 0,
      reorderLevelBase: item.reorderLevelBase || 0,
      maximumStockBase: item.maximumStockBase || 0,
      preferredSupplier: item.preferredSupplier || "",
      manufacturer: item.manufacturer || "",
      storageCondition: item.storageCondition || "",
      defaultLocation: item.defaultLocation || "",
      trackExpiry: item.trackExpiry !== false,
      status: item.status || "active",
      notes: item.notes || "",
    });
    setActiveTab("items");
  }

  const tabs = [
    ["dashboard", "Dashboard", Icons.barChart],
    ["items", "Item Master", Icons.flask],
    ["categories", "Category", Icons.grid],
    ["uom", "UOM", Icons.settings],
    ["suppliers", "Suppliers", Icons.user],
    ["purchaseOrders", "Purchase Orders", Icons.clipboard],
    ["locations", "Locations", Icons.mapPin],
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

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {activeTab !== "categories" && <div style={{ position: "relative", minWidth: 280, flex: "0 1 360px" }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}>{Icons.search}</span>
            <input className="lims-input" maxLength={35} value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { setItemPage(1); loadInventory(1); } }} placeholder="Search item, code, category..." style={{ ...inputStyle(), paddingLeft: 38 }} />
          </div>}
          <button className="dash-btn-secondary" onClick={() => { loadInventory(itemPage); if (activeTab === "movements") loadMovements(movementPage); }} disabled={loading} style={{ height: 34, padding: "0 14px", fontSize: 12 }}><span className={loading ? "icon-spin" : ""}>{Icons.refresh}</span> Refresh</button>
          {["items", "categories", "uom", "movements"].includes(activeTab) && (
            <button className="dash-btn-secondary" onClick={() => { const typeMap = { items: "items", categories: "categories", uom: "uoms", movements: "movements" }; window.open(`/api/inventory/export?type=${typeMap[activeTab]}&search=${encodeURIComponent(searchQuery)}`, "_blank"); }} style={{ height: 34, padding: "0 14px", fontSize: 12 }}>{Icons.download} Export CSV</button>
          )}
          {["items", "categories", "uom"].includes(activeTab) && (
            <button className="dash-btn-secondary" onClick={() => { const typeMap = { items: "items", categories: "categories", uom: "uoms" }; setImportType(typeMap[activeTab] || "items"); setImportFile(null); setImportResults(null); setShowImportModal(true); }} style={{ height: 34, padding: "0 14px", fontSize: 12 }}>{Icons.plus} Import CSV</button>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>View:</span>
        <div style={{ display: "flex", background: "var(--border-light)", padding: 3, borderRadius: 8 }}>
          <button onClick={() => setViewMode("form")} style={{ padding: "6px 12px", borderRadius: 6, border: "none", background: viewMode === "form" ? "#fff" : "transparent", color: viewMode === "form" ? "var(--brand-action)" : "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, transition: "all 0.2s", boxShadow: viewMode === "form" ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18" /><path d="M3 9h18" />
            </svg>
            Form
          </button>
          <button onClick={() => setViewMode("list")} style={{ padding: "6px 12px", borderRadius: 6, border: "none", background: viewMode === "list" ? "#fff" : "transparent", color: viewMode === "list" ? "var(--brand-action)" : "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, transition: "all 0.2s", boxShadow: viewMode === "list" ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
            List
          </button>
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
                <StatCard icon={Icons.alertCircle} label="Quarantine" value={inventory.stats.quarantineBatches || 0} tone="#d97706" />
                <StatCard icon={Icons.clock} label="Near Expiry" value={inventory.stats.nearExpiryBatches || 0} tone="#1d4ed8" />
                <StatCard icon={Icons.trash} label="Expired Batches" value={inventory.stats.expiredBatches || 0} tone="#b91c1c" />
                <StatCard icon={Icons.list} label="Stock Value" value={`Rs ${formatNumber(inventory.stats.inventoryValue)}`} />
              </div>
              <InventoryTable items={filteredItems} onEdit={editItem} />
            </div>
          )}

          {activeTab === "items" && viewMode === "list" && (
            <div style={{ display: "grid", gap: 12 }}>
              <InventoryTable items={filteredItems} onEdit={editItem} />
              <PaginationControls pagination={itemPagination} loading={loading} onPageChange={setItemPage} />
            </div>
          )}
          {activeTab === "items" && viewMode === "form" && (
            <form className="form-card" onSubmit={saveItem} style={{ padding: 20, borderRadius: 8 }}>
              <h5 style={{ margin: 0, fontSize: 16, marginBottom: 16 }}>{editingItemId ? "Edit Item Master" : "Add Item Master"}</h5>
              <div className="row g-3">
                <div className="col-md-6">
                  <Field label="Item Code">
                    <input className="lims-input" required={!!editingItemId} maxLength={15} value={itemForm.itemCode} onChange={(e) => { let v = e.target.value.toUpperCase(); if (v && !isValidItemCode(v)) return; setItemFormErrors((p) => ({ ...p, itemCode: "" })); setItemForm({ ...itemForm, itemCode: v }); }} style={inputStyle()} />
                    {!editingItemId && <small style={{ color: "var(--text-muted)", fontSize: 11 }}>Leave blank to auto-generate (e.g. REAG-0001)</small>}
                    <ErrorMsg message={itemFormErrors.itemCode} />
                  </Field>
                </div>
                <div className="col-md-6">
                  <Field label="Type">
                    <select required className="lims-input" value={itemForm.itemType} onChange={(e) => setItemForm({ ...itemForm, itemType: e.target.value })} style={{ ...inputStyle(), width: "100%" }}>
                      <option value="">Select</option>
                      {itemTypes.length === 0 && <option value="">Loading...</option>}
                      {itemTypes.map((type) => <option key={type._id || type.name} value={type.name}>{type.name}</option>)}
                    </select>
                    <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                      <button type="button" title="Add type" onClick={() => { setShowTypeInput(true); setEditingTypeId(null); setTypeInput(""); }} style={{ width: 30, height: 30, borderRadius: 6, border: "1px solid #a7f3d0", background: "#ecfdf5", color: "#065f46", cursor: "pointer", fontSize: 16, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                      <button type="button" title="Edit type" onClick={() => { const t = itemTypes.find((x) => x.name === itemForm.itemType); if (t) { setEditingTypeId(t._id); setTypeInput(t.name); setShowTypeInput(true); } }} style={{ width: 30, height: 30, borderRadius: 6, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1e40af", cursor: "pointer", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center" }}>✎</button>
                      <button type="button" title="Delete type" onClick={() => { const t = itemTypes.find((x) => x.name === itemForm.itemType); if (t && t._id) setDeleteTypeTarget(t); }} style={{ width: 30, height: 30, borderRadius: 6, border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", cursor: "pointer", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                    </div>
                    {showTypeInput && (
                      <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 6 }}>
                        <input className="lims-input" autoFocus value={typeInput} onChange={(e) => setTypeInput(e.target.value)} placeholder="Type name" maxLength={50} style={{ ...inputStyle(), flex: 1, minWidth: 0 }} />
                        <button type="button" className="btn-lims-primary" disabled={!typeInput.trim()} onClick={async () => { const name = typeInput.trim(); if (!name) return; try { const url = editingTypeId ? `/api/inventory/types/${editingTypeId}` : "/api/inventory/types"; const method = editingTypeId ? "PATCH" : "POST"; const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error); setShowTypeInput(false); setEditingTypeId(null); setTypeInput(""); await loadInventory(itemPage); } catch (e) { setError(e.message); } }} style={{ height: 38, padding: "0 12px", fontSize: 12, flexShrink: 0 }}>{editingTypeId ? "Save" : "Add"}</button>
                        <button type="button" className="btn-lims-secondary" onClick={() => { setShowTypeInput(false); setEditingTypeId(null); setTypeInput(""); }} style={{ height: 38, padding: "0 12px", fontSize: 12, flexShrink: 0 }}>Cancel</button>
                      </div>
                    )}
                    <ErrorMsg message={itemFormErrors.itemType} />
                  </Field>
                </div>
                <div className="col-md-6">
                  <Field label="Item Name">
                    <input className="lims-input" required minLength={2} maxLength={120} value={itemForm.name} onChange={(e) => { const v = e.target.value; if (hasUrl(v)) { setItemFormErrors((p) => ({ ...p, name: "URLs are not allowed" })); return; } if (v && !isValidName(v)) { setItemFormErrors((p) => ({ ...p, name: "Name contains invalid characters" })); return; } setItemFormErrors((p) => ({ ...p, name: "" })); setItemForm({ ...itemForm, name: v }); }} style={inputStyle()} />
                    <ErrorMsg message={itemFormErrors.name} />
                  </Field>
                </div>
                <div className="col-md-6">
                  <Field label="Generic / Alternate Name">
                    <input className="lims-input" required maxLength={20} value={itemForm.genericName} onChange={(e) => { const v = e.target.value; if (v && !/^[A-Za-z0-9]*$/.test(v)) { setItemFormErrors((p) => ({ ...p, genericName: "Only letters and numbers allowed" })); return; } setItemFormErrors((p) => ({ ...p, genericName: "" })); setItemForm({ ...itemForm, genericName: v }); }} style={inputStyle()} />
                    <ErrorMsg message={itemFormErrors.genericName} />
                  </Field>
                </div>
                <div className="col-md-6">
                  <Field label="Category">
                    <select required className="lims-input" value={itemForm.category} onChange={(e) => { setItemFormErrors((p) => ({ ...p, category: "" })); setItemForm({ ...itemForm, category: e.target.value }); }} style={inputStyle()}>
                      <option value="">Select</option>
                      {parentCategories.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}
                    </select>
                    <ErrorMsg message={itemFormErrors.category} />
                  </Field>
                </div>
                <div className="col-md-6">
                  <Field label="Sub Category">
                    <select required className="lims-input" value={itemForm.subCategory} onChange={(e) => { setItemFormErrors((p) => ({ ...p, subCategory: "" })); setItemForm({ ...itemForm, subCategory: e.target.value }); }} style={inputStyle()}>
                      <option value="">None</option>
                      {subCategories.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}
                    </select>
                    <ErrorMsg message={itemFormErrors.subCategory} />
                  </Field>
                </div>
              </div>
              {editingItemStock && (
                <div style={{ padding: "10px 14px", borderRadius: 8, background: "#eff6ff", border: "1px solid #bfdbfe", fontSize: 13, display: "grid", gap: 4, marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, color: "#1e40af" }}>Current Stock: {formatNumber(editingItemStock.stockOnHandBase)} {editingItemStock.baseUomSymbol}</div>
                  <div style={{ color: "var(--text-secondary)", fontSize: 12 }}>Min: {formatNumber(itemForm.minimumStockBase)} / Reorder: {formatNumber(itemForm.reorderLevelBase)} / Max: {formatNumber(itemForm.maximumStockBase)}</div>
                </div>
              )}
              <div className="row g-3">
                <div className="col-md-4">
                  <Field label="Base UOM">
                    <select required className="lims-input" value={itemForm.baseUom} onChange={(e) => { const v = e.target.value; setItemFormErrors((p) => ({ ...p, baseUom: "" })); const next = { ...itemForm, baseUom: v }; if (v && v === itemForm.purchaseUom) next.purchaseToBaseFactor = 1; setItemForm(next); }} style={inputStyle()}>
                      <option value="">Select</option>
                      {inventory.uoms.map((uom) => <option key={uom._id} value={uom._id}>{uom.symbol} - {uom.name}</option>)}
                    </select>
                    <ErrorMsg message={itemFormErrors.baseUom} />
                  </Field>
                </div>
                <div className="col-md-4">
                  <Field label="Purchase UOM">
                    <select required className="lims-input" value={itemForm.purchaseUom} onChange={(e) => { const v = e.target.value; setItemFormErrors((p) => ({ ...p, purchaseUom: "" })); const next = { ...itemForm, purchaseUom: v }; if (v && v === itemForm.baseUom) next.purchaseToBaseFactor = 1; setItemForm(next); }} style={inputStyle()}>
                      <option value="">Select</option>
                      {inventory.uoms.map((uom) => <option key={uom._id} value={uom._id}>{uom.symbol} - {uom.name}</option>)}
                    </select>
                    <ErrorMsg message={itemFormErrors.purchaseUom} />
                  </Field>
                </div>
                <div className="col-md-4">
                  <Field label="Conv. Factor">
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input className="lims-input" required type="text" inputMode="decimal" value={itemForm.purchaseToBaseFactor} onChange={(e) => { const v = e.target.value; if (v !== "" && !isValidDecimal(v)) return; if (isExponential(v)) { setItemFormErrors((p) => ({ ...p, purchaseToBaseFactor: "Exponential notation is not allowed" })); return; } setItemFormErrors((p) => ({ ...p, purchaseToBaseFactor: "" })); setItemForm({ ...itemForm, purchaseToBaseFactor: v }); }} style={{ ...inputStyle(), flex: 1, minWidth: 0 }} />
                      <select className="lims-input" value={itemForm.conversionFactorUnit} onChange={(e) => setItemForm({ ...itemForm, conversionFactorUnit: e.target.value })} style={{ ...inputStyle(), width: 80, flexShrink: 0 }}>
                        {["mg", "g", "kg", "ml", "l", "IU", "µg", "unit", "pack", "oz", "lb"].map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                      </select>
                    </div>
                    {itemForm.baseUom && itemForm.purchaseUom && (() => {
                      const pu = inventory.uoms.find((u) => u._id === itemForm.purchaseUom);
                      const bu = inventory.uoms.find((u) => u._id === itemForm.baseUom);
                      return pu && bu ? <small style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 2, display: "block" }}>1 {pu.symbol} = {itemForm.purchaseToBaseFactor || 1} {itemForm.conversionFactorUnit}</small> : null;
                    })()}
                    <ErrorMsg message={itemFormErrors.purchaseToBaseFactor} />
                  </Field>
                </div>
                <div className="col-md-4">
                  <Field label="Min Stock">
                    <input className="lims-input" required type="text" inputMode="decimal" value={itemForm.minimumStockBase} onChange={(e) => { const v = e.target.value; if (v !== "" && !isValidDecimal(v)) return; if (isExponential(v)) { setItemFormErrors((p) => ({ ...p, minimumStockBase: "Exponential notation is not allowed" })); return; } setItemFormErrors((p) => ({ ...p, minimumStockBase: "" })); setItemForm({ ...itemForm, minimumStockBase: v }); }} style={inputStyle()} />
                    <ErrorMsg message={itemFormErrors.minimumStockBase} />
                  </Field>
                </div>
                <div className="col-md-4">
                  <Field label="Reorder Level">
                    <input className="lims-input" required type="text" inputMode="decimal" value={itemForm.reorderLevelBase} onChange={(e) => { const v = e.target.value; if (v !== "" && !isValidDecimal(v)) return; if (isExponential(v)) { setItemFormErrors((p) => ({ ...p, reorderLevelBase: "Exponential notation is not allowed" })); return; } setItemFormErrors((p) => ({ ...p, reorderLevelBase: "" })); setItemForm({ ...itemForm, reorderLevelBase: v }); }} style={inputStyle()} />
                    <ErrorMsg message={itemFormErrors.reorderLevelBase} />
                  </Field>
                </div>
                <div className="col-md-4">
                  <Field label="Max Stock">
                    <input className="lims-input" required type="text" inputMode="decimal" value={itemForm.maximumStockBase} onChange={(e) => { const v = e.target.value; if (v !== "" && !isValidDecimal(v)) return; if (isExponential(v)) { setItemFormErrors((p) => ({ ...p, maximumStockBase: "Exponential notation is not allowed" })); return; } setItemFormErrors((p) => ({ ...p, maximumStockBase: "" })); setItemForm({ ...itemForm, maximumStockBase: v }); }} style={inputStyle()} />
                    <ErrorMsg message={itemFormErrors.maximumStockBase} />
                  </Field>
                </div>
                <div className="col-md-6">
                  <Field label="Track Expiry">
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", height: 38 }}>
                      <input type="checkbox" checked={itemForm.trackExpiry !== false} onChange={(e) => setItemForm({ ...itemForm, trackExpiry: e.target.checked })} style={{ width: 16, height: 16 }} />
                      Enable expiry tracking
                    </label>
                  </Field>
                </div>
                {!editingItemId && (
                  <div className="col-md-6">
                    <Field label="Quarantine on Receipt">
                      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", height: 38 }}>
                        <input type="checkbox" checked={itemForm.quarantineOnReceipt === true} onChange={(e) => setItemForm({ ...itemForm, quarantineOnReceipt: e.target.checked })} style={{ width: 16, height: 16 }} />
                        Hold opening stock in quarantine
                      </label>
                    </Field>
                  </div>
                )}
                {itemForm.trackExpiry !== false && !editingItemId && (
                  <div className="col-md-6">
                    <Field label="Expiry Date">
                      <input className="lims-input" required type="date" value={itemForm.expiryDate || ""} onChange={(e) => { const v = e.target.value; const msg = validateExpiryDate(v); if (msg) { setItemFormErrors((p) => ({ ...p, expiryDate: msg })); return; } setItemFormErrors((p) => ({ ...p, expiryDate: "" })); setItemForm({ ...itemForm, expiryDate: v }); }} style={inputStyle()} />
                      <ErrorMsg message={itemFormErrors.expiryDate} />
                    </Field>
                  </div>
                )}
                {!editingItemId && (
                  <div className="col-md-6">
                    <Field label="Opening Qty">
                      <input className="lims-input" required type="text" inputMode="decimal" value={itemForm.openingQuantityBase} onChange={(e) => { const v = e.target.value; if (v !== "" && !isValidDecimal(v)) return; if (isExponential(v)) { setItemFormErrors((p) => ({ ...p, openingQuantityBase: "Exponential notation is not allowed" })); return; } setItemFormErrors((p) => ({ ...p, openingQuantityBase: "" })); setItemForm({ ...itemForm, openingQuantityBase: v }); }} style={inputStyle()} />
                      <ErrorMsg message={itemFormErrors.openingQuantityBase} />
                    </Field>
                  </div>
                )}
                {!editingItemId && (
                  <div className="col-md-6">
                    <Field label="Batch No">
                      <input className="lims-input" required maxLength={15} value={itemForm.batchNo} onChange={(e) => { const v = e.target.value.toUpperCase(); if (v && !/^[A-Za-z0-9]*$/.test(v)) { setItemFormErrors((p) => ({ ...p, batchNo: "Only letters and numbers allowed" })); return; } setItemFormErrors((p) => ({ ...p, batchNo: "" })); setItemForm({ ...itemForm, batchNo: v }); }} style={inputStyle()} />
                      <ErrorMsg message={itemFormErrors.batchNo} />
                    </Field>
                  </div>
                )}
                <div className="col-md-6">
                  <Field label="Manufacturer">
                    <input className="lims-input" required maxLength={20} value={itemForm.manufacturer} onChange={(e) => { let v = e.target.value; if (v.length > 20) return; if (v) { v = v.charAt(0).toUpperCase() + v.slice(1); if (!/^[A-Z][A-Za-z\s]*$/.test(v)) return; } setItemFormErrors((p) => ({ ...p, manufacturer: "" })); setItemForm({ ...itemForm, manufacturer: v }); }} style={inputStyle()} />
                    <ErrorMsg message={itemFormErrors.manufacturer} />
                  </Field>
                </div>
                <div className="col-md-6">
                  <Field label="Supplier">
                    <input className="lims-input" required maxLength={20} value={itemForm.preferredSupplier} onChange={(e) => { let v = e.target.value; if (v.length > 20) return; if (v) { v = v.charAt(0).toUpperCase() + v.slice(1); if (!/^[A-Z][A-Za-z\s]*$/.test(v)) return; } setItemFormErrors((p) => ({ ...p, preferredSupplier: "" })); setItemForm({ ...itemForm, preferredSupplier: v }); }} style={inputStyle()} />
                    <ErrorMsg message={itemFormErrors.preferredSupplier} />
                  </Field>
                </div>
                <div className="col-md-6">
                  <Field label="Location">
                    {locations.length > 0 ? (
                      <select required className="lims-input" value={itemForm.defaultLocation} onChange={(e) => { setItemFormErrors((p) => ({ ...p, defaultLocation: "" })); setItemForm({ ...itemForm, defaultLocation: e.target.value }); }} style={{ ...inputStyle(), width: "100%" }}>
                        <option value="">-- Select --</option>
                        {locations.filter((l) => l.status === "active").map((l) => <option key={l._id} value={l.name}>{l.code} — {l.name}</option>)}
                      </select>
                    ) : (
                      <input className="lims-input" required maxLength={75} value={itemForm.defaultLocation} onChange={(e) => { const v = e.target.value; if (v && !/^[A-Za-z0-9 .,\/-]*$/.test(v)) { setItemFormErrors((p) => ({ ...p, defaultLocation: "Only letters, numbers, spaces, and . , / - allowed" })); return; } setItemFormErrors((p) => ({ ...p, defaultLocation: "" })); setItemForm({ ...itemForm, defaultLocation: v }); }} style={inputStyle()} />
                    )}
                    <ErrorMsg message={itemFormErrors.defaultLocation} />
                  </Field>
                </div>
                <div className="col-md-6">
                  <Field label="Storage Condition">
                    <select required className="lims-input" value={itemForm.storageCondition} onChange={(e) => setItemForm({ ...itemForm, storageCondition: e.target.value })} style={{ ...inputStyle(), width: "100%" }}>
                      <option value="">-- Select --</option>
                      {storageConditions.length === 0 && <option value="">Loading...</option>}
                      {storageConditions.map((c) => <option key={c._id || c.name} value={c.name}>{c.name}</option>)}
                    </select>
                    <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                      <button type="button" title="Add storage condition" onClick={() => { setShowStorageConditionInput(true); setEditingStorageConditionId(null); setStorageConditionInput(""); }} style={{ width: 30, height: 30, borderRadius: 6, border: "1px solid #a7f3d0", background: "#ecfdf5", color: "#065f46", cursor: "pointer", fontSize: 16, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                      <button type="button" title="Edit storage condition" onClick={() => { const c = storageConditions.find((x) => x.name === itemForm.storageCondition); if (c) { setEditingStorageConditionId(c._id); setStorageConditionInput(c.name); setShowStorageConditionInput(true); } }} style={{ width: 30, height: 30, borderRadius: 6, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1e40af", cursor: "pointer", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center" }}>✎</button>
                      <button type="button" title="Delete storage condition" onClick={() => { const c = storageConditions.find((x) => x.name === itemForm.storageCondition); if (c && c._id) setDeleteStorageConditionTarget(c); }} style={{ width: 30, height: 30, borderRadius: 6, border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", cursor: "pointer", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                    </div>
                    {showStorageConditionInput && (
                      <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 6 }}>
                        <input className="lims-input" autoFocus value={storageConditionInput} onChange={(e) => setStorageConditionInput(e.target.value)} placeholder="Condition name" maxLength={80} style={{ ...inputStyle(), flex: 1, minWidth: 0 }} />
                        <button type="button" className="btn-lims-primary" disabled={!storageConditionInput.trim()} onClick={async () => { const name = storageConditionInput.trim(); if (!name) return; try { const url = editingStorageConditionId ? `/api/inventory/storage-conditions/${editingStorageConditionId}` : "/api/inventory/storage-conditions"; const method = editingStorageConditionId ? "PATCH" : "POST"; const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error); setShowStorageConditionInput(false); setEditingStorageConditionId(null); setStorageConditionInput(""); await loadInventory(itemPage); } catch (e) { setError(e.message); } }} style={{ height: 38, padding: "0 12px", fontSize: 12, flexShrink: 0 }}>{editingStorageConditionId ? "Save" : "Add"}</button>
                        <button type="button" className="btn-lims-secondary" onClick={() => { setShowStorageConditionInput(false); setEditingStorageConditionId(null); setStorageConditionInput(""); }} style={{ height: 38, padding: "0 12px", fontSize: 12, flexShrink: 0 }}>Cancel</button>
                      </div>
                    )}
                    <ErrorMsg message={itemFormErrors.storageCondition} />
                  </Field>
                </div>
                <div className="col-12">
                  <Field label="Notes">
                    <textarea className="lims-input" maxLength={500} value={itemForm.notes} onChange={(e) => { const v = e.target.value; if (v.length > 500) { setItemFormErrors((p) => ({ ...p, notes: "Notes must not exceed 500 characters" })); return; } setItemFormErrors((p) => ({ ...p, notes: "" })); setItemForm({ ...itemForm, notes: v }); }} style={{ ...inputStyle(), minHeight: 72, resize: "vertical", fontFamily: "inherit" }} />
                    <ErrorMsg message={itemFormErrors.notes} />
                  </Field>
                </div>
                {editingItemId && (
                  <div className="col-md-6">
                    <Field label="Status">
                      <select className="lims-input" value={itemForm.status} onChange={(e) => setItemForm({ ...itemForm, status: e.target.value })} style={inputStyle()}>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </Field>
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <button className="btn-lims-primary" disabled={saving} style={{ height: 38, flex: 1 }}>{saving ? "Saving..." : editingItemId ? "Update Item" : "Create Item"}</button>
                {editingItemId && <button type="button" className="btn-lims-secondary" onClick={() => { setEditingItemId(""); setEditingItemStock(null); setItemForm(emptyItem); }} style={{ height: 38 }}>Cancel</button>}
              </div>
            </form>
          )}

          {activeTab === "categories" && viewMode === "list" && (
            <div style={{ display: "grid", gap: 12 }}>
              <input className="lims-input" maxLength={35} value={categorySearch} onChange={(e) => setCategorySearch(e.target.value)} placeholder="Search categories..." style={{ ...inputStyle(), maxWidth: 300 }} />
              <MasterTable headings={["Name", "Code", "Parent", "Status"]} rows={inventory.categories.filter((c) => { const q = categorySearch.toLowerCase(); return !q || c.name.toLowerCase().includes(q) || (c.code || "").toLowerCase().includes(q) || (c.parentCategory?.name || "").toLowerCase().includes(q); }).map((category) => [category.name, category.code || "-", category.parentCategory?.name || "Main", category.status])} />
            </div>
          )}
          {activeTab === "categories" && viewMode === "form" && (
            <MastersPanel
              title="Category & Sub Category"
              onSubmit={(event) => {
                event.preventDefault();
                const errors = {};
                if (!categoryForm.name) errors.name = "Category name is required";
                else if (categoryForm.name.length > 20) errors.name = "Name must not exceed 20 characters";
                else if (!/^[A-Z][A-Za-z\s]*$/.test(categoryForm.name)) errors.name = "Must start with a capital letter and contain only letters and spaces";
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
                <div className="row g-3">
                  <div className="col-md-6">
                    <Field label="Name">
                      <input required className="lims-input" maxLength={20} value={categoryForm.name} onChange={(e) => { let v = e.target.value; if (v.length > 20) return; if (v) { v = v.charAt(0).toUpperCase() + v.slice(1); if (!/^[A-Z][A-Za-z\s]*$/.test(v)) return; } setCategoryFormErrors((p) => ({ ...p, name: "" })); setCategoryForm({ ...categoryForm, name: v }); }} style={inputStyle()} />
                      <ErrorMsg message={categoryFormErrors.name} />
                    </Field>
                  </div>
                  <div className="col-md-6">
                    <Field label="Code">
                      <input required className="lims-input" maxLength={35} value={categoryForm.code} onChange={(e) => { const v = e.target.value; if (hasUrl(v)) { setCategoryFormErrors((p) => ({ ...p, code: "URLs are not allowed" })); return; } if (v && !isValidName(v)) { setCategoryFormErrors((p) => ({ ...p, code: "Code contains invalid characters" })); return; } setCategoryFormErrors((p) => ({ ...p, code: "" })); setCategoryForm({ ...categoryForm, code: v }); }} style={inputStyle()} />
                      <ErrorMsg message={categoryFormErrors.code} />
                    </Field>
                  </div>
                  <div className="col-md-6">
                    <Field label="Parent Category">
                      <select className="lims-input" value={categoryForm.parentCategory} onChange={(e) => setCategoryForm({ ...categoryForm, parentCategory: e.target.value })} style={inputStyle()}>
                        <option value="">Main category</option>
                        {parentCategories.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}
                      </select>
                    </Field>
                  </div>
                  <div className="col-md-6">
                    <Field label="Description"><input className="lims-input" maxLength={150} value={categoryForm.description} onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })} style={inputStyle()} /></Field>
                  </div>
                </div>
              </>}
            />
          )}

          {activeTab === "uom" && viewMode === "list" && (
            <>
              <div style={{ marginBottom: 12 }}>
                <input className="lims-input" maxLength={35} value={uomSearch} onChange={(e) => setUomSearch(e.target.value)} placeholder="Search UOMs by name, symbol, type…" style={{ ...inputStyle(), maxWidth: 300 }} />
              </div>
              <MasterTable
                headings={["Name", "Symbol", "Type", "Conversion", "Base", "Action"]}
                rows={
                  inventory.uoms
                    .filter((uom) => {
                      const q = uomSearch.toLowerCase();
                      return !q || uom.name.toLowerCase().includes(q) || uom.symbol.toLowerCase().includes(q) || uom.type.toLowerCase().includes(q);
                    })
                    .map((uom) => [
                      uom.name,
                      uom.symbol,
                      uom.type,
                      `1 ${uom.symbol} = ${Number(uom.conversionToBase).toLocaleString()} ${uom.baseSymbol || uom.symbol}`,
                      uom.baseSymbol || uom.symbol,
                      <div key={uom._id} style={{ display: "flex", gap: 6 }}>
                        <button type="button" title="Edit" onClick={() => {
                          setEditingUomId(uom._id);
                          setUomForm({ name: uom.name, symbol: uom.symbol, type: uom.type, conversionToBase: uom.conversionToBase, baseSymbol: uom.baseSymbol || "" });
                          setViewMode("form");
                        }} style={{ ...actionBtnStyle, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1e40af" }}>✎</button>
                        <button type="button" title="Delete" onClick={() => setDeleteUomTarget(uom)} style={{ ...actionBtnStyle, border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b" }}>✕</button>
                      </div>
                    ])
                }
              />
              {deleteUomTarget && (
                <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "grid", placeItems: "center", zIndex: 1000 }} onClick={() => setDeleteUomTarget(null)}>
                  <div className="form-card" style={{ padding: 24, borderRadius: 12, maxWidth: 380, width: "90%", display: "grid", gap: 12 }} onClick={(e) => e.stopPropagation()}>
                    <h5 style={{ margin: 0, fontSize: 16 }}>Delete UOM</h5>
                    <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
                      Are you sure you want to delete <strong>{deleteUomTarget.symbol}</strong> ({deleteUomTarget.name})?
                    </p>
                    <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                      <button type="button" className="btn-lims-secondary" onClick={() => setDeleteUomTarget(null)} style={{ flex: 1, height: 38 }}>Cancel</button>
                      <button type="button" className="btn-lims-primary" style={{ flex: 1, height: 38, background: "#dc2626", borderColor: "#dc2626" }} onClick={async () => {
                        try {
                          const r = await fetch(`/api/inventory/uoms/${deleteUomTarget._id}`, { method: "DELETE" });
                          const d = await r.json();
                          if (!r.ok) throw new Error(d.error);
                          setDeleteUomTarget(null);
                          await loadInventory(itemPage);
                        } catch (e) { setError(e.message); setDeleteUomTarget(null); }
                      }}>Delete</button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          {activeTab === "uom" && viewMode === "form" && (
            <MastersPanel
              title="UOM Management & Conversion"
              form={uomForm}
              setForm={setUomForm}
              onSubmit={(event) => {
                event.preventDefault();
                const errors = {};
                if (!uomForm.name) errors.name = "UOM name is required";
                else if (!isLettersOnly(uomForm.name)) errors.name = "Name must contain only letters";
                if (!uomForm.symbol) errors.symbol = "Symbol is required";
                if (!uomForm.conversionToBase && uomForm.conversionToBase !== 0) errors.conversionToBase = "Conversion to base is required";
                else if (isExponential(uomForm.conversionToBase)) errors.conversionToBase = "Exponential notation is not allowed";
                else if (Number(uomForm.conversionToBase) <= 0) errors.conversionToBase = "Must be greater than 0";
                if (!uomForm.baseSymbol) errors.baseSymbol = "Base symbol is required";
                setUomFormErrors(errors);
                if (Object.keys(errors).length) return;

                const url = editingUomId ? `/api/inventory/uoms/${editingUomId}` : "/api/inventory";
                const method = editingUomId ? "PATCH" : "POST";
                const body = editingUomId
                  ? { name: uomForm.name, symbol: uomForm.symbol, type: uomForm.type, conversionToBase: uomForm.conversionToBase, baseSymbol: uomForm.baseSymbol }
                  : { action: "uom", ...uomForm };

                (async () => {
                  try {
                    const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
                    const d = await r.json();
                    if (!r.ok) throw new Error(d.error);
                    setUomForm({ name: "", symbol: "", type: "count", conversionToBase: 1, baseSymbol: "" });
                    setUomFormErrors({});
                    setEditingUomId(null);
                    setSuccessMessage(`UOM "${d.uom?.symbol || uomForm.symbol}" ${editingUomId ? "updated" : "created"} successfully.`);
                    await loadInventory(itemPage);
                  } catch (e) { setError(e.message); }
                })();
              }}
              saving={saving}
              fields={<>
                <div className="row g-3">
                  <div className="col-md-6">
                    <Field label="Type">
                      <select className="lims-input" value={uomForm.type} onChange={(e) => {
                        const newType = e.target.value;
                        const currentMatch = COMMON_UOMS.find((u) => u.symbol === uomForm.symbol && u.type === newType);
                        setUomForm({ ...uomForm, type: newType, symbol: currentMatch ? uomForm.symbol : "", name: "", baseSymbol: "", conversionToBase: 1 });
                      }} style={inputStyle()}>
                        {["count", "volume", "weight", "length", "time", "pack", "other"].map((type) => <option key={type} value={type}>{type}</option>)}
                      </select>
                    </Field>
                  </div>
                  <div className="col-md-6">
                    <Field label="Symbol">
                      <select required className="lims-input" value={uomForm.symbol} onChange={(e) => {
                        const sel = e.target.value;
                        const found = COMMON_UOMS.find((u) => u.symbol === sel);
                        if (found) {
                          setUomForm({ ...uomForm, symbol: found.symbol, name: found.name, baseSymbol: found.baseSymbol, conversionToBase: found.conversionToBase });
                        }
                      }} style={inputStyle()}>
                        <option value="">-- Select --</option>
                        {COMMON_UOMS.filter((u) => uomForm.type === "other" || u.type === uomForm.type).map((u) => (
                          <option key={u.symbol} value={u.symbol}>{u.symbol} — {u.name}</option>
                        ))}
                      </select>
                      <ErrorMsg message={uomFormErrors.symbol} />
                    </Field>
                  </div>
                  <div className="col-md-6">
                    <Field label="Name">
                      <input required className="lims-input" maxLength={60} value={uomForm.name} onChange={(e) => { const v = e.target.value; if (v && !isLettersOnly(v)) { setUomFormErrors((p) => ({ ...p, name: "Name must contain only letters" })); return; } setUomFormErrors((p) => ({ ...p, name: "" })); setUomForm({ ...uomForm, name: v }); }} style={inputStyle()} />
                      <ErrorMsg message={uomFormErrors.name} />
                    </Field>
                  </div>
                  <div className="col-md-6">
                    <Field label="Base Symbol">
                      <select required className="lims-input" value={uomForm.baseSymbol} onChange={(e) => setUomForm({ ...uomForm, baseSymbol: e.target.value })} style={inputStyle()}>
                        <option value="">-- Select --</option>
                        {COMMON_UOMS.filter((u) => BASE_UNIT_SYMBOLS.includes(u.symbol) && (uomForm.type === "other" || u.type === uomForm.type)).map((u) => (
                          <option key={u.symbol} value={u.symbol}>{u.symbol} — {u.name}</option>
                        ))}
                      </select>
                      <ErrorMsg message={uomFormErrors.baseSymbol} />
                    </Field>
                  </div>
                  <div className="col-md-6">
                    <Field label="Conversion to Base">
                      <input required className="lims-input" type="number" min="0" max="9999999" step="0.001" value={uomForm.conversionToBase} onChange={(e) => { const v = e.target.value; if (isExponential(v)) { setUomFormErrors((p) => ({ ...p, conversionToBase: "Exponential notation is not allowed" })); return; } if (v.replace('.', '').length > 7) { setUomFormErrors((p) => ({ ...p, conversionToBase: "Maximum 7 digits allowed" })); return; } setUomFormErrors((p) => ({ ...p, conversionToBase: "" })); setUomForm({ ...uomForm, conversionToBase: v }); }} style={inputStyle()} />
                      <ErrorMsg message={uomFormErrors.conversionToBase} />
                    </Field>
                  </div>
                </div>
              </>}
            />
          )}

          {activeTab === "suppliers" && (
            <MastersPanel
              title={editingSupplierId ? "Edit Supplier" : "Add Supplier"}
              viewMode={viewMode}
              onOpenForm={() => { setEditingSupplierId(null); setSupplierForm({ name: "", code: "", contactPerson: "", email: "", phone: "", address: "", leadTimeDays: 7, rating: 3, notes: "" }); setSupplierFormErrors({}); setViewMode("form"); }}
              onBack={() => { setEditingSupplierId(null); setViewMode("list"); }}
              formContent={<>
                <div className="row g-3">
                  <div className="col-md-6">
                    <Field label="Supplier Name">
                      <input required className="lims-input" maxLength={120} value={supplierForm.name} onChange={(e) => { const v = e.target.value; if (v && !isLettersAndBasic(v)) { setSupplierFormErrors((p) => ({ ...p, name: "Name contains invalid characters" })); return; } if (/https?:\/\//.test(v)) { setSupplierFormErrors((p) => ({ ...p, name: "URLs are not allowed" })); return; } setSupplierFormErrors((p) => ({ ...p, name: "" })); setSupplierForm({ ...supplierForm, name: v }); }} style={inputStyle()} />
                      <ErrorMsg message={supplierFormErrors.name} />
                    </Field>
                  </div>
                  <div className="col-md-6">
                    <Field label="Code">
                      <input required className="lims-input" maxLength={20} value={supplierForm.code} onChange={(e) => { let v = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""); setSupplierFormErrors((p) => ({ ...p, code: "" })); setSupplierForm({ ...supplierForm, code: v }); }} style={inputStyle()} />
                      <ErrorMsg message={supplierFormErrors.code} />
                    </Field>
                  </div>
                  <div className="col-md-6">
                    <Field label="Contact Person">
                      <input className="lims-input" maxLength={100} value={supplierForm.contactPerson} onChange={(e) => { const v = e.target.value; if (v && !isLettersAndBasic(v)) { setSupplierFormErrors((p) => ({ ...p, contactPerson: "Invalid characters" })); return; } setSupplierFormErrors((p) => ({ ...p, contactPerson: "" })); setSupplierForm({ ...supplierForm, contactPerson: v }); }} style={inputStyle()} />
                      <ErrorMsg message={supplierFormErrors.contactPerson} />
                    </Field>
                  </div>
                  <div className="col-md-6">
                    <Field label="Email">
                      <input className="lims-input" type="email" maxLength={100} value={supplierForm.email} onChange={(e) => { setSupplierFormErrors((p) => ({ ...p, email: "" })); setSupplierForm({ ...supplierForm, email: e.target.value }); }} style={inputStyle()} />
                      <ErrorMsg message={supplierFormErrors.email} />
                    </Field>
                  </div>
                  <div className="col-md-6">
                    <Field label="Phone">
                      <input className="lims-input" maxLength={20} value={supplierForm.phone} onChange={(e) => { const v = e.target.value; if (v && !/^[0-9+\-() ]*$/.test(v)) { setSupplierFormErrors((p) => ({ ...p, phone: "Phone contains invalid characters" })); return; } setSupplierFormErrors((p) => ({ ...p, phone: "" })); setSupplierForm({ ...supplierForm, phone: v }); }} style={inputStyle()} />
                      <ErrorMsg message={supplierFormErrors.phone} />
                    </Field>
                  </div>
                  <div className="col-md-6">
                    <Field label="Lead Time (Days)">
                      <input className="lims-input" type="number" min="0" max="999" value={supplierForm.leadTimeDays} onChange={(e) => { const v = Number(e.target.value); setSupplierFormErrors((p) => ({ ...p, leadTimeDays: "" })); setSupplierForm({ ...supplierForm, leadTimeDays: Number.isFinite(v) ? v : 0 }); }} style={inputStyle()} />
                      <ErrorMsg message={supplierFormErrors.leadTimeDays} />
                    </Field>
                  </div>
                  <div className="col-md-6">
                    <Field label="Rating">
                      <select className="lims-input" value={supplierForm.rating} onChange={(e) => setSupplierForm({ ...supplierForm, rating: Number(e.target.value) })} style={{ ...inputStyle(), width: "100%" }}>
                        {[1,2,3,4,5].map((r) => <option key={r} value={r}>{r} — {"★".repeat(r)}</option>)}
                      </select>
                    </Field>
                  </div>
                  <div className="col-12">
                    <Field label="Address">
                      <input className="lims-input" maxLength={300} value={supplierForm.address} onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })} style={inputStyle()} />
                    </Field>
                  </div>
                  <div className="col-12">
                    <Field label="Notes">
                      <input className="lims-input" maxLength={500} value={supplierForm.notes} onChange={(e) => setSupplierForm({ ...supplierForm, notes: e.target.value })} style={inputStyle()} />
                    </Field>
                  </div>
                </div>
              </>}
              listContent={
                <>
                  <input className="lims-input" maxLength={35} value={supplierSearch} onChange={(e) => setSupplierSearch(e.target.value)} placeholder="Search suppliers by name, code, contact…" style={{ ...inputStyle(), maxWidth: 300 }} />
                  <MasterTable
                    headings={["Code", "Name", "Contact", "Email", "Lead Time", "Rating", "Action"]}
                    rows={
                      suppliers
                        .filter((s) => {
                          const q = supplierSearch.toLowerCase();
                          return !q || s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q) || (s.contactPerson || "").toLowerCase().includes(q);
                        })
                        .map((s) => [
                          s.code,
                          s.name,
                          s.contactPerson || "—",
                          s.email || "—",
                          `${s.leadTimeDays || 0}d`,
                          "★".repeat(s.rating || 3),
                          <div key={s._id} style={{ display: "flex", gap: 6 }}>
                            <button type="button" title="Edit" onClick={() => {
                              setEditingSupplierId(s._id);
                              setSupplierForm({ name: s.name, code: s.code, contactPerson: s.contactPerson || "", email: s.email || "", phone: s.phone || "", address: s.address || "", leadTimeDays: s.leadTimeDays || 7, rating: s.rating || 3, notes: s.notes || "" });
                              setViewMode("form");
                            }} style={{ ...actionBtnStyle, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1e40af" }}>✎</button>
                            <button type="button" title="Deactivate" className="btn-icon-delete" onClick={async () => {
                              if (!confirm(`Deactivate supplier "${s.name}"?`)) return;
                              try {
                                const r = await fetch(`/api/inventory/suppliers/${s._id}`, { method: "DELETE" });
                                const d = await r.json();
                                if (!r.ok) throw new Error(d.error);
                                setSuppliers((prev) => prev.filter((x) => x._id !== s._id));
                                setSuccessMessage(`Supplier "${s.name}" deactivated`);
                              } catch (err) { setError(err.message); }
                            }}>🗑</button>
                          </div>
                        ])
                    }
                  />
                </>
              }
              formOnSubmit={async (e) => {
                e.preventDefault();
                const errors = {};
                const name = (supplierForm.name || "").trim();
                const code = (supplierForm.code || "").trim().toUpperCase();
                if (!name) errors.name = "Supplier name is required";
                else if (name.length > 120) errors.name = "Must not exceed 120 characters";
                else if (!isLettersAndBasic(name)) errors.name = "Name contains invalid characters";
                else if (/https?:\/\//.test(name)) errors.name = "URLs are not allowed";
                if (!code) errors.code = "Code is required";
                else if (code.length > 20) errors.code = "Must not exceed 20 characters";
                else if (!/^[A-Z0-9-]+$/.test(code)) errors.code = "Only uppercase letters, numbers, and hyphens allowed";
                const cp = (supplierForm.contactPerson || "").trim();
                if (cp && !isLettersAndBasic(cp)) errors.contactPerson = "Invalid characters";
                if (cp && /https?:\/\//.test(cp)) errors.contactPerson = "URLs are not allowed";
                const email = (supplierForm.email || "").trim();
                if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Invalid email format";
                const phone = (supplierForm.phone || "").trim();
                if (phone && !/^[0-9+\-() ]+$/.test(phone)) errors.phone = "Phone contains invalid characters";
                const ltd = Number(supplierForm.leadTimeDays);
                if (!Number.isFinite(ltd) || ltd < 0) errors.leadTimeDays = "Must be a non-negative number";
                if (Object.keys(errors).length) { setSupplierFormErrors(errors); return; }
                const payload = { name, code, contactPerson: cp || undefined, email: email || undefined, phone: phone || undefined, address: (supplierForm.address || "").trim() || undefined, leadTimeDays: ltd, rating: Number(supplierForm.rating) || 3, notes: (supplierForm.notes || "").trim() || undefined };
                setSaving(true);
                try {
                  const url = editingSupplierId ? `/api/inventory/suppliers/${editingSupplierId}` : "/api/inventory/suppliers";
                  const r = await fetch(url, { method: editingSupplierId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
                  const d = await r.json();
                  if (!r.ok) throw new Error(d.error);
                  setSuppliers((prev) => editingSupplierId ? prev.map((s) => s._id === editingSupplierId ? d.supplier : s) : [...prev, d.supplier]);
                  setSuccessMessage(editingSupplierId ? `Supplier "${d.supplier.name}" updated` : `Supplier "${d.supplier.name}" created`);
                  setEditingSupplierId(null);
                  setSupplierForm({ name: "", code: "", contactPerson: "", email: "", phone: "", address: "", leadTimeDays: 7, rating: 3, notes: "" });
                  setSupplierFormErrors({});
                  setViewMode("list");
                } catch (err) { setError(err.message); } finally { setSaving(false); }
              }}
            />
          )}

          {activeTab === "purchaseOrders" && (
            <MastersPanel
              title={editingPoId ? "Edit Purchase Order" : "New Purchase Order"}
              viewMode={viewMode}
              onOpenForm={() => { setEditingPoId(null); setPoForm({ poNumber: "", supplier: "", items: [{ item: "", quantityOrdered: 1, unitCost: 0, notes: "" }], orderDate: "", expectedDeliveryDate: "", notes: "" }); setPoFormErrors({}); setViewMode("form"); }}
              onBack={() => { setEditingPoId(null); setViewMode("list"); }}
              formContent={<>
                <div className="row g-3">
                  <div className="col-md-6">
                    <Field label="PO Number">
                      <input required className="lims-input" maxLength={30} value={poForm.poNumber} onChange={(e) => { let v = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""); setPoFormErrors((p) => ({ ...p, poNumber: "" })); setPoForm({ ...poForm, poNumber: v }); }} style={inputStyle()} />
                      <ErrorMsg message={poFormErrors.poNumber} />
                    </Field>
                  </div>
                  <div className="col-md-6">
                    <Field label="Supplier">
                      <select required className="lims-input" value={poForm.supplier} onChange={(e) => setPoForm({ ...poForm, supplier: e.target.value })} style={{ ...inputStyle(), width: "100%" }}>
                        <option value="">-- Select --</option>
                        {suppliers.filter((s) => s.status === "active").map((s) => <option key={s._id} value={s._id}>{s.code} — {s.name}</option>)}
                      </select>
                      <ErrorMsg message={poFormErrors.supplier} />
                    </Field>
                  </div>
                  <div className="col-md-6">
                    <Field label="Order Date">
                      <input className="lims-input" type="date" value={poForm.orderDate} onChange={(e) => setPoForm({ ...poForm, orderDate: e.target.value })} style={inputStyle()} />
                    </Field>
                  </div>
                  <div className="col-md-6">
                    <Field label="Expected Delivery">
                      <input className="lims-input" type="date" value={poForm.expectedDeliveryDate} onChange={(e) => setPoForm({ ...poForm, expectedDeliveryDate: e.target.value })} style={inputStyle()} />
                    </Field>
                  </div>
                </div>
                <div style={{ marginTop: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <strong style={{ fontSize: 13 }}>Line Items</strong>
                    <button type="button" className="btn-lims-secondary" onClick={() => setPoForm({ ...poForm, items: [...poForm.items, { item: "", quantityOrdered: 1, unitCost: 0, notes: "" }] })} style={{ height: 30, padding: "0 10px", fontSize: 12 }}>+ Add Item</button>
                  </div>
                  {poForm.items.map((line, idx) => (
                    <div key={idx} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 36px", gap: 8, marginBottom: 6, alignItems: "start" }}>
                      <select required className="lims-input" value={line.item} onChange={(e) => { const items = [...poForm.items]; items[idx] = { ...items[idx], item: e.target.value }; setPoForm({ ...poForm, items }); }} style={{ ...inputStyle(), fontSize: 12 }}>
                        <option value="">Select item</option>
                        {inventory.items.filter((it) => it.status === "active").map((it) => <option key={it._id} value={it._id}>{it.itemCode} — {it.name}</option>)}
                      </select>
                      <input className="lims-input" type="number" min="1" value={line.quantityOrdered} onChange={(e) => { const items = [...poForm.items]; items[idx] = { ...items[idx], quantityOrdered: Number(e.target.value) }; setPoForm({ ...poForm, items }); }} style={{ ...inputStyle(), fontSize: 12 }} />
                      <input className="lims-input" type="number" min="0" step="0.01" value={line.unitCost} onChange={(e) => { const items = [...poForm.items]; items[idx] = { ...items[idx], unitCost: Number(e.target.value) }; setPoForm({ ...poForm, items }); }} style={{ ...inputStyle(), fontSize: 12 }} />
                      <div style={{ fontSize: 12, paddingTop: 8, color: "var(--text-secondary)" }}>Rs {(line.quantityOrdered * line.unitCost).toFixed(2)}</div>
                      {poForm.items.length > 1 && <button type="button" title="Remove" className="btn-icon-delete" onClick={() => { const items = poForm.items.filter((_, i) => i !== idx); setPoForm({ ...poForm, items }); }} style={{ marginTop: 4 }}>🗑</button>}
                    </div>
                  ))}
                  <div style={{ textAlign: "right", fontSize: 13, fontWeight: 600, marginTop: 8 }}>
                    Total: Rs {poForm.items.reduce((sum, l) => sum + (l.quantityOrdered * l.unitCost), 0).toFixed(2)}
                  </div>
                </div>
                <div className="row g-3" style={{ marginTop: 12 }}>
                  <div className="col-12">
                    <Field label="Notes">
                      <input className="lims-input" maxLength={500} value={poForm.notes} onChange={(e) => setPoForm({ ...poForm, notes: e.target.value })} style={inputStyle()} />
                    </Field>
                  </div>
                </div>
              </>}
              listContent={
                <>
                  <input className="lims-input" maxLength={35} value={poSearch} onChange={(e) => setPoSearch(e.target.value)} placeholder="Search POs by number, notes…" style={{ ...inputStyle(), maxWidth: 300 }} />
                  <MasterTable
                    headings={["PO Number", "Supplier", "Items", "Total", "Status", "Action"]}
                    rows={
                      purchaseOrders
                        .filter((po) => {
                          const q = poSearch.toLowerCase();
                          return !q || po.poNumber.toLowerCase().includes(q) || (po.notes || "").toLowerCase().includes(q);
                        })
                        .map((po) => [
                          po.poNumber,
                          po.supplier?.name || "—",
                          `${po.items?.length || 0} line(s)`,
                          `Rs ${(po.totalAmount || 0).toFixed(2)}`,
                          <span key={`status-${po._id}`} style={{ display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: po.status === "received" ? "#dcfce7" : po.status === "cancelled" ? "#fee2e2" : po.status === "submitted" ? "#dbeafe" : "#f3f4f6", color: po.status === "received" ? "#166534" : po.status === "cancelled" ? "#991b1b" : po.status === "submitted" ? "#1e40af" : "#374151" }}>{po.status.replace(/_/g, " ")}</span>,
                          <div key={po._id} style={{ display: "flex", gap: 6 }}>
                            {po.status === "draft" && <button type="button" title="Submit" onClick={async () => {
                              try {
                                const r = await fetch(`/api/inventory/purchase-orders/${po._id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "submitted" }) });
                                const d = await r.json();
                                if (!r.ok) throw new Error(d.error);
                                setPurchaseOrders((prev) => prev.map((p) => p._id === po._id ? { ...p, status: "submitted" } : p));
                                setSuccessMessage(`PO "${po.poNumber}" submitted`);
                              } catch (err) { setError(err.message); }
                            }} style={{ ...actionBtnStyle, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1e40af", fontSize: 11 }}>Submit</button>}
                            {["submitted", "partially_received"].includes(po.status) && <button type="button" title="Receive" onClick={async () => {
                              try {
                                const receivedItems = po.items.map((it) => ({ itemId: it._id, quantityReceived: it.quantityOrdered - (it.quantityReceived || 0) }));
                                const r = await fetch(`/api/inventory/purchase-orders/${po._id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "received", receivedItems }) });
                                const d = await r.json();
                                if (!r.ok) throw new Error(d.error);
                                setPurchaseOrders((prev) => prev.map((p) => p._id === po._id ? { ...p, status: "received" } : p));
                                setSuccessMessage(`PO "${po.poNumber}" marked as received`);
                              } catch (err) { setError(err.message); }
                            }} style={{ ...actionBtnStyle, border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#166534", fontSize: 11 }}>Receive</button>}
                            {po.status !== "cancelled" && po.status !== "received" && <button type="button" title="Cancel" onClick={async () => {
                              if (!confirm(`Cancel PO "${po.poNumber}"?`)) return;
                              try {
                                const r = await fetch(`/api/inventory/purchase-orders/${po._id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "cancelled" }) });
                                const d = await r.json();
                                if (!r.ok) throw new Error(d.error);
                                setPurchaseOrders((prev) => prev.map((p) => p._id === po._id ? { ...p, status: "cancelled" } : p));
                                setSuccessMessage(`PO "${po.poNumber}" cancelled`);
                              } catch (err) { setError(err.message); }
                            }} style={{ ...actionBtnStyle, border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", fontSize: 11 }}>Cancel</button>}
                            {(po.status === "draft" || po.status === "cancelled") && <button type="button" title="Delete" className="btn-icon-delete" onClick={async () => {
                              if (!confirm(`Delete PO "${po.poNumber}"?`)) return;
                              try {
                                const r = await fetch(`/api/inventory/purchase-orders/${po._id}`, { method: "DELETE" });
                                const d = await r.json();
                                if (!r.ok) throw new Error(d.error);
                                setPurchaseOrders((prev) => prev.filter((p) => p._id !== po._id));
                                setSuccessMessage(`PO "${po.poNumber}" deleted`);
                              } catch (err) { setError(err.message); }
                            }}>🗑</button>}
                          </div>
                        ])
                    }
                  />
                </>
              }
              formOnSubmit={async (e) => {
                e.preventDefault();
                const errors = {};
                const poNum = (poForm.poNumber || "").trim();
                if (!poNum) errors.poNumber = "PO number is required";
                else if (poNum.length > 30) errors.poNumber = "Must not exceed 30 characters";
                else if (!/^[A-Z0-9-]+$/.test(poNum)) errors.poNumber = "Only uppercase letters, numbers, and hyphens allowed";
                if (!poForm.supplier) errors.supplier = "Supplier is required";
                const validItems = poForm.items.filter((it) => it.item);
                if (validItems.length === 0) errors.items = "At least one item is required";
                if (Object.keys(errors).length) { setPoFormErrors(errors); return; }
                const payload = {
                  poNumber: poNum,
                  supplier: poForm.supplier,
                  items: validItems.map((it) => ({ item: it.item, quantityOrdered: Number(it.quantityOrdered) || 1, unitCost: Number(it.unitCost) || 0, notes: (it.notes || "").trim() || undefined })),
                  orderDate: poForm.orderDate || undefined,
                  expectedDeliveryDate: poForm.expectedDeliveryDate || undefined,
                  notes: (poForm.notes || "").trim() || undefined,
                };
                setSaving(true);
                try {
                  const r = await fetch("/api/inventory/purchase-orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
                  const d = await r.json();
                  if (!r.ok) throw new Error(d.error);
                  setPurchaseOrders((prev) => [d.purchaseOrder, ...prev]);
                  setSuccessMessage(`PO "${d.purchaseOrder.poNumber}" created`);
                  setEditingPoId(null);
                  setPoForm({ poNumber: "", supplier: "", items: [{ item: "", quantityOrdered: 1, unitCost: 0, notes: "" }], orderDate: "", expectedDeliveryDate: "", notes: "" });
                  setPoFormErrors({});
                  setViewMode("list");
                } catch (err) { setError(err.message); } finally { setSaving(false); }
              }}
            />
          )}

          {activeTab === "locations" && (
            <MastersPanel
              title={editingLocationId ? "Edit Location" : "Add Location"}
              viewMode={viewMode}
              onOpenForm={() => { setEditingLocationId(null); setLocationForm({ name: "", code: "", description: "", parentLocation: "" }); setLocationFormErrors({}); setViewMode("form"); }}
              onBack={() => { setEditingLocationId(null); setViewMode("list"); }}
              formContent={<>
                <div className="row g-3">
                  <div className="col-md-6">
                    <Field label="Location Name">
                      <input required className="lims-input" maxLength={120} value={locationForm.name} onChange={(e) => { const v = e.target.value; if (v && !isValidName(v)) { setLocationFormErrors((p) => ({ ...p, name: "Name contains invalid characters" })); return; } if (/https?:\/\//.test(v)) { setLocationFormErrors((p) => ({ ...p, name: "URLs are not allowed" })); return; } setLocationFormErrors((p) => ({ ...p, name: "" })); setLocationForm({ ...locationForm, name: v }); }} style={inputStyle()} />
                      <ErrorMsg message={locationFormErrors.name} />
                    </Field>
                  </div>
                  <div className="col-md-6">
                    <Field label="Code">
                      <input required className="lims-input" maxLength={20} value={locationForm.code} onChange={(e) => { let v = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""); setLocationFormErrors((p) => ({ ...p, code: "" })); setLocationForm({ ...locationForm, code: v }); }} style={inputStyle()} />
                      <ErrorMsg message={locationFormErrors.code} />
                    </Field>
                  </div>
                  <div className="col-md-6">
                    <Field label="Parent Location">
                      <select className="lims-input" value={locationForm.parentLocation} onChange={(e) => setLocationForm({ ...locationForm, parentLocation: e.target.value })} style={{ ...inputStyle(), width: "100%" }}>
                        <option value="">None (top-level)</option>
                        {locations.filter((l) => l.status === "active" && l._id !== editingLocationId).map((l) => <option key={l._id} value={l._id}>{l.code} — {l.name}</option>)}
                      </select>
                    </Field>
                  </div>
                  <div className="col-12">
                    <Field label="Description">
                      <input className="lims-input" maxLength={300} value={locationForm.description} onChange={(e) => setLocationForm({ ...locationForm, description: e.target.value })} style={inputStyle()} />
                    </Field>
                  </div>
                </div>
              </>}
              listContent={
                <>
                  <input className="lims-input" maxLength={35} value={locationSearch} onChange={(e) => setLocationSearch(e.target.value)} placeholder="Search locations by name, code…" style={{ ...inputStyle(), maxWidth: 300 }} />
                  <MasterTable
                    headings={["Code", "Name", "Description", "Parent", "Status", "Action"]}
                    rows={
                      locations
                        .filter((l) => {
                          const q = locationSearch.toLowerCase();
                          return !q || l.name.toLowerCase().includes(q) || l.code.toLowerCase().includes(q);
                        })
                        .map((l) => [
                          l.code,
                          l.name,
                          l.description || "—",
                          l.parentLocation?.name || "—",
                          <span key={`status-${l._id}`} style={{ display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: l.status === "active" ? "#dcfce7" : "#fee2e2", color: l.status === "active" ? "#166534" : "#991b1b" }}>{l.status}</span>,
                          <div key={l._id} style={{ display: "flex", gap: 6 }}>
                            <button type="button" title="Edit" onClick={() => {
                              setEditingLocationId(l._id);
                              setLocationForm({ name: l.name, code: l.code, description: l.description || "", parentLocation: l.parentLocation?._id || l.parentLocation || "" });
                              setViewMode("form");
                            }} style={{ ...actionBtnStyle, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1e40af" }}>✎</button>
                            <button type="button" title="Delete" className="btn-icon-delete" onClick={async () => {
                              if (!confirm(`Delete location "${l.name}"?`)) return;
                              try {
                                const r = await fetch(`/api/inventory/locations/${l._id}`, { method: "DELETE" });
                                const d = await r.json();
                                if (!r.ok) throw new Error(d.error);
                                setLocations((prev) => prev.filter((x) => x._id !== l._id));
                                setSuccessMessage(`Location "${l.name}" deleted`);
                              } catch (err) { setError(err.message); }
                            }}>🗑</button>
                          </div>
                        ])
                    }
                  />
                </>
              }
              formOnSubmit={async (e) => {
                e.preventDefault();
                const errors = {};
                const name = (locationForm.name || "").trim();
                const code = (locationForm.code || "").trim().toUpperCase();
                if (!name) errors.name = "Name is required";
                else if (name.length > 120) errors.name = "Must not exceed 120 characters";
                else if (!isValidName(name)) errors.name = "Name contains invalid characters";
                else if (/https?:\/\//.test(name)) errors.name = "URLs are not allowed";
                if (!code) errors.code = "Code is required";
                else if (code.length > 20) errors.code = "Must not exceed 20 characters";
                else if (!/^[A-Z0-9-]+$/.test(code)) errors.code = "Only uppercase letters, numbers, and hyphens allowed";
                if (Object.keys(errors).length) { setLocationFormErrors(errors); return; }
                const payload = { name, code, description: (locationForm.description || "").trim() || undefined, parentLocation: locationForm.parentLocation || undefined };
                setSaving(true);
                try {
                  const url = editingLocationId ? `/api/inventory/locations/${editingLocationId}` : "/api/inventory/locations";
                  const r = await fetch(url, { method: editingLocationId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
                  const d = await r.json();
                  if (!r.ok) throw new Error(d.error);
                  if (editingLocationId) {
                    setLocations((prev) => prev.map((l) => l._id === editingLocationId ? d.location : l));
                    setSuccessMessage(`Location "${d.location.name}" updated`);
                  } else {
                    setLocations((prev) => [...prev, d.location]);
                    setSuccessMessage(`Location "${d.location.name}" created`);
                  }
                  setEditingLocationId(null);
                  setLocationForm({ name: "", code: "", description: "", parentLocation: "" });
                  setLocationFormErrors({});
                  setViewMode("list");
                } catch (err) { setError(err.message); } finally { setSaving(false); }
              }}
            />
          )}

          {activeTab === "stock" && (
            <StockPanel
              viewMode={viewMode}
              form={movementForm}
              setForm={setMovementForm}
              item={selectedMovementItem}
              items={inventory.items}
              saving={saving}
              errors={movementFormErrors}
              setErrors={setMovementFormErrors}
              locations={locations}
              onRelease={async (itemId, batchId) => {
                try {
                  const r = await fetch("/api/inventory", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "release", itemId, batchId }) });
                  const d = await r.json();
                  if (!r.ok) throw new Error(d.error);
                  setSuccessMessage("Batch released from quarantine");
                  await loadInventory(itemPage);
                } catch (err) { setError(err.message); }
              }}
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
                  else if (movementForm.movementType === "issue") {
                    if (!/^[A-Za-z0-9 -]*$/.test(toLocVal)) errors.toLocation = "Only letters, numbers and - allowed";
                  } else if (!isValidLocation(toLocVal)) errors.toLocation = "Location contains invalid characters";
                  if (hasUrl(toLocVal)) errors.toLocation = "URLs are not allowed";
                }
                const refNo = movementForm.referenceNo || "";
                if (!refNo) errors.referenceNo = "Reference No is required";
                else if (!/^[A-Z0-9]*$/.test(refNo)) errors.referenceNo = "Only letters and numbers allowed";
                const reason = movementForm.reason || "";
                if (!reason) errors.reason = "Reason is required";
                else if (!isValidName(reason)) errors.reason = "Reason contains invalid characters";
                if (hasUrl(reason)) errors.reason = "URLs are not allowed";
                if (movementForm.movementType === "receipt" && movementForm.expiryDate) {
                  const emsg = validateExpiryDate(movementForm.expiryDate);
                  if (emsg) errors.expiryDate = emsg;
                  else if (movementForm.receivedDate) {
                    const expiry = new Date(movementForm.expiryDate);
                    expiry.setHours(0, 0, 0, 0);
                    const received = new Date(movementForm.receivedDate);
                    received.setHours(0, 0, 0, 0);
                    if (expiry <= received) errors.expiryDate = "Expiry date must be after received date";
                  }
                }
                if (isExponential(movementForm.quantityBase)) errors.quantityBase = "Exponential notation is not allowed";
                if (isExponential(movementForm.newBalanceBase)) errors.newBalanceBase = "Exponential notation is not allowed";
                const costStr = String(movementForm.costPerBaseUnit || "");
                if (isExponential(costStr)) errors.costPerBaseUnit = "Exponential notation is not allowed";
                else { const costParts = costStr.split("."); if (costParts[0] && costParts[0].length > 7) errors.costPerBaseUnit = "Maximum 7 digits allowed"; else if (costParts[1] && costParts[1].length > 3) errors.costPerBaseUnit = "Maximum 3 decimal places allowed"; }
                setMovementFormErrors(errors);
                if (Object.keys(errors).length) return;
                let payload = { action: "movement", ...movementForm };
                const baseUomSym = selectedMovementItem?.baseUom?.symbol;
                const qtyUom = payload.quantityUnit || baseUomSym;
                if (baseUomSym && qtyUom && qtyUom !== baseUomSym) {
                  const uomInfo = COMMON_UOMS.find((u) => u.symbol === qtyUom);
                  if (uomInfo && uomInfo.conversionToBase !== 1) {
                    const field = payload.movementType === "adjustment" ? "newBalanceBase" : "quantityBase";
                    payload = { ...payload, [field]: Number(payload[field]) * (uomInfo.conversionToBase || 1) };
                  }
                }
                postInventory(payload, () => {
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

          {activeTab === "movements" && (
            <MovementLedger
              movements={movementData}
              pagination={movementPagination}
              filters={movementFilters}
              setFilters={setMovementFilters}
              onPageChange={(p) => { setMovementPage(p); loadMovements(p); }}
              onSearch={() => loadMovements(1)}
            />
          )}
        </>
      )}

      {deleteTypeTarget && (
        <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "grid", placeItems: "center", zIndex: 1000 }} onClick={() => setDeleteTypeTarget(null)}>
          <div className="form-card" style={{ padding: 24, borderRadius: 12, maxWidth: 380, width: "90%", display: "grid", gap: 12 }} onClick={(e) => e.stopPropagation()}>
            <h5 style={{ margin: 0, fontSize: 16 }}>Delete item type</h5>
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
              Are you sure you want to delete <strong>{deleteTypeTarget.name}</strong>?
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button type="button" className="btn-lims-secondary" onClick={() => setDeleteTypeTarget(null)} style={{ flex: 1, height: 38 }}>Cancel</button>
              <button type="button" className="btn-lims-primary" style={{ flex: 1, height: 38, background: "#dc2626", borderColor: "#dc2626" }} onClick={async () => {
                try { const r = await fetch(`/api/inventory/types/${deleteTypeTarget._id}`, { method: "DELETE" }); const d = await r.json(); if (!r.ok) throw new Error(d.error); setDeleteTypeTarget(null); await loadInventory(itemPage); if (itemForm.itemType === deleteTypeTarget.name) setItemForm((p) => ({ ...p, itemType: (itemTypes.find((x) => x._id !== deleteTypeTarget._id) || {}).name || "" })); } catch (e) { setError(e.message); setDeleteTypeTarget(null); }
              }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {deleteStorageConditionTarget && (
        <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "grid", placeItems: "center", zIndex: 1000 }} onClick={() => setDeleteStorageConditionTarget(null)}>
          <div className="form-card" style={{ padding: 24, borderRadius: 12, maxWidth: 380, width: "90%", display: "grid", gap: 12 }} onClick={(e) => e.stopPropagation()}>
            <h5 style={{ margin: 0, fontSize: 16 }}>Delete storage condition</h5>
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
              Are you sure you want to delete <strong>{deleteStorageConditionTarget.name}</strong>?
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button type="button" className="btn-lims-secondary" onClick={() => setDeleteStorageConditionTarget(null)} style={{ flex: 1, height: 38 }}>Cancel</button>
              <button type="button" className="btn-lims-primary" style={{ flex: 1, height: 38, background: "#dc2626", borderColor: "#dc2626" }} onClick={async () => {
                try { const r = await fetch(`/api/inventory/storage-conditions/${deleteStorageConditionTarget._id}`, { method: "DELETE" }); const d = await r.json(); if (!r.ok) throw new Error(d.error); setDeleteStorageConditionTarget(null); await loadInventory(itemPage); if (itemForm.storageCondition === deleteStorageConditionTarget.name) setItemForm((p) => ({ ...p, storageCondition: "" })); } catch (e) { setError(e.message); setDeleteStorageConditionTarget(null); }
              }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "grid", placeItems: "center", zIndex: 1000 }} onClick={() => setShowImportModal(false)}>
          <div className="form-card" style={{ padding: 24, borderRadius: 12, maxWidth: 520, width: "90%", maxHeight: "80vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h5 style={{ margin: 0, fontSize: 16 }}>CSV Import</h5>
              <button type="button" onClick={() => setShowImportModal(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--text-muted)" }}>{Icons.close}</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, display: "block" }}>Import Type</label>
                <div style={{ display: "flex", gap: 12 }}>
                  {[["items", "Items"], ["categories", "Categories"], ["uoms", "UOMs"]].map(([val, label]) => (
                    <label key={val} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, cursor: "pointer" }}>
                      <input type="radio" name="importType" value={val} checked={importType === val} onChange={(e) => setImportType(e.target.value)} />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, display: "block" }}>CSV File</label>
                <input type="file" accept=".csv" onChange={(e) => { setImportFile(e.target.files?.[0] || null); setImportResults(null); }} style={{ fontSize: 13 }} />
              </div>
              {importResults && (
                <div style={{ fontSize: 13, padding: 12, borderRadius: 8, background: importResults.imported > 0 ? "#f0fdf4" : "#fef2f2", border: `1px solid ${importResults.imported > 0 ? "#bbf7d0" : "#fecaca"}` }}>
                  {importResults.dryRun && <div style={{ fontWeight: 700, marginBottom: 6, color: "#1e40af" }}>Dry Run Results</div>}
                  {!importResults.dryRun && <div style={{ fontWeight: 700, marginBottom: 6 }}>Import Complete</div>}
                  <div>Total Rows: {importResults.totalRows} | Valid: {importResults.validCount ?? importResults.imported} | {importResults.dryRun ? "Errors" : "Skipped"}: {importResults.errors?.length || 0}</div>
                  {importResults.errors?.length > 0 && (
                    <div style={{ marginTop: 8, maxHeight: 150, overflow: "auto" }}>
                      <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                        <thead><tr style={{ borderBottom: "1px solid #e5e7eb" }}><th style={{ textAlign: "left", padding: "4px 8px" }}>Row</th><th style={{ textAlign: "left", padding: "4px 8px" }}>Issue</th></tr></thead>
                        <tbody>
                          {importResults.errors.map((err, i) => (
                            <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}><td style={{ padding: "4px 8px", fontWeight: 600 }}>{err.row}</td><td style={{ padding: "4px 8px", color: "#b91c1c" }}>{err.errors.join("; ")}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button type="button" className="btn-lims-secondary" onClick={async () => {
                  if (!importFile) return;
                  setImporting(true);
                  try {
                    const fd = new FormData();
                    fd.append("file", importFile);
                    fd.append("type", importType);
                    fd.append("dryRun", "true");
                    const r = await fetch("/api/inventory/import", { method: "POST", body: fd });
                    const d = await r.json();
                    if (!r.ok) throw new Error(d.error);
                    setImportResults(d);
                  } catch (err) { setImportResults({ errors: [{ row: 0, errors: [err.message] }], totalRows: 0, validCount: 0, dryRun: true }); } finally { setImporting(false); }
                }} disabled={!importFile || importing} style={{ flex: 1, height: 38 }}>{importing ? "Validating..." : "Validate First (Dry Run)"}</button>
                <button type="button" className="btn-lims-primary" onClick={async () => {
                  if (!importFile) return;
                  setImporting(true);
                  try {
                    const fd = new FormData();
                    fd.append("file", importFile);
                    fd.append("type", importType);
                    fd.append("dryRun", "false");
                    const r = await fetch("/api/inventory/import", { method: "POST", body: fd });
                    const d = await r.json();
                    if (!r.ok) throw new Error(d.error);
                    setImportResults(d);
                    setSuccessMessage(`Imported ${d.imported} rows (${d.skipped} skipped)`);
                    loadInventory(itemPage);
                  } catch (err) { setImportResults({ errors: [{ row: 0, errors: [err.message] }], totalRows: 0, imported: 0, skipped: 0 }); } finally { setImporting(false); }
                }} disabled={!importFile || importing} style={{ flex: 1, height: 38 }}>{importing ? "Importing..." : "Import Now"}</button>
              </div>
            </div>
          </div>
        </div>
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
            const availableStock = (item.stockOnHandBase || 0) - (item.reservedBase || 0);
            const low = availableStock <= item.minimumStockBase;
            const reorder = item.reorderLevelBase && availableStock <= item.reorderLevelBase;
            const expiryTone = item.expiredBatches ? "danger" : item.nearExpiryBatches ? "warn" : "good";
            return (
              <tr key={item._id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                <td style={{ padding: "12px 14px" }}>
                  <div style={{ fontWeight: 800, color: "var(--text-primary)" }}>{item.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{item.itemCode} {item.manufacturer ? `- ${item.manufacturer}` : ""} <span style={{ display: "inline-block", padding: "1px 6px", borderRadius: 4, background: "var(--surface)", border: "1px solid var(--border)", fontSize: 10, marginLeft: 6 }}>{item.itemType}</span></div>
                </td>
                <td style={{ padding: "12px 14px" }}>
                  <div>{item.category?.name || "-"}</div>
                  <small style={{ color: "var(--text-muted)" }}>{item.subCategory?.name || item.itemType}</small>
                </td>
                <td style={{ padding: "12px 14px", fontWeight: 800, color: low ? "#b91c1c" : "var(--text-primary)" }}>
                  {formatNumber(availableStock)} {item.baseUom?.symbol}
                  {(item.reservedBase || 0) > 0 && (
                    <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>
                      ({formatNumber(item.stockOnHandBase)} total, {formatNumber(item.reservedBase)} reserved)
                    </div>
                  )}
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

function MastersPanel({ title, fields, onSubmit, saving }) {
  return (
    <form className="form-card" onSubmit={onSubmit} style={{ padding: 20, borderRadius: 8 }}>
      <h5 style={{ margin: "0 0 16px", fontSize: 16 }}>{title}</h5>
      {fields}
      <button className="btn-lims-primary" disabled={saving} style={{ height: 38, marginTop: 16 }}>{saving ? "Saving..." : "Save Master"}</button>
    </form>
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

function StockPanel({ form, setForm, item, items, saving, onSubmit, errors = {}, setErrors, viewMode, onRelease, locations = [] }) {
  const isAdjustment = form.movementType === "adjustment";
  const isReceipt = form.movementType === "receipt";
  const baseUomSymbol = item?.baseUom?.symbol || "";
  const baseUomBaseSymbol = item?.baseUom?.baseSymbol || baseUomSymbol;
  const availableUoms = useMemo(() => {
    const fromCommon = COMMON_UOMS.filter((u) => u.baseSymbol === baseUomBaseSymbol);
    if (fromCommon.length === 0 && baseUomSymbol) fromCommon.push({ symbol: baseUomSymbol, name: baseUomSymbol, baseSymbol: baseUomSymbol, conversionToBase: 1 });
    return fromCommon;
  }, [baseUomBaseSymbol, baseUomSymbol]);

  if (viewMode === "list") {
    const uomSymbol = item?.baseUom?.symbol || "";
    return (
      <div className="form-card" style={{ padding: 20, borderRadius: 8 }}>
        <h5 style={{ margin: "0 0 12px", fontSize: 16 }}>Batch Balances</h5>
        <div style={{ marginBottom: 12 }}>
          <select className="lims-input" value={form.itemId} onChange={(e) => setForm({ ...form, itemId: e.target.value })} style={inputStyle()}>
            <option value="">Select item</option>
            {items.map((stockItem) => <option key={stockItem._id} value={stockItem._id}>{stockItem.itemCode} - {stockItem.name}</option>)}
          </select>
        </div>
        {!item ? <p style={{ color: "var(--text-muted)" }}>Select an item to view batches.</p> : (
          <MasterTable headings={["Batch", "Qty", "Expiry", "Location", "Status", "Action"]} rows={(item.batches || []).map((batch) => {
            const statusColors = { available: "good", consumed: "neutral", wasted: "danger", expired: "danger", quarantine: "warn" };
            return [
              batch.batchNo || "-",
              `${formatNumber(batch.quantityBase)} ${uomSymbol}`,
              formatDate(batch.expiryDate),
              batch.location || "-",
              <Badge key="status" tone={statusColors[batch.status] || "neutral"}>{batch.status}</Badge>,
              batch.status === "quarantine" && (batch.quantityBase || 0) > 0 ? (
                <button key="release" type="button" title="Release from Quarantine" onClick={() => onRelease?.(item._id, batch._id)} style={{ ...actionBtnStyle, border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#166534", fontSize: 11 }}>Release</button>
              ) : null,
            ];
          })} />
        )}
      </div>
    );
  }

  return (
    <form className="form-card" onSubmit={onSubmit} style={{ padding: 20, borderRadius: 8 }}>
      <h5 style={{ margin: "0 0 16px", fontSize: 16 }}>Stock Transaction</h5>
      <div className="row g-3">
        <div className="col-md-6">
          <Field label="Item">
            <select required className="lims-input" value={form.itemId} onChange={(e) => { const newItemId = e.target.value; const newItem = items.find((i) => i._id === newItemId); const newUom = newItem?.baseUom?.symbol || ""; setErrors?.({}); setForm({ ...form, itemId: newItemId, batchId: "", quantityUnit: newUom, quantityBase: 0, newBalanceBase: 0 }); }} style={inputStyle()}>
              <option value="">Select item</option>
              {items.map((stockItem) => <option key={stockItem._id} value={stockItem._id}>{stockItem.itemCode} - {stockItem.name}</option>)}
            </select>
            <ErrorMsg message={errors.itemId} />
          </Field>
        </div>
        <div className="col-md-6">
          <Field label="Transaction">
            <select className="lims-input" value={form.movementType} onChange={(e) => setForm({ ...form, movementType: e.target.value })} style={inputStyle()}>
              {["receipt", "issue", "adjustment", "transfer", "wastage", "expiry"].map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </Field>
        </div>
      </div>
      {!isReceipt && !isAdjustment && (
        <div className="row g-3">
          <div className="col-12">
            <Field label="Batch">
              {item && (item?.batches || []).filter((batch) => batch.quantityBase > 0).length === 0 ? (
                <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>No available batches with positive stock for this item.</p>
              ) : (
                <>
                  <select required className="lims-input" value={form.batchId} onChange={(e) => { setErrors?.((p) => ({ ...p, batchId: "" })); setForm({ ...form, batchId: e.target.value }); }} style={inputStyle()}>
                    <option value="">Auto select available batch</option>
                    {(item?.batches || []).filter((batch) => batch.quantityBase > 0).map((batch) => (
                      <option key={batch._id} value={batch._id}>{batch.batchNo || "Batch"} - {formatNumber(batch.quantityBase)} {item?.baseUom?.symbol}</option>
                    ))}
                  </select>
                  <ErrorMsg message={errors.batchId} />
                  {form.batchId && item && (() => {
                    const selBatch = item.batches.find((b) => b._id === form.batchId);
                    if (!selBatch) return null;
                    return (
                      <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 12, color: "var(--text-muted)" }}>
                        <span>Qty: {formatNumber(selBatch.quantityBase)} {item.baseUom?.symbol}</span>
                        {selBatch.expiryDate && <span>Expiry: {formatDate(selBatch.expiryDate)}</span>}
                        {selBatch.location && <span>Location: {selBatch.location}</span>}
                        <span>Status: {selBatch.status}</span>
                      </div>
                    );
                  })()}
                </>
              )}
            </Field>
          </div>
        </div>
      )}
      {isReceipt && (
        <div className="row g-3">
          <div className="col-md-4">
            <Field label="Batch No"><input className="lims-input" maxLength={15} value={form.batchNo} onChange={(e) => { const v = e.target.value.toUpperCase(); if (v && !/^[A-Za-z0-9]*$/.test(v)) { setErrors?.((p) => ({ ...p, batchNo: "Only letters and numbers allowed" })); return; } setErrors?.((p) => ({ ...p, batchNo: "" })); setForm({ ...form, batchNo: v }); }} style={inputStyle()} /></Field>
          </div>
          <div className="col-md-4">
            <Field label="Expiry"><input className="lims-input" type="date" value={form.expiryDate} onChange={(e) => { const v = e.target.value; const msg = validateExpiryDate(v); if (msg) { setErrors?.((p) => ({ ...p, expiryDate: msg })); return; } setErrors?.((p) => ({ ...p, expiryDate: "" })); setForm({ ...form, expiryDate: v }); }} style={inputStyle()} /><ErrorMsg message={errors.expiryDate} /></Field>
          </div>
          <div className="col-md-4">
            <Field label="Received Date"><input className="lims-input" type="date" value={form.receivedDate} onChange={(e) => setForm({ ...form, receivedDate: e.target.value })} style={inputStyle()} /></Field>
          </div>
        </div>
      )}
      <div className="row g-3">
        <div className="col-md-6">
          <Field label={isAdjustment ? "Current Batch Balance" : "Quantity"}>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input required className="lims-input" type="number" min="0" max="9999999999" step="0.001" value={isAdjustment ? form.newBalanceBase : form.quantityBase} onChange={(e) => { const v = e.target.value; if (isExponential(v)) { setErrors?.((p) => ({ ...p, [isAdjustment ? "newBalanceBase" : "quantityBase"]: "Exponential notation is not allowed" })); return; } setErrors?.((p) => ({ ...p, [isAdjustment ? "newBalanceBase" : "quantityBase"]: "" })); setForm({ ...form, [isAdjustment ? "newBalanceBase" : "quantityBase"]: v }); }} style={{ ...inputStyle(), flex: 1 }} />
              <select className="lims-input" value={form.quantityUnit || (item ? baseUomSymbol : "")} onChange={(e) => { const newUnit = e.target.value; const oldUnit = form.quantityUnit || baseUomSymbol; if (oldUnit && newUnit && oldUnit !== newUnit) { const oldUom = COMMON_UOMS.find((u) => u.symbol === oldUnit); const newUom = COMMON_UOMS.find((u) => u.symbol === newUnit); if (oldUom && newUom) { const currentVal = Number(isAdjustment ? form.newBalanceBase : form.quantityBase) || 0; const baseVal = currentVal * (oldUom.conversionToBase || 1); const newVal = baseVal / (newUom.conversionToBase || 1); setForm({ ...form, quantityUnit: newUnit, [isAdjustment ? "newBalanceBase" : "quantityBase"]: newVal }); return; } } setForm({ ...form, quantityUnit: newUnit }); }} style={{ width: 85, flexShrink: 0 }}>
                {availableUoms.map((u) => <option key={u.symbol} value={u.symbol}>{u.symbol}</option>)}
              </select>
            </div>
            <ErrorMsg message={isAdjustment ? errors.newBalanceBase : errors.quantityBase} />
          </Field>
        </div>
        <div className="col-md-6">
          <Field label={isReceipt || isAdjustment ? "Unit Cost" : "Cost / Base Unit"}>
            <input className="lims-input" type="number" min="0" max="9999999" step="0.001" value={form.costPerBaseUnit} onChange={(e) => { const v = e.target.value; if (isExponential(v)) { setErrors?.((p) => ({ ...p, costPerBaseUnit: "Exponential notation is not allowed" })); return; } const parts = v.split("."); if (parts[0] && parts[0].length > 7) { setErrors?.((p) => ({ ...p, costPerBaseUnit: "Maximum 7 digits allowed" })); return; } if (parts[1] && parts[1].length > 3) { setErrors?.((p) => ({ ...p, costPerBaseUnit: "Maximum 3 decimal places allowed" })); return; } setErrors?.((p) => ({ ...p, costPerBaseUnit: "" })); setForm({ ...form, costPerBaseUnit: v }); }} style={inputStyle()} />
            <ErrorMsg message={errors.costPerBaseUnit} />
          </Field>
        </div>
      </div>
      <div className="row g-3">
        <div className="col-md-6">
          <Field label={isReceipt ? "Supplier" : form.movementType === "issue" ? "Issued To" : form.movementType === "transfer" ? "To Location" : "Location"}>
            {locations.length > 0 && (isReceipt || form.movementType === "transfer" || form.movementType === "adjustment") ? (
              <select className="lims-input" value={isReceipt ? "" : form.toLocation} onChange={(e) => { const v = e.target.value; const key = isReceipt ? "supplier" : "toLocation"; setErrors?.((p) => ({ ...p, [key]: "" })); setForm({ ...form, [key]: v }); }} style={{ ...inputStyle(), width: "100%" }}>
                <option value="">-- Select --</option>
                {locations.filter((l) => l.status === "active").map((l) => <option key={l._id} value={l.name}>{l.code} — {l.name}</option>)}
              </select>
            ) : (
              <input className="lims-input" maxLength={isReceipt ? 35 : form.movementType === "issue" ? 25 : 100} value={isReceipt ? form.supplier : form.toLocation} onChange={(e) => { const v = e.target.value; const key = isReceipt ? "supplier" : "toLocation"; if (hasUrl(v)) { setErrors?.((p) => ({ ...p, [key]: "URLs are not allowed" })); return; } if (v) { if (form.movementType === "issue") { if (!/^[A-Za-z0-9 -]*$/.test(v)) { setErrors?.((p) => ({ ...p, [key]: "Only letters, numbers and - allowed" })); return; } } else if (!(isReceipt ? isValidName(v) : isValidLocation(v))) { setErrors?.((p) => ({ ...p, [key]: "Field contains invalid characters" })); return; } } setErrors?.((p) => ({ ...p, [key]: "" })); setForm({ ...form, [key]: v }); }} style={inputStyle()} />
            )}
            <ErrorMsg message={isReceipt ? errors.supplier : errors.toLocation} />
          </Field>
        </div>
        <div className="col-md-6">
          <Field label="Reference No">
            <input className="lims-input" maxLength={15} value={form.referenceNo} onChange={(e) => { const v = e.target.value.toUpperCase(); if (v && !/^[A-Z0-9]*$/.test(v)) { setErrors?.((p) => ({ ...p, referenceNo: "Only letters and numbers allowed" })); return; } setErrors?.((p) => ({ ...p, referenceNo: "" })); setForm({ ...form, referenceNo: v }); }} style={inputStyle()} />
            <ErrorMsg message={errors.referenceNo} />
          </Field>
        </div>
      </div>
      <div className="row g-3">
        <div className="col-md-6">
          <Field label="Reason">
            <input className="lims-input" maxLength={150} value={form.reason} onChange={(e) => { const v = e.target.value; if (hasUrl(v)) { setErrors?.((p) => ({ ...p, reason: "URLs are not allowed" })); return; } if (v && !isValidName(v)) { setErrors?.((p) => ({ ...p, reason: "Reason contains invalid characters" })); return; } setErrors?.((p) => ({ ...p, reason: "" })); setForm({ ...form, reason: v }); }} style={inputStyle()} />
            <ErrorMsg message={errors.reason} />
          </Field>
        </div>
        <div className="col-md-6">
          <Field label="Movement Date">
            <input className="lims-input" type="date" value={form.movementDate} onChange={(e) => setForm({ ...form, movementDate: e.target.value })} style={inputStyle()} />
          </Field>
        </div>
      </div>
      {form.movementType === "transfer" && (
        <div className="row g-3" style={{ marginTop: 8 }}>
          <div className="col-md-6">
            <Field label="From Location">
              {locations.length > 0 ? (
                <select className="lims-input" value={form.fromLocation || ""} onChange={(e) => setForm({ ...form, fromLocation: e.target.value })} style={{ ...inputStyle(), width: "100%" }}>
                  <option value="">-- Select --</option>
                  {locations.filter((l) => l.status === "active").map((l) => <option key={l._id} value={l.name}>{l.code} — {l.name}</option>)}
                </select>
              ) : (
                <input className="lims-input" maxLength={100} value={form.fromLocation || ""} onChange={(e) => setForm({ ...form, fromLocation: e.target.value })} style={inputStyle()} />
              )}
            </Field>
          </div>
        </div>
      )}
      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button className="btn-lims-primary" disabled={saving} style={{ height: 38, flex: 1 }}>{saving ? "Posting..." : "Post Transaction"}</button>
        <button type="button" className="btn-lims-secondary" onClick={() => setForm({ ...emptyMovement })} style={{ height: 38 }}>Reset</button>
      </div>
    </form>
  );
}

function ExpiryPanel({ items, onWaste }) {
  const batches = items.flatMap((item) => (item.batches || []).map((batch) => ({ item, batch }))).filter(({ batch }) => batch.quantityBase > 0);
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
            const isQuarantine = batch.status === "quarantine";
            let riskLabel = "Valid";
            let riskTone = "good";
            if (isQuarantine) { riskLabel = "Quarantine"; riskTone = "warn"; }
            else if (expired) { riskLabel = "Expired"; riskTone = "danger"; }
            else if (near) { riskLabel = "Near expiry"; riskTone = "warn"; }
            return (
              <tr key={`${item._id}-${batch._id}`} style={{ borderTop: "1px solid var(--border-light)" }}>
                <td style={{ padding: 12 }}><strong>{item.name}</strong><br /><small>{item.itemCode}</small></td>
                <td style={{ padding: 12 }}>{batch.batchNo || "-"}</td>
                <td style={{ padding: 12 }}>{formatNumber(batch.quantityBase)} {item.baseUom?.symbol}</td>
                <td style={{ padding: 12 }}>{batch.expiryDate ? formatDate(batch.expiryDate) : "—"}</td>
                <td style={{ padding: 12 }}><Badge tone={riskTone}>{riskLabel}</Badge></td>
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

function MovementLedger({ movements, pagination, filters, setFilters, onPageChange, onSearch }) {
  const movementTypeColors = {
    opening: "info", receipt: "good", issue: "warn",
    adjustment: "info", transfer: "neutral", wastage: "danger", expiry: "danger",
  };
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="form-card" style={{ padding: 16, borderRadius: 8 }}>
        <div className="row g-3" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
          <div style={{ flex: "1 1 160px", minWidth: 130 }}>
            <select className="lims-input" value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })} style={inputStyle()}>
              <option value="">All Types</option>
              {["opening", "receipt", "issue", "adjustment", "transfer", "wastage", "expiry"].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div style={{ flex: "1 1 140px", minWidth: 120 }}>
            <input className="lims-input" type="date" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} style={inputStyle()} placeholder="From" />
          </div>
          <div style={{ flex: "1 1 140px", minWidth: 120 }}>
            <input className="lims-input" type="date" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} style={inputStyle()} placeholder="To" />
          </div>
          <div style={{ flex: "2 1 200px", minWidth: 160 }}>
            <input className="lims-input" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} placeholder="Search ref, reason, location…" style={inputStyle()} />
          </div>
          <button className="btn-lims-primary" onClick={onSearch} style={{ height: 38, padding: "0 14px" }}>{Icons.search} Search</button>
        </div>
      </div>
      <MasterTable
        headings={["Date", "Item", "Type", "Qty", "Balance", "Reference", "Reason"]}
        rows={movements.map((movement) => [
          formatDate(movement.movementDate),
          movement.item ? `${movement.item.itemCode} - ${movement.item.name}` : "-",
          <Badge key="type" tone={movementTypeColors[movement.movementType] || "neutral"}>{movement.movementType}</Badge>,
          <span key="qty" style={{ fontWeight: 700, color: movement.quantityBase < 0 ? "#b91c1c" : "#047857" }}>{formatNumber(movement.quantityBase)}</span>,
          formatNumber(movement.balanceAfterBase),
          movement.referenceNo || "-",
          movement.reason || "-",
        ])}
      />
      <PaginationControls pagination={pagination} loading={false} onPageChange={onPageChange} />
    </div>
  );
}

function PaginationControls({ pagination, loading, onPageChange }) {
  if (!pagination || pagination.totalPages <= 1) return null;

  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <span style={{ color: "var(--text-muted)", fontSize: 13, fontWeight: 700 }}>
        Page {pagination.page} of {pagination.totalPages}
      </span>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="btn-lims-secondary" disabled={loading || pagination.page <= 1} onClick={() => onPageChange(Math.max(1, pagination.page - 1))} style={{ height: 34, padding: "0 12px" }}>Previous</button>
        <button type="button" className="btn-lims-secondary" disabled={loading || pagination.page >= pagination.totalPages} onClick={() => onPageChange(Math.min(pagination.totalPages, pagination.page + 1))} style={{ height: 34, padding: "0 12px" }}>Next</button>
      </div>
    </div>
  );
}
