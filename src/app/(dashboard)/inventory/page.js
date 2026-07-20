"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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
  purchaseToBaseFactor: "",
  openingQuantityBase: "",
  conversionFactorUnit: "mg",
  minimumStockBase: "",
  reorderLevelBase: "",
  maximumStockBase: "",
  preferredSupplier: "",
  preferredSupplierRef: "",
  manufacturer: "",
  storageCondition: "",
  defaultLocation: "",
  batchNo: "",
  expiryDate: "",
  costPerBaseUnit: "",
  trackExpiry: true,
  quarantineOnReceipt: false,
  status: "active",
  notes: "",
};

const emptyMovement = {
  itemId: "",
  batchId: "",
  movementType: "purchase",
  quantityBase: "",
  newBalanceBase: "",
  batchNo: "",
  supplier: "",
  expiryDate: "",
  receivedDate: "",
  movementDate: new Date().toISOString().split("T")[0],
  costPerBaseUnit: "",
  referenceNo: "",
  reason: "",
  toLocation: "",
  quantityUnit: "",
  poNumber: "",
  orderDate: "",
  expectedDeliveryDate: "",
  purchaseItems: [{ item: "", quantity: "", unitCost: "", notes: "" }],
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
    <div className="form-card" style={{ padding: 18, borderRadius: 8, minHeight: 104, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
          <div style={{ marginTop: 6, fontSize: 22, fontWeight: 800, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
        </div>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
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

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
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

function isLettersAndBasic(value) {
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
  return message ? <small style={{ color: "#dc2626", fontSize: 10, display: "block", marginTop: 2 }}>{message}</small> : null;
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
  const [uomForm, setUomForm] = useState({ name: "", symbol: "", type: "count", conversionToBase: "", baseSymbol: "" });
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
  const movementFiltersRef = useRef(movementFilters);
  function applyMovementFilters(patch) {
    const next = typeof patch === "function" ? patch(movementFiltersRef.current) : patch;
    movementFiltersRef.current = next;
    setMovementFilters(next);
  }
  const [movementData, setMovementData] = useState([]);
  const [movementPagination, setMovementPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });
  const [suppliers, setSuppliers] = useState([]);
  const [supplierForm, setSupplierForm] = useState({ name: "", code: "", manufacturer: "", items: [], contactPerson: "", email: "", phone: "", address: "", notes: "" });
  const [supplierFormErrors, setSupplierFormErrors] = useState({});
  const [editingSupplierId, setEditingSupplierId] = useState(null);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [showImportModal, setShowImportModal] = useState(false);
  const [importType, setImportType] = useState("items");
  const [importFile, setImportFile] = useState(null);
  const [importResults, setImportResults] = useState(null);
  const [importing, setImporting] = useState(false);
  const [locations, setLocations] = useState([]);
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
  const [showExpiredBanner, setShowExpiredBanner] = useState(false);
  const [dashboardFilter, setDashboardFilter] = useState("all");

  const actionBtnStyle = { width: 30, height: 30, borderRadius: 6, cursor: "pointer", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", border: "none" };

  const parentCategories = inventory.categories.filter((category) => !category.parentCategory);
  const subCategories = inventory.categories.filter((category) => category.parentCategory);
  const selectedMovementItem = inventory.items.find((item) => item._id === movementForm.itemId);

  const filteredItems = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    let items = inventory.items;
    if (needle) {
      items = items.filter((item) =>
        [item.name, item.itemCode, item.genericName, item.manufacturer, item.category?.name, item.subCategory?.name]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle))
      );
    }
    if (dashboardFilter === "low") {
      items = items.filter((item) => (item.stockOnHandBase || 0) <= item.minimumStockBase);
    } else if (dashboardFilter === "reorder") {
      items = items.filter((item) => item.reorderLevelBase && (item.stockOnHandBase || 0) <= item.reorderLevelBase);
    }
    return items;
  }, [inventory.items, searchQuery, dashboardFilter]);

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
      const hasUnprocessedExpired = (data.items || []).some((item) =>
        (item.batches || []).some((batch) => batch.expiryDate && new Date(batch.expiryDate) < new Date() && batch.status === "available" && batch.quantityBase > 0)
      );
      setShowExpiredBanner(hasUnprocessedExpired);
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
    if (activeTab === "movements" || activeTab === "stock") loadMovements(1);
  }, [activeTab]);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(""), 10000);
    return () => clearTimeout(timer);
  }, [error]);

  useEffect(() => {
    if (activeTab === "suppliers" || activeTab === "items" || activeTab === "stock") {
      (async () => {
        try {
          const r = await fetch("/api/inventory/suppliers");
          const d = await r.json();
          if (r.ok) setSuppliers(d.suppliers || []);
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

  async function postInventory(payload, success, onFieldErrors) {
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
      if (!response.ok) {
        if (data.fieldErrors && Object.keys(data.fieldErrors).length > 0 && onFieldErrors) {
          onFieldErrors(data.fieldErrors);
        }
        throw new Error(data.error || "Unable to save inventory");
      }
      success?.(data);
      setItemPage(1);
      await loadInventory(1);
      await loadMovements(1);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function loadMovements(pageNum) {
    const p = pageNum || movementPage;
    const filters = movementFiltersRef.current;
    const params = new URLSearchParams({ page: p, limit: 50 });
    if (filters.type) params.set("type", filters.type);
    if (filters.search) params.set("search", filters.search);
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.set("dateTo", filters.dateTo);
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
    else if (itemForm.name.length > 60) errors.name = "Name must not exceed 60 characters";
    else if (!/^[A-Za-z0-9 -]*$/.test(itemForm.name)) errors.name = "Name must contain only letters, numbers, spaces, and hyphens";
    if (!itemForm.genericName) errors.genericName = "Generic name is required";
    else if (!/^[A-Za-z0-9]*$/.test(itemForm.genericName)) errors.genericName = "Generic name must contain only letters and numbers";
    else if (itemForm.genericName.length > 60) errors.genericName = "Generic name must not exceed 60 characters";
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
        errors.reorderLevelBase = "Reorder level must be equal to or greater than Min stock";
      }
    }
    if (itemForm.reorderLevelBase !== "" && itemForm.reorderLevelBase !== undefined && itemForm.reorderLevelBase !== null &&
        itemForm.maximumStockBase !== "" && itemForm.maximumStockBase !== undefined && itemForm.maximumStockBase !== null) {
      if (Number(itemForm.reorderLevelBase) > Number(itemForm.maximumStockBase)) {
        errors.maximumStockBase = "Max stock must be equal to or greater than Reorder level";
      }
    }
    if (itemForm.minimumStockBase !== "" && itemForm.minimumStockBase !== undefined && itemForm.minimumStockBase !== null &&
        itemForm.maximumStockBase !== "" && itemForm.maximumStockBase !== undefined && itemForm.maximumStockBase !== null) {
      if (Number(itemForm.minimumStockBase) > Number(itemForm.maximumStockBase)) {
        errors.maximumStockBase = "Max stock must be equal to or greater than Min stock";
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
      }, (fe) => setItemFormErrors((prev) => ({ ...prev, ...fe })));
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
      if (!response.ok) {
        if (data.fieldErrors && Object.keys(data.fieldErrors).length > 0) setItemFormErrors((prev) => ({ ...prev, ...data.fieldErrors }));
        throw new Error(data.error || "Unable to update item");
      }
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
      purchaseToBaseFactor: item.purchaseToBaseFactor ?? "",
      conversionFactorUnit: item.conversionFactorUnit || "mg",
      minimumStockBase: item.minimumStockBase ?? "",
      reorderLevelBase: item.reorderLevelBase ?? "",
      maximumStockBase: item.maximumStockBase ?? "",
      preferredSupplier: item.preferredSupplierRef?.name || item.preferredSupplier || "",
      preferredSupplierRef: item.preferredSupplierRef?._id || "",
      manufacturer: item.manufacturer || "",
      storageCondition: item.storageCondition || "",
      defaultLocation: item.defaultLocation || "",
      trackExpiry: item.trackExpiry !== false,
      status: item.status || "active",
      notes: item.notes || "",
    });
    setViewMode("form");
    setActiveTab("items");
  }

  const tabs = [
    ["dashboard", "Dashboard", Icons.barChart],
    ["uom", "UOM", Icons.settings],
    ["categories", "Category", Icons.grid],
    ["items", "Item Master", Icons.flask],
    ["suppliers", "Suppliers", Icons.user],
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

      {activeTab !== "dashboard" && activeTab !== "expiry" && (
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
      )}

      {error && (
        <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 8, background: "#fef2f2", color: "#b91c1c", fontSize: 13, fontWeight: 700 }}>
          {error}
        </div>
      )}
      <SuccessDialog message={successMessage} onClose={() => setSuccessMessage("")} />

      {showExpiredBanner && (
        <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 8, background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>⚠️</span>
          Some batches have expired and will be processed automatically.
        </div>
      )}

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
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>Filter:</span>
                {[
                  { key: "all", label: "All", tone: "info" },
                  { key: "low", label: "Low Stock", tone: "warn" },
                  { key: "reorder", label: "Reorder Due", tone: "danger" },
                ].map((chip) => (
                  <button key={chip.key} type="button" onClick={() => setDashboardFilter(chip.key)} style={{
                    padding: "6px 14px", borderRadius: 20, border: "none", cursor: "pointer",
                    fontSize: 13, fontWeight: 700, transition: "all 0.15s",
                    background: dashboardFilter === chip.key
                      ? ({ info: "#eff6ff", warn: "#fffbeb", danger: "#fef2f2" })[chip.tone]
                      : "var(--surface)",
                    color: dashboardFilter === chip.key
                      ? ({ info: "#1d4ed8", warn: "#b45309", danger: "#b91c1c" })[chip.tone]
                      : "var(--text-muted)",
                    boxShadow: dashboardFilter === chip.key ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                  }}>{chip.label}</button>
                ))}
              </div>
              <InventoryTable items={filteredItems} onEdit={editItem} onOrder={(item) => {
                setMovementForm({ ...emptyMovement, movementType: "purchase", purchaseItems: [{ item: item._id, quantity: "", unitCost: "", notes: "" }] });
                setMovementFormErrors({});
                setActiveTab("stock");
              }} />
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
                    <input className="lims-input" required minLength={2} maxLength={60} value={itemForm.name} onChange={(e) => { const v = e.target.value; if (v.length > 60) return; if (v && !/^[A-Za-z0-9 -]*$/.test(v)) return; setItemFormErrors((p) => ({ ...p, name: "" })); setItemForm({ ...itemForm, name: v }); }} style={inputStyle()} />
                    <ErrorMsg message={itemFormErrors.name} />
                  </Field>
                </div>
                <div className="col-md-6">
                  <Field label="Generic / Alternate Name">
                    <input className="lims-input" required maxLength={60} value={itemForm.genericName} onChange={(e) => { const v = e.target.value; if (v && !/^[A-Za-z0-9]*$/.test(v)) { setItemFormErrors((p) => ({ ...p, genericName: "Only letters and numbers allowed" })); return; } setItemFormErrors((p) => ({ ...p, genericName: "" })); setItemForm({ ...itemForm, genericName: v }); }} style={inputStyle()} />
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
                    <select className="lims-input" value={itemForm.manufacturer} onChange={(e) => { setItemFormErrors((p) => ({ ...p, manufacturer: "" })); setItemForm({ ...itemForm, manufacturer: e.target.value, preferredSupplierRef: "", preferredSupplier: "" }); }} style={{ ...inputStyle(), width: "100%" }}>
                      <option value="">-- Select --</option>
                      {suppliers.filter((s) => s.manufacturer).reduce((acc, s) => { if (!acc.includes(s.manufacturer)) acc.push(s.manufacturer); return acc; }, []).map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <ErrorMsg message={itemFormErrors.manufacturer} />
                  </Field>
                </div>
                <div className="col-md-6">
                  <Field label="Supplier">
                    <select className="lims-input" value={itemForm.preferredSupplierRef} onChange={(e) => { setItemFormErrors((p) => ({ ...p, preferredSupplierRef: "" })); const id = e.target.value; const s = suppliers.find((x) => x._id === id); setItemForm({ ...itemForm, preferredSupplierRef: id, preferredSupplier: s?.name || "" }); }} style={{ ...inputStyle(), width: "100%" }}>
                      <option value="">-- Select --</option>
                      {suppliers.filter((s) => s.status === "active" && (!itemForm.manufacturer || s.manufacturer === itemForm.manufacturer)).map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
                    </select>
                    <ErrorMsg message={itemFormErrors.preferredSupplierRef} />
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
                else if (categoryForm.name.length > 25) errors.name = "Name must not exceed 25 characters";
                else if ((categoryForm.name.match(/-/g) || []).length > 1) errors.name = "Name can contain at most one hyphen";
                else if (!/^[A-Z][A-Za-z0-9 -]*$/.test(categoryForm.name)) errors.name = "Must start with a capital letter and contain only letters, numbers, spaces, and one hyphen";
                if (!categoryForm.code) errors.code = "Category code is required";
                else if (categoryForm.code.length > 20) errors.code = "Code must not exceed 20 characters";
                else if (!/^[A-Z0-9]+$/.test(categoryForm.code)) errors.code = "Code must contain only uppercase letters and numbers";
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
                      <input required className="lims-input" maxLength={25} value={categoryForm.name} onChange={(e) => { let v = e.target.value; if (v.length > 25) return; if ((v.match(/-/g) || []).length > 1) return; if (v) { v = v.charAt(0).toUpperCase() + v.slice(1); if (!/^[A-Z][A-Za-z0-9 -]*$/.test(v)) return; } setCategoryFormErrors((p) => ({ ...p, name: "" })); setCategoryForm({ ...categoryForm, name: v }); }} style={inputStyle()} />
                      <ErrorMsg message={categoryFormErrors.name} />
                    </Field>
                  </div>
                  <div className="col-md-6">
                    <Field label="Code">
                      <input required className="lims-input" maxLength={20} value={categoryForm.code} onChange={(e) => { const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""); if (v.length > 20) return; setCategoryFormErrors((p) => ({ ...p, code: "" })); setCategoryForm({ ...categoryForm, code: v }); }} style={inputStyle()} />
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
                          setUomForm({ name: uom.name, symbol: uom.symbol, type: uom.type, conversionToBase: uom.conversionToBase, baseSymbol: uom.symbol });
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
                setUomFormErrors(errors);
                if (Object.keys(errors).length) return;

                const url = editingUomId ? `/api/inventory/uoms/${editingUomId}` : "/api/inventory";
                const method = editingUomId ? "PATCH" : "POST";
                const baseSymbolVal = uomForm.symbol;
                const body = editingUomId
                  ? { name: uomForm.name, symbol: uomForm.symbol, type: uomForm.type, conversionToBase: uomForm.conversionToBase, baseSymbol: baseSymbolVal }
                  : { action: "uom", ...uomForm, baseSymbol: baseSymbolVal };

                (async () => {
                  try {
                    const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
                    const d = await r.json();
                    if (!r.ok) throw new Error(d.error);
                    setUomForm({ name: "", symbol: "", type: "count", conversionToBase: "", baseSymbol: "" });
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
                        setUomForm({ ...uomForm, type: newType, symbol: currentMatch ? uomForm.symbol : "", name: "", baseSymbol: currentMatch ? uomForm.symbol : "", conversionToBase: "" });
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
                          setUomForm({ ...uomForm, symbol: found.symbol, name: found.name, baseSymbol: found.symbol, conversionToBase: found.conversionToBase });
                        } else {
                          setUomForm({ ...uomForm, symbol: sel, baseSymbol: sel });
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
              formContent={<>
                <div className="row g-3">
                  <div className="col-md-6">
                    <Field label="Supplier Name">
                      <input required className="lims-input" maxLength={30} value={supplierForm.name} onChange={(e) => { const v = e.target.value; if (v && !/^[A-Za-z ]*$/.test(v)) return; const formatted = v ? v.charAt(0).toUpperCase() + v.slice(1) : v; setSupplierFormErrors((p) => ({ ...p, name: "" })); setSupplierForm({ ...supplierForm, name: formatted }); }} style={inputStyle()} />
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
                    <Field label="Manufacturer">
                      <input className="lims-input" maxLength={120} value={supplierForm.manufacturer} onChange={(e) => { const v = e.target.value; if (v && !isLettersAndBasic(v)) return; setSupplierForm({ ...supplierForm, manufacturer: v }); }} style={inputStyle()} />
                    </Field>
                  </div>
                  <div className="col-md-6">
                    <Field label="Item Name *">
                      <select required className="lims-input" value={supplierForm.items[0] || ""} onChange={(e) => { setSupplierFormErrors((p) => ({ ...p, items: "" })); setSupplierForm({ ...supplierForm, items: e.target.value ? [e.target.value] : [] }); }} style={{ ...inputStyle(), width: "100%" }}>
                        <option value="">-- Select --</option>
                        {inventory.items.map((item) => <option key={item._id} value={item._id}>{item.itemCode} — {item.name}</option>)}
                      </select>
                      <ErrorMsg message={supplierFormErrors.items} />
                    </Field>
                  </div>
                  <div className="col-md-6">
                    <Field label="Contact Person *">
                      <input required className="lims-input" maxLength={30} value={supplierForm.contactPerson} onChange={(e) => { const v = e.target.value; if (v && !/^[A-Za-z ]*$/.test(v)) return; const formatted = v ? v.charAt(0).toUpperCase() + v.slice(1) : v; setSupplierFormErrors((p) => ({ ...p, contactPerson: "" })); setSupplierForm({ ...supplierForm, contactPerson: formatted }); }} style={inputStyle()} />
                      <ErrorMsg message={supplierFormErrors.contactPerson} />
                    </Field>
                  </div>
                  <div className="col-md-6">
                    <Field label="Email">
                      <input className="lims-input" type="email" maxLength={100} value={supplierForm.email} onChange={(e) => { if (/\s/.test(e.target.value)) return; setSupplierFormErrors((p) => ({ ...p, email: "" })); setSupplierForm({ ...supplierForm, email: e.target.value }); }} style={inputStyle()} />
                      <ErrorMsg message={supplierFormErrors.email} />
                    </Field>
                  </div>
                  <div className="col-md-6">
                    <Field label="Phone *">
                      <input required className="lims-input" maxLength={10} value={supplierForm.phone} onChange={(e) => { const v = e.target.value; if (v && !/^\d*$/.test(v)) return; setSupplierFormErrors((p) => ({ ...p, phone: "" })); setSupplierForm({ ...supplierForm, phone: v }); }} style={inputStyle()} />
                      <ErrorMsg message={supplierFormErrors.phone} />
                    </Field>
                  </div>
                  <div className="col-12">
                    <Field label="Address">
                      <input className="lims-input" maxLength={100} value={supplierForm.address} onChange={(e) => { const v = e.target.value; if (v && !/^[A-Za-z0-9 .,/@-]*$/.test(v)) return; setSupplierForm({ ...supplierForm, address: v }); }} style={inputStyle()} />
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
                    headings={["Code", "Name", "Manufacturer", "Items", "Contact", "Phone", "Email", "Action"]}
                    rows={
                      suppliers
                        .filter((s) => {
                          const q = supplierSearch.toLowerCase();
                          return !q || s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q) || (s.contactPerson || "").toLowerCase().includes(q) || (s.manufacturer || "").toLowerCase().includes(q) || (s.phone || "").toLowerCase().includes(q) || (s.email || "").toLowerCase().includes(q);
                        })
                        .map((s) => [
                          s.code,
                          s.name,
                          s.manufacturer || "—",
                          (s.items || []).map((it) => it.name || it).join(", ") || "—",
                          s.contactPerson || "—",
                          s.phone || "—",
                          s.email || "—",
                          <div key={s._id} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <button type="button" title="Edit" onClick={() => {
                              setEditingSupplierId(s._id);
                              setSupplierForm({ name: s.name, code: s.code, manufacturer: s.manufacturer || "", items: (s.items || []).map((it) => it._id || it), contactPerson: s.contactPerson || "", email: s.email || "", phone: s.phone || "", address: s.address || "", notes: s.notes || "" });
                              setViewMode("form");
                            }} style={{ ...actionBtnStyle, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1e40af" }}>{Icons.edit}</button>
                            <button type="button" title="Deactivate" onClick={async () => {
                              if (!confirm(`Deactivate supplier "${s.name}"?`)) return;
                              try {
                                const r = await fetch(`/api/inventory/suppliers/${s._id}`, { method: "DELETE" });
                                const d = await r.json();
                                if (!r.ok) throw new Error(d.error);
                                setSuppliers((prev) => prev.filter((x) => x._id !== s._id));
                                setSuccessMessage(`Supplier "${s.name}" deactivated`);
                              } catch (err) { setError(err.message); }
                            }} style={{ ...actionBtnStyle, border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b" }}>{Icons.trash}</button>
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
                else if (name.length > 30) errors.name = "Must not exceed 30 characters";
                else if (!/^[A-Za-z ]+$/.test(name)) errors.name = "Only letters and spaces allowed";
                else if (!/^[A-Z]/.test(name)) errors.name = "First letter must be capital";
                if (!code) errors.code = "Code is required";
                else if (code.length > 20) errors.code = "Must not exceed 20 characters";
                else if (!/^[A-Z0-9-]+$/.test(code)) errors.code = "Only uppercase letters, numbers, and hyphens allowed";
                const cp = (supplierForm.contactPerson || "").trim();
                if (!cp) errors.contactPerson = "Contact person is required";
                else if (cp.length > 30) errors.contactPerson = "Must not exceed 30 characters";
                else if (!/^[A-Za-z ]+$/.test(cp)) errors.contactPerson = "Only letters and spaces allowed";
                else if (!/^[A-Z]/.test(cp)) errors.contactPerson = "First letter must be capital";
                const email = (supplierForm.email || "").trim();
                if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Invalid email format";
                const phone = (supplierForm.phone || "").trim();
                if (!phone) errors.phone = "Phone number is required";
                else if (!/^\d+$/.test(phone)) errors.phone = "Only numbers allowed";
                else if (phone.length !== 10) errors.phone = "Must be exactly 10 digits";
                if (!supplierForm.items || supplierForm.items.length === 0) errors.items = "Item name is required";
                if (Object.keys(errors).length) { setSupplierFormErrors(errors); return; }
                const payload = { name, code, contactPerson: cp || undefined, email: email || undefined, phone: phone || undefined, address: (supplierForm.address || "").trim() || undefined, notes: (supplierForm.notes || "").trim() || undefined, manufacturer: (supplierForm.manufacturer || "").trim() || undefined, items: supplierForm.items || [] };
                setSaving(true);
                try {
                  const url = editingSupplierId ? `/api/inventory/suppliers/${editingSupplierId}` : "/api/inventory/suppliers";
                  const r = await fetch(url, { method: editingSupplierId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
                  const d = await r.json();
                  if (!r.ok) throw new Error(d.error);
                  setSuppliers((prev) => editingSupplierId ? prev.map((s) => s._id === editingSupplierId ? d.supplier : s) : [...prev, d.supplier]);
                  setSuccessMessage(editingSupplierId ? `Supplier "${d.supplier.name}" updated` : `Supplier "${d.supplier.name}" created`);
                  setEditingSupplierId(null);
                  setSupplierForm({ name: "", code: "", manufacturer: "", items: [], contactPerson: "", email: "", phone: "", address: "", notes: "" });
                  setSupplierFormErrors({});
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
              movements={movementData}
              movementPagination={movementPagination}
              onMovementPageChange={(p) => { setMovementPage(p); loadMovements(p); }}
              filters={movementFilters}
              setFilters={applyMovementFilters}
              onFilterSearch={() => loadMovements(1)}
              locations={locations}
              setLocations={setLocations}
              suppliers={suppliers}
              inventory={inventory}
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
                const isPO = movementForm.movementType === "purchase";
                if (isPO) {
                  if (!movementForm.poNumber) errors.poNumber = "PO Number is required";
                  else if (!/^[A-Z0-9-]+$/.test(movementForm.poNumber)) errors.poNumber = "Only uppercase letters, numbers and - allowed";
                  if (!movementForm.supplier) errors.supplier = "Supplier is required";
                  if (!movementForm.orderDate) errors.orderDate = "Order date is required";
                  else {
                    const orderDate = new Date(movementForm.orderDate);
                    const today = new Date(); today.setHours(0, 0, 0, 0);
                    if (isNaN(orderDate.getTime())) errors.orderDate = "Invalid order date";
                    else if (orderDate > today) errors.orderDate = "Order date cannot be in the future";
                  }
                  if (!movementForm.expectedDeliveryDate) errors.expectedDeliveryDate = "Expected delivery date is required";
                  else {
                    const expDate = new Date(movementForm.expectedDeliveryDate);
                    if (isNaN(expDate.getTime())) errors.expectedDeliveryDate = "Invalid delivery date";
                    else if (movementForm.orderDate) {
                      const orderDate = new Date(movementForm.orderDate);
                      if (!isNaN(orderDate.getTime()) && expDate <= orderDate) errors.expectedDeliveryDate = "Delivery date must be after order date";
                    }
                  }
                  const validItems = (movementForm.purchaseItems || []).filter((pi) => pi.item && pi.quantity > 0);
                  if (validItems.length === 0) errors.purchaseItems = "At least one line item with item and quantity > 0 is required";
                } else {
                  if (!movementForm.itemId) errors.itemId = "Item is required";
                  if (movementForm.movementType === "adjustment") {
                    const selItem = inventory.items.find((i) => i._id === movementForm.itemId);
                    if (selItem && (selItem.batches || []).filter((b) => b.quantityBase > 0).length > 0 && !movementForm.batchId) {
                      errors.batchId = "Batch is required for adjustment";
                    }
                  } else if (movementForm.movementType !== "receipt" && !movementForm.batchId) {
                    errors.batchId = "Batch is required";
                  }
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
                    } else if (movementForm.movementType === "adjustment") {
                      if (toLocVal.length > 75) errors.toLocation = "Location must not exceed 75 characters";
                      else if (!/^[A-Za-z0-9 .,\/-]*$/.test(toLocVal)) errors.toLocation = "Only letters, numbers, spaces, and . , / - allowed";
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
                  if (movementForm.quantityBase !== "" && movementForm.quantityBase !== undefined && movementForm.quantityBase !== null) {
                    const qtyNum = Number(movementForm.quantityBase);
                    if (!Number.isInteger(qtyNum)) errors.quantityBase = "Only whole numbers are allowed";
                    else if (qtyNum < 0) errors.quantityBase = "Quantity cannot be negative";
                    else if (String(qtyNum).length > 7) errors.quantityBase = "Maximum 7 digits allowed";
                    else if (selectedMovementItem && movementForm.batchId && movementForm.movementType !== "receipt" && movementForm.movementType !== "adjustment") {
                      const selBatch = selectedMovementItem.batches?.find((b) => b._id === movementForm.batchId);
                      if (selBatch) {
                        const selUnit = movementForm.quantityUnit || selectedMovementItem.baseUom?.symbol || "";
                        const uom = COMMON_UOMS.find((u) => u.symbol === selUnit);
                        const conv = uom?.conversionToBase || 1;
                        const available = selBatch.quantityBase / conv;
                        if (qtyNum > available) errors.quantityBase = `Cannot exceed available quantity (${formatNumber(available)} ${selUnit})`;
                      }
                    }
                  }
                  if (isExponential(movementForm.newBalanceBase)) errors.newBalanceBase = "Exponential notation is not allowed";
                  else if (movementForm.movementType === "adjustment") {
                    const nbStr = String(movementForm.newBalanceBase || "");
                    if (nbStr.includes(".")) errors.newBalanceBase = "Only whole numbers are allowed";
                    else if (nbStr && nbStr.length > 7) errors.newBalanceBase = "Maximum 7 digits allowed";
                  }
                  const costStr = String(movementForm.costPerBaseUnit || "");
                  if (isExponential(costStr)) errors.costPerBaseUnit = "Exponential notation is not allowed";
                  else { const costParts = costStr.split("."); if (costParts[0] && costParts[0].length > 7) errors.costPerBaseUnit = "Maximum 7 digits allowed"; else if (costParts[1] && costParts[1].length > 3) errors.costPerBaseUnit = "Maximum 3 decimal places allowed"; }
                }
                setMovementFormErrors(errors);
                if (Object.keys(errors).length) return;
                if (isPO) {
                  const validItems = (movementForm.purchaseItems || []).filter((pi) => pi.item && pi.quantity > 0);
                  setSaving(true);
                  (async () => {
                    try {
                      const poPayload = {
                        poNumber: movementForm.poNumber,
                        supplier: movementForm.supplier,
                        orderDate: movementForm.orderDate || new Date().toISOString().slice(0, 10),
                        expectedDeliveryDate: movementForm.expectedDeliveryDate || undefined,
                        items: validItems.map((pi) => ({ item: pi.item, quantityOrdered: pi.quantity, unitCost: pi.unitCost, notes: pi.notes })),
                      };
                      const poRes = await fetch("/api/inventory/purchase-orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(poPayload) });
                      const poData = await poRes.json();
                      if (!poRes.ok) throw new Error(poData.error || "Failed to create purchase order");

                      const supplierObj = suppliers.find((s) => s._id === movementForm.supplier);
                      let received = 0;
                      let failed = 0;
                      for (let i = 0; i < validItems.length; i++) {
                        const pi = validItems[i];
                        const itemObj = inventory.items.find((it) => it._id === pi.item);
                        if (!itemObj) { failed++; continue; }
                        let qtyBase = pi.quantity;
                        const itemUom = COMMON_UOMS.find((u) => u.symbol === itemObj.baseUom?.symbol);
                        if (itemUom && itemObj.baseUom) qtyBase = pi.quantity * (itemUom.conversionToBase || 1);
                        const receiptPayload = {
                          action: "movement",
                          itemId: pi.item,
                          movementType: "purchase",
                          quantityBase: qtyBase,
                          costPerBaseUnit: pi.unitCost,
                          supplier: supplierObj?.name || "",
                          batchNo: `PO-${movementForm.poNumber}-${i + 1}`,
                          receivedDate: movementForm.orderDate || new Date().toISOString(),
                          referenceNo: movementForm.poNumber,
                          reason: `Purchase ${movementForm.poNumber}`,
                          movementDate: movementForm.orderDate || new Date().toISOString(),
                        };
                        const res = await fetch("/api/inventory", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(receiptPayload) });
                        if (res.ok) { received++; } else {
                          try { const errData = await res.json(); console.error("Movement failed:", errData); } catch {}
                          failed++;
                        }
                      }
                      setMovementForm({ ...emptyMovement, purchaseItems: [{ item: "", quantity: "", unitCost: "", notes: "" }] });
                      setMovementFormErrors({});
                      if (failed === 0) {
                        setSuccessMessage(`Purchase "${movementForm.poNumber}" — ${received} item(s) received into stock`);
                      } else if (received === 0) {
                        setError(`Purchase "${movementForm.poNumber}" failed — all ${failed} item(s) could not be received`);
                      } else {
                        setSuccessMessage(`Purchase "${movementForm.poNumber}" — ${received} item(s) received, ${failed} failed`);
                      }
                      await loadInventory(itemPage);
                      if (typeof loadMovements === "function") loadMovements(1);
                    } catch (err) { setError(err.message); } finally { setSaving(false); }
                  })();
                } else {
                  let payload = { action: "movement", ...movementForm };
                  if (payload.movementType === "receipt" && payload.supplier) {
                    const supplierObj = suppliers.find((s) => s._id === payload.supplier);
                    if (supplierObj) payload.supplier = supplierObj.name;
                  }
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
                  }, (fieldErrors) => {
                    setMovementFormErrors((prev) => ({ ...prev, ...fieldErrors }));
                  });
                }
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
              setFilters={applyMovementFilters}
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

function InventoryTable({ items, onEdit, onOrder }) {
  const supplierName = (item) => item.preferredSupplierRef?.name || item.preferredSupplier || "-";
  return (
    <div className="form-card" style={{ padding: 0, overflowX: "auto", borderRadius: 8 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 1200 }}>
        <thead>
          <tr style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
            {["Item", "Generic Name", "Category", "Stock", "Min/Reorder/Max", "Batch No", "Manufacturer", "Supplier", "Location", "Expiry", "Status", "Action"].map((heading) => (
              <th key={heading} style={{ padding: "12px 14px", textAlign: "left", color: "var(--text-secondary)", fontWeight: 700, whiteSpace: "nowrap" }}>{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const availableStock = (item.stockOnHandBase || 0) - (item.reservedBase || 0);
            const low = availableStock <= item.minimumStockBase;
            const reorder = item.reorderLevelBase && availableStock <= item.reorderLevelBase;
            const expiryTone = item.expiredBatches ? "danger" : item.nearExpiryBatches ? "warn" : "good";
            const latestBatch = item.batches?.length ? item.batches[item.batches.length - 1] : null;
            return (
              <tr key={item._id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                <td style={{ padding: "12px 14px" }}>
                  <div style={{ fontWeight: 800, color: "var(--text-primary)" }}>{item.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{item.itemCode} <span style={{ display: "inline-block", padding: "1px 6px", borderRadius: 4, background: "var(--surface)", border: "1px solid var(--border)", fontSize: 10, marginLeft: 4 }}>{item.itemType}</span></div>
                </td>
                <td style={{ padding: "12px 14px" }}>{item.genericName || "-"}</td>
                <td style={{ padding: "12px 14px" }}>
                  <div>{item.category?.name || "-"}</div>
                  <small style={{ color: "var(--text-muted)" }}>{item.subCategory?.name || ""}</small>
                </td>
                <td style={{ padding: "12px 14px", fontWeight: 800, color: low ? "#b91c1c" : "var(--text-primary)" }}>
                  {formatNumber(availableStock)} {item.baseUom?.symbol}
                  {(item.reservedBase || 0) > 0 && (
                    <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>
                      ({formatNumber(item.stockOnHandBase)} total, {formatNumber(item.reservedBase)} reserved)
                    </div>
                  )}
                </td>
                <td style={{ padding: "12px 14px" }}>{formatNumber(item.minimumStockBase)} / {formatNumber(item.reorderLevelBase)} / {formatNumber(item.maximumStockBase)}</td>
                <td style={{ padding: "12px 14px" }}>{latestBatch?.batchNo || "-"}</td>
                <td style={{ padding: "12px 14px" }}>{item.manufacturer || "-"}</td>
                <td style={{ padding: "12px 14px" }}>{supplierName(item)}</td>
                <td style={{ padding: "12px 14px" }}>{item.defaultLocation || "-"}</td>
                <td style={{ padding: "12px 14px" }}><Badge tone={expiryTone}>{item.expiredBatches ? "Expired" : item.nearExpiryBatches ? "Near expiry" : formatDate(item.nextExpiryDate)}</Badge></td>
                <td style={{ padding: "12px 14px" }}>
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <Badge tone={reorder ? "warn" : low ? "danger" : "good"}>{reorder ? "Reorder" : low ? "Low" : "OK"}</Badge>
                    {onOrder && reorder && (
                      <button type="button" title="Order" onClick={() => onOrder(item)} style={{ width: 30, height: 30, borderRadius: 6, cursor: "pointer", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#166534" }}>+</button>
                    )}
                  </div>
                </td>
                <td style={{ padding: "12px 14px" }}><button className="btn-lims-secondary" onClick={() => onEdit(item)} style={{ height: 32, padding: "0 10px" }}>{Icons.edit}</button></td>
              </tr>
            );
          })}
          {items.length === 0 && (
            <tr><td colSpan="12" style={{ padding: 28, textAlign: "center", color: "var(--text-muted)" }}>No inventory items found.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function MastersPanel({ title, fields, onSubmit, saving, viewMode, onOpenForm, onBack, formContent, listContent, formOnSubmit }) {
  if (viewMode === "form") {
    return (
      <form className="form-card" onSubmit={formOnSubmit || onSubmit} style={{ padding: 20, borderRadius: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          {onBack && <button type="button" className="btn-lims-secondary" onClick={onBack} style={{ height: 32, padding: "0 10px", fontSize: 12 }}>← Back</button>}
          <h5 style={{ margin: 0, fontSize: 16 }}>{title}</h5>
        </div>
        {formContent || fields}
        <button className="btn-lims-primary" disabled={saving} style={{ height: 38, marginTop: 16 }}>{saving ? "Saving..." : "Save"}</button>
      </form>
    );
  }
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {onOpenForm && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h5 style={{ margin: 0, fontSize: 16 }}>{title}</h5>
          <button className="btn-lims-primary" onClick={onOpenForm} style={{ height: 34, padding: "0 14px", fontSize: 12 }}>+ Add New</button>
        </div>
      )}
      {listContent || (
        <div className="form-card" style={{ padding: 20, borderRadius: 8 }}>
          {fields}
          <button className="btn-lims-primary" disabled={saving} style={{ height: 38, marginTop: 16 }}>{saving ? "Saving..." : "Save Master"}</button>
        </div>
      )}
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

function StockPanel({ form, setForm, item, items, saving, onSubmit, errors = {}, setErrors, viewMode, onRelease, movements = [], movementPagination = {}, onMovementPageChange, locations = [], setLocations, suppliers = [], inventory = { items: [] }, filters = {}, setFilters, onFilterSearch }) {
  const isAdjustment = form.movementType === "adjustment";
  const isReceipt = form.movementType === "receipt";
  const isPurchase = form.movementType === "purchase";
  const actionBtnStyle = { width: 30, height: 30, borderRadius: 6, cursor: "pointer", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", border: "none" };
  const baseUomSymbol = item?.baseUom?.symbol || "";
  const availableUoms = useMemo(() => {
    const fromCommon = COMMON_UOMS.filter((u) => u.type === "count" || u.type === "pack");
    if (baseUomSymbol && !fromCommon.some((u) => u.symbol === baseUomSymbol)) fromCommon.push({ symbol: baseUomSymbol, name: baseUomSymbol, baseSymbol: baseUomSymbol, conversionToBase: 1 });
    return fromCommon;
  }, [baseUomSymbol]);

  const [locMode, setLocMode] = useState(null);
  const [locForm, setLocForm] = useState({ name: "", code: "" });
  const [locErrors, setLocErrors] = useState({});
  const [locSaving, setLocSaving] = useState(false);

  async function refreshLocations() {
    try {
      const r = await fetch("/api/inventory/locations");
      const d = await r.json();
      if (r.ok) setLocations?.(d.locations || []);
    } catch {}
  }

  async function saveLocation() {
    const errs = {};
    const name = (locForm.name || "").trim();
    const code = (locForm.code || "").trim().toUpperCase();
    if (!name) errs.name = "Name is required";
    else if (name.length > 120) errs.name = "Max 120 characters";
    else if (!/^[A-Za-z0-9 .&'\/,()@_-]*$/.test(name)) errs.name = "Invalid characters";
    else if (/https?:\/\//.test(name)) errs.name = "URLs not allowed";
    if (!code) errs.code = "Code is required";
    else if (code.length > 20) errs.code = "Max 20 characters";
    else if (!/^[A-Z0-9-]+$/.test(code)) errs.code = "Uppercase letters, numbers and - only";
    else if (/https?:\/\//.test(code)) errs.code = "URLs not allowed";
    setLocErrors(errs);
    if (Object.keys(errs).length) return;
    setLocSaving(true);
    try {
      let r, d;
      if (locMode === "edit" && locForm._id) {
        r = await fetch(`/api/inventory/locations/${locForm._id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, code }) });
      } else {
        r = await fetch("/api/inventory/locations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, code }) });
      }
      d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setLocMode(null);
      setLocForm({ name: "", code: "" });
      setLocErrors({});
      await refreshLocations();
    } catch (err) { setLocErrors({ general: err.message }); } finally { setLocSaving(false); }
  }

  async function deleteLocation(loc) {
    if (!loc?._id) return;
    if (!window.confirm(`Delete location "${loc.name}"?`)) return;
    try {
      const r = await fetch(`/api/inventory/locations/${loc._id}`, { method: "DELETE" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      if (form.toLocation === loc.name) setForm({ ...form, toLocation: "" });
      await refreshLocations();
    } catch (err) { setLocErrors({ general: err.message }); }
  }

  if (viewMode === "list") {
    const typeColors = { opening: "neutral", receipt: "good", issue: "danger", adjustment: "warn", transfer: "info", wastage: "danger", expiry: "danger", purchase: "info" };
    return (
      <div className="form-card" style={{ padding: 20, borderRadius: 8 }}>
        <h5 style={{ margin: "0 0 12px", fontSize: 16 }}>Stock Transactions</h5>
        <div className="row g-3" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end", marginBottom: 12 }}>
          <div style={{ flex: "1 1 160px", minWidth: 130 }}>
            <select className="lims-input" value={filters.type} onChange={(e) => { setFilters?.(prev => ({ ...prev, type: e.target.value })); onFilterSearch?.(); }} style={inputStyle()}>
              <option value="">All Types</option>
              {["opening", "receipt", "purchase", "issue", "adjustment", "transfer", "wastage", "expiry"].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div style={{ flex: "1 1 140px", minWidth: 120 }}>
            <input className="lims-input" type="date" value={filters.dateFrom} onChange={(e) => { setFilters?.(prev => ({ ...prev, dateFrom: e.target.value })); onFilterSearch?.(); }} style={inputStyle()} placeholder="From" />
          </div>
          <div style={{ flex: "1 1 140px", minWidth: 120 }}>
            <input className="lims-input" type="date" value={filters.dateTo} onChange={(e) => { setFilters?.(prev => ({ ...prev, dateTo: e.target.value })); onFilterSearch?.(); }} style={inputStyle()} placeholder="To" />
          </div>
          <div style={{ flex: "2 1 200px", minWidth: 160 }}>
            <input className="lims-input" value={filters.search || ""} onChange={(e) => setFilters?.(prev => ({ ...prev, search: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") onFilterSearch?.(); }} placeholder="Search ref, reason, location…" style={inputStyle()} />
          </div>
          <button className="btn-lims-primary" onClick={onFilterSearch} style={{ height: 38, padding: "0 14px" }}>{Icons.search} Search</button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 900 }}>
            <thead>
              <tr style={{ background: "var(--surface)" }}>
                {["Date", "Type", "Item", "Batch", "Qty", "Cost/Unit", "Total", "Supplier", "Prev Stock", "After Stock", "From / To", "Reason", "Ref No", "By"].map((h) => <th key={h} style={{ padding: 10, textAlign: "left", fontWeight: 600, fontSize: 12, color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {movements.length === 0 && (
                <tr><td colSpan={14} style={{ padding: 28, textAlign: "center", color: "var(--text-muted)" }}>No transactions found.</td></tr>
              )}
              {movements.map((m) => {
                const uomSym = m.item?.baseUom?.symbol || "";
                const isNeg = ["issue", "wastage", "expiry"].includes(m.movementType) || m.quantityBase < 0;
                const qtyStr = `${isNeg ? "-" : "+"}${formatNumber(Math.abs(m.quantityBase))} ${uomSym}`;
                const prevStock = m.balanceAfterBase - m.quantityBase;
                const fromTo = m.movementType === "transfer" ? `${m.fromLocation || "-"} → ${m.toLocation || "-"}` : m.movementType === "receipt" || m.movementType === "purchase" || m.movementType === "opening" ? (m.toLocation || "-") : (m.fromLocation || m.toLocation || "-");
                const unitCost = m.costPerBaseUnit || 0;
                const totalCost = Math.abs(m.quantityBase) * unitCost;
                return (
                  <tr key={m._id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                    <td style={{ padding: 10, whiteSpace: "nowrap" }}>{formatDate(m.movementDate)}</td>
                    <td style={{ padding: 10 }}><Badge tone={typeColors[m.movementType] || "neutral"}>{m.movementType}</Badge></td>
                    <td style={{ padding: 10 }}>{m.item?.name || "-"}</td>
                    <td style={{ padding: 10, fontSize: 12, color: "var(--text-muted)" }}>{m.batchId ? String(m.batchId).slice(-6) : "-"}</td>
                    <td style={{ padding: 10, fontWeight: 600, color: isNeg ? "#b91c1c" : "#166534" }}>{qtyStr}</td>
                    <td style={{ padding: 10, fontSize: 12, color: "var(--text-muted)" }}>{unitCost > 0 ? `Rs ${formatNumber(unitCost)}` : "-"}</td>
                    <td style={{ padding: 10, fontWeight: 600, color: totalCost > 0 ? "#166534" : "var(--text-muted)" }}>{totalCost > 0 ? `Rs ${formatNumber(totalCost)}` : "-"}</td>
                    <td style={{ padding: 10, fontSize: 12, color: "var(--text-muted)", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={m.supplier || ""}>{m.supplier || "-"}</td>
                    <td style={{ padding: 10, fontSize: 12, color: "var(--text-muted)" }}>{formatNumber(prevStock)} {uomSym}</td>
                    <td style={{ padding: 10, fontWeight: 600 }}>{formatNumber(m.balanceAfterBase)} {uomSym}</td>
                    <td style={{ padding: 10, fontSize: 12, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fromTo}</td>
                    <td style={{ padding: 12, fontSize: 12, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={m.reason || ""}>{m.reason || "-"}</td>
                    <td style={{ padding: 10, fontSize: 12, color: "var(--text-muted)" }}>{m.referenceNo || "-"}</td>
                    <td style={{ padding: 10, fontSize: 12, color: "var(--text-muted)" }}>{m.performedBy || "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {movementPagination.totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, fontSize: 12, color: "var(--text-muted)" }}>
            <span>Page {movementPagination.page} of {movementPagination.totalPages} ({movementPagination.total} records)</span>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn-lims-secondary" disabled={movementPagination.page <= 1} onClick={() => onMovementPageChange?.(movementPagination.page - 1)} style={{ height: 30, padding: "0 10px", fontSize: 12 }}>Prev</button>
              <button className="btn-lims-secondary" disabled={movementPagination.page >= movementPagination.totalPages} onClick={() => onMovementPageChange?.(movementPagination.page + 1)} style={{ height: 30, padding: "0 10px", fontSize: 12 }}>Next</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <form className="form-card" onSubmit={onSubmit} style={{ padding: 20, borderRadius: 8 }}>
      <h5 style={{ margin: "0 0 16px", fontSize: 16 }}>Stock Transaction</h5>
      {!isPurchase && (
      <div className="row g-3">
        <div className="col-md-6">
          <Field label="Item">
            <select required className="lims-input" value={form.itemId} onChange={(e) => { const newItemId = e.target.value; const newItem = items.find((i) => i._id === newItemId); const newUom = newItem?.baseUom?.symbol || ""; const isReceiptType = form.movementType === "receipt"; const lastBatch = newItem?.batches?.length ? newItem.batches[newItem.batches.length - 1] : null; const batchQuantity = isReceiptType && lastBatch ? lastBatch.quantityBase : ""; const isAdj = form.movementType === "adjustment"; const autoBatchId = (isReceiptType || form.movementType === "transfer" || form.movementType === "wastage") && lastBatch ? lastBatch._id : ""; const adjBatch = isAdj && newItem ? (newItem.batches || []).filter((b) => b.quantityBase > 0).sort((a, b) => { if (!a.expiryDate) return 1; if (!b.expiryDate) return -1; return new Date(a.expiryDate) - new Date(b.expiryDate); })[0] : null; const adjBatchId = isAdj && adjBatch ? adjBatch._id : ""; const selUnit = form.quantityUnit || newUom; const uom = COMMON_UOMS.find((u) => u.symbol === selUnit); const conv = uom?.conversionToBase || 1; setErrors?.({}); setForm({ ...form, itemId: newItemId, batchId: isAdj ? adjBatchId : autoBatchId, quantityUnit: newUom, quantityBase: batchQuantity, newBalanceBase: isAdj && adjBatch ? (adjBatch.quantityBase / conv) : "", batchNo: lastBatch?.batchNo || "", expiryDate: lastBatch?.expiryDate ? lastBatch.expiryDate.split("T")[0] : "", toLocation: form.movementType === "adjustment" ? (newItem?.defaultLocation || "") : form.toLocation }); }} style={inputStyle()}>
              <option value="">Select item</option>
              {items.map((stockItem) => <option key={stockItem._id} value={stockItem._id}>{stockItem.itemCode} - {stockItem.name}</option>)}
            </select>
            <ErrorMsg message={errors.itemId} />
          </Field>
        </div>
        <div className="col-md-6">
          <Field label="Transaction">
            <select className="lims-input" value={form.movementType} onChange={(e) => { setLocMode(null); setLocErrors({}); setForm({ ...form, movementType: e.target.value }); }} style={inputStyle()}>
              {["purchase", "adjustment", "transfer", "wastage"].map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </Field>
        </div>
      </div>
      )}
      {isPurchase && (
        <div className="row g-3">
          <div className="col-md-6">
            <Field label="Transaction">
            <select className="lims-input" value={form.movementType} onChange={(e) => { const newType = e.target.value; const selItem = items.find((i) => i._id === form.itemId); setForm({ ...form, movementType: newType, toLocation: newType === "adjustment" && selItem ? (selItem.defaultLocation || "") : form.toLocation }); }} style={inputStyle()}>
                {["purchase", "adjustment", "transfer", "wastage"].map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </Field>
          </div>
        </div>
      )}
      {isPurchase && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
          <div className="row g-3">
            <div className="col-md-6">
              <Field label="PO Number *">
                <input className="lims-input" value={form.poNumber} onChange={(e) => setForm({ ...form, poNumber: e.target.value.toUpperCase() })} placeholder="e.g. PO-001" maxLength={30} style={inputStyle()} />
                <ErrorMsg message={errors.poNumber} />
              </Field>
            </div>
            <div className="col-md-6">
              <Field label="Supplier *">
                <select className="lims-input" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} style={inputStyle()}>
                  <option value="">Select supplier</option>
                  {suppliers.filter((s) => s.status === "active").map((s) => (
                    <option key={s._id} value={s._id}>{s.code} — {s.name}</option>
                  ))}
                </select>
                <ErrorMsg message={errors.supplier} />
              </Field>
            </div>
          </div>
          <div className="row g-3">
            <div className="col-md-6">
              <Field label="Order Date *">
                <input required className="lims-input" type="date" value={form.orderDate} onChange={(e) => { setErrors?.((p) => ({ ...p, orderDate: "" })); setForm({ ...form, orderDate: e.target.value }); }} style={inputStyle()} />
                <ErrorMsg message={errors.orderDate} />
              </Field>
            </div>
            <div className="col-md-6">
              <Field label="Expected Delivery *">
                <input required className="lims-input" type="date" value={form.expectedDeliveryDate} onChange={(e) => { setErrors?.((p) => ({ ...p, expectedDeliveryDate: "" })); setForm({ ...form, expectedDeliveryDate: e.target.value }); }} style={inputStyle()} />
                <ErrorMsg message={errors.expectedDeliveryDate} />
              </Field>
            </div>
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <label style={{ fontWeight: 600, fontSize: 13 }}>Line Items *</label>
              <button type="button" className="btn-lims-secondary" onClick={() => setForm({ ...form, purchaseItems: [...form.purchaseItems, { item: "", quantity: "", unitCost: "", notes: "" }] })} style={{ padding: "4px 10px", fontSize: 12 }}>+ Add Item</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 36px", gap: 6, marginBottom: 4, fontSize: 11, fontWeight: 600, color: "#64748b", padding: "0 2px" }}>
              <span>Item</span><span>Qty</span><span>Unit Cost</span><span>Total</span><span></span>
            </div>
            <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
              {form.purchaseItems.map((pi, idx) => {
                const lineTotal = (pi.quantity * pi.unitCost).toFixed(2);
                return (
                  <div key={idx} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 36px", gap: 6, alignItems: "center" }}>
                    <select className="lims-input" value={pi.item} onChange={(e) => { const pItems = [...form.purchaseItems]; pItems[idx] = { ...pItems[idx], item: e.target.value }; setForm({ ...form, purchaseItems: pItems }); }} style={{ ...inputStyle(), fontSize: 12, padding: "4px 6px" }}>
                      <option value="">Select item</option>
                      {inventory.items.filter((it) => it.status === "active").map((it) => (
                        <option key={it._id} value={it._id}>{it.itemCode} — {it.name}</option>
                      ))}
                    </select>
                    <input className="lims-input" type="number" min="1" value={pi.quantity} onChange={(e) => { const v = e.target.value; const pItems = [...form.purchaseItems]; pItems[idx] = { ...pItems[idx], quantity: v === "" ? "" : Number(v) }; setForm({ ...form, purchaseItems: pItems }); }} style={{ ...inputStyle(), fontSize: 12, padding: "4px 6px" }} />
                    <input className="lims-input" type="number" min="0" step="0.01" value={pi.unitCost} onChange={(e) => { const v = e.target.value; const pItems = [...form.purchaseItems]; pItems[idx] = { ...pItems[idx], unitCost: v === "" ? "" : Number(v) }; setForm({ ...form, purchaseItems: pItems }); }} style={{ ...inputStyle(), fontSize: 12, padding: "4px 6px" }} />
                    <span style={{ fontSize: 12, fontWeight: 500, color: "#374151" }}>Rs {lineTotal}</span>
                    {form.purchaseItems.length > 1 && (
                      <button type="button" onClick={() => { const pItems = form.purchaseItems.filter((_, i) => i !== idx); setForm({ ...form, purchaseItems: pItems }); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {Icons.trash}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 6, fontWeight: 600, fontSize: 13, color: "#1e293b", textAlign: "right" }}>
              Total: Rs {form.purchaseItems.reduce((sum, l) => sum + (l.quantity * l.unitCost), 0).toFixed(2)}
            </div>
            <ErrorMsg message={errors.purchaseItems} />
          </div>
        </div>
      )}
      {!isPurchase && !isReceipt && !isAdjustment && (
        <div className="row g-3">
          <div className="col-12">
            <Field label="Batch">
              {(() => {
                const batchList = (item?.batches || []).filter((batch) => batch.quantityBase > 0);
                if (batchList.length === 0) {
                  return <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>No available batches with positive stock for this item.</p>;
                }
                const autoBatch = batchList.sort((a, b) => {
                  if (!a.expiryDate) return 1;
                  if (!b.expiryDate) return -1;
                  return new Date(a.expiryDate) - new Date(b.expiryDate);
                })[0];
                const batchId = form.batchId || autoBatch._id;
                const selBatch = (item.batches || []).find((b) => b._id === batchId);
                return (
                  <>
                    <input className="lims-input" disabled value={selBatch ? `${selBatch.batchNo || "Batch"} (available: ${formatNumber(selBatch.quantityBase)}${selBatch.expiryDate ? `, expires: ${new Date(selBatch.expiryDate).toISOString().split("T")[0]}` : ""})` : ""} style={{ ...inputStyle(), background: "#f3f4f6" }} />
                    {selBatch && (
                      <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 12, color: "var(--text-muted)" }}>
                        <span>Qty: {formatNumber(selBatch.quantityBase)} {item.baseUom?.symbol}</span>
                        {selBatch.expiryDate && <span>Expiry: {formatDate(selBatch.expiryDate)}</span>}
                        {selBatch.location && <span>Location: {selBatch.location}</span>}
                        <span>Status: {selBatch.status}</span>
                      </div>
                    )}
                  </>
                );
              })()}
              <ErrorMsg message={errors.batchId} />
            </Field>
          </div>
        </div>
      )}
      {isReceipt && (
        <div className="row g-3">
          <div className="col-md-4">
            <Field label="Batch No">
              <input className="lims-input" disabled value={(() => {
                if (item && item.batches && item.batches.length > 0) {
                  const lastBatch = item.batches[item.batches.length - 1];
                  return lastBatch.batchNo || "";
                }
                return form.batchNo;
              })()} style={{ ...inputStyle(), background: "#f3f4f6" }} />
              <ErrorMsg message={errors.batchNo} />
            </Field>
          </div>
          <div className="col-md-4">
            <Field label="Expiry">
              <input className="lims-input" type="date" disabled value={(() => {
                if (item && item.batches && item.batches.length > 0) {
                  const lastBatch = item.batches[item.batches.length - 1];
                  return lastBatch.expiryDate ? lastBatch.expiryDate.split("T")[0] : "";
                }
                return form.expiryDate;
              })()} style={{ ...inputStyle(), background: "#f3f4f6" }} />
              <ErrorMsg message={errors.expiryDate} />
            </Field>
          </div>
          <div className="col-md-4">
            <Field label="Received Date"><input className="lims-input" type="date" value={form.receivedDate} onChange={(e) => setForm({ ...form, receivedDate: e.target.value })} style={inputStyle()} /></Field>
          </div>
        </div>
      )}
      {!isPurchase && (
      <div className="row g-3">
        {isAdjustment ? (
          <>
            {item && (item?.batches || []).filter((batch) => batch.quantityBase > 0).length > 0 ? (
              <div className="col-12">
                <Field label="Batch">
                  {(() => {
                    const batchList = (item?.batches || []).filter((batch) => batch.quantityBase > 0);
                    const autoBatch = batchList.sort((a, b) => {
                      if (!a.expiryDate) return 1;
                      if (!b.expiryDate) return -1;
                      return new Date(a.expiryDate) - new Date(b.expiryDate);
                    })[0];
                    const batchId = form.batchId || autoBatch._id;
                    const selBatch = (item.batches || []).find((b) => b._id === batchId);
                    return (
                      <>
                        <input className="lims-input" disabled value={selBatch ? `${selBatch.batchNo || "Batch"} (available: ${formatNumber(selBatch.quantityBase)}${selBatch.expiryDate ? `, expires: ${new Date(selBatch.expiryDate).toISOString().split("T")[0]}` : ""})` : ""} style={{ ...inputStyle(), background: "#f3f4f6" }} />
                        {selBatch && (
                          <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 12, color: "var(--text-muted)" }}>
                            <span>Qty: {formatNumber(selBatch.quantityBase)} {item.baseUom?.symbol}</span>
                            {selBatch.expiryDate && <span>Expiry: {formatDate(selBatch.expiryDate)}</span>}
                            {selBatch.location && <span>Location: {selBatch.location}</span>}
                            <span>Status: {selBatch.status}</span>
                          </div>
                        )}
                      </>
                    );
                  })()}
                  <ErrorMsg message={errors.batchId} />
                </Field>
              </div>
            ) : null}
            <div className={item && (item?.batches || []).filter((batch) => batch.quantityBase > 0).length > 0 ? "col-md-6" : "col-md-3"}>
              <Field label="Previous Stock">
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {(() => {
                    const selUnit = form.quantityUnit || baseUomSymbol;
                    const uom = COMMON_UOMS.find((u) => u.symbol === selUnit);
                    const conv = uom?.conversionToBase || 1;
                    const prevVal = conv ? (item?.stockOnHandBase ?? 0) / conv : 0;
                    const rounded = prevVal % 1 === 0 ? prevVal : Number(prevVal.toFixed(3));
                    return <input disabled className="lims-input" type="number" value={rounded} style={{ ...inputStyle(), flex: 1, background: "#f3f4f6" }} />;
                  })()}
                  <select className="lims-input" value={form.quantityUnit || (item ? baseUomSymbol : "")} onChange={(e) => { const newUnit = e.target.value; const oldUnit = form.quantityUnit || baseUomSymbol; if (oldUnit && newUnit && oldUnit !== newUnit) { const oldUom = COMMON_UOMS.find((u) => u.symbol === oldUnit); const newUom = COMMON_UOMS.find((u) => u.symbol === newUnit); if (oldUom && newUom) { if (form.newBalanceBase === "" || form.newBalanceBase === undefined || form.newBalanceBase === null) { setForm({ ...form, quantityUnit: newUnit }); return; } const currentVal = Number(form.newBalanceBase) || 0; const baseVal = currentVal * (oldUom.conversionToBase || 1); const newVal = baseVal / (newUom.conversionToBase || 1); setForm({ ...form, quantityUnit: newUnit, newBalanceBase: newVal }); return; } } setForm({ ...form, quantityUnit: newUnit }); }} style={{ width: 85, flexShrink: 0 }}>
                    {availableUoms.map((u) => <option key={u.symbol} value={u.symbol}>{u.symbol}</option>)}
                  </select>
                </div>
              </Field>
            </div>
            <div className={item && (item?.batches || []).filter((batch) => batch.quantityBase > 0).length > 0 ? "col-md-6" : "col-md-3"}>
              <Field label="Current Stock">
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input required className="lims-input" type="number" min="0" max="9999999" step="1" value={form.newBalanceBase} onChange={(e) => { const v = e.target.value; if (isExponential(v)) { setErrors?.((p) => ({ ...p, newBalanceBase: "Exponential notation is not allowed" })); return; } if (v.includes(".")) { setErrors?.((p) => ({ ...p, newBalanceBase: "Only whole numbers are allowed" })); return; } if (v && v.length > 7) { setErrors?.((p) => ({ ...p, newBalanceBase: "Maximum 7 digits allowed" })); return; } setErrors?.((p) => ({ ...p, newBalanceBase: "" })); setForm({ ...form, newBalanceBase: v }); }} style={{ ...inputStyle(), flex: 1 }} />
                  <select className="lims-input" value={form.quantityUnit || (item ? baseUomSymbol : "")} onChange={(e) => { const newUnit = e.target.value; const oldUnit = form.quantityUnit || baseUomSymbol; if (oldUnit && newUnit && oldUnit !== newUnit) { const oldUom = COMMON_UOMS.find((u) => u.symbol === oldUnit); const newUom = COMMON_UOMS.find((u) => u.symbol === newUnit); if (oldUom && newUom) { if (form.newBalanceBase === "" || form.newBalanceBase === undefined || form.newBalanceBase === null) { setForm({ ...form, quantityUnit: newUnit }); return; } const currentVal = Number(form.newBalanceBase) || 0; const baseVal = currentVal * (oldUom.conversionToBase || 1); const newVal = baseVal / (newUom.conversionToBase || 1); setForm({ ...form, quantityUnit: newUnit, newBalanceBase: newVal }); return; } } setForm({ ...form, quantityUnit: newUnit }); }} style={{ width: 85, flexShrink: 0 }}>
                    {availableUoms.map((u) => <option key={u.symbol} value={u.symbol}>{u.symbol}</option>)}
                  </select>
                </div>
                <ErrorMsg message={errors.newBalanceBase} />
              </Field>
            </div>
          </>
        ) : (
          <div className={isReceipt ? "col-md-6" : "col-md-6"}>
            <Field label={isReceipt ? "Current Qty (Batch)" : "Quantity"}>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input required className="lims-input" type="number" min="0" max="9999999" step="1" value={isReceipt ? (() => { if (item && item.batches && item.batches.length > 0) { const selUnit = form.quantityUnit || baseUomSymbol; const uom = COMMON_UOMS.find((u) => u.symbol === selUnit); const conv = uom?.conversionToBase || 1; const lastBatch = item.batches[item.batches.length - 1]; const val = conv ? lastBatch.quantityBase / conv : 0; return val % 1 === 0 ? val : Number(val.toFixed(3)); } return form.quantityBase; })() : form.quantityBase} onChange={isReceipt ? undefined : (e) => { const v = e.target.value; if (isExponential(v)) { setErrors?.((p) => ({ ...p, quantityBase: "Exponential notation is not allowed" })); return; } if (v.includes(".")) { setErrors?.((p) => ({ ...p, quantityBase: "Only whole numbers are allowed" })); return; } if (v && v.length > 7) { setErrors?.((p) => ({ ...p, quantityBase: "Maximum 7 digits allowed" })); return; } setErrors?.((p) => ({ ...p, quantityBase: "" })); setForm({ ...form, quantityBase: v }); }} disabled={isReceipt} style={{ ...inputStyle(), flex: 1, ...(isReceipt ? { background: "#f3f4f6" } : {}) }} />
                <select className="lims-input" value={form.quantityUnit || (item ? baseUomSymbol : "")} onChange={(e) => { const newUnit = e.target.value; const oldUnit = form.quantityUnit || baseUomSymbol; if (oldUnit && newUnit && oldUnit !== newUnit) { const oldUom = COMMON_UOMS.find((u) => u.symbol === oldUnit); const newUom = COMMON_UOMS.find((u) => u.symbol === newUnit); if (oldUom && newUom) { if (form.quantityBase === "" || form.quantityBase === undefined || form.quantityBase === null) { setForm({ ...form, quantityUnit: newUnit }); return; } const currentVal = Number(form.quantityBase) || 0; const baseVal = currentVal * (oldUom.conversionToBase || 1); const newVal = baseVal / (newUom.conversionToBase || 1); setForm({ ...form, quantityUnit: newUnit, quantityBase: newVal }); return; } } setForm({ ...form, quantityUnit: newUnit }); }} style={{ width: 85, flexShrink: 0 }}>
                  {availableUoms.map((u) => <option key={u.symbol} value={u.symbol}>{u.symbol}</option>)}
                </select>
              </div>
              <ErrorMsg message={errors.quantityBase} />
            </Field>
          </div>
        )}
        <div className="col-md-6">
          <Field label={isReceipt || isAdjustment ? "Unit Cost" : "Cost / Base Unit"}>
            <input className="lims-input" type="number" min="0" max="9999999" step="0.001" value={form.costPerBaseUnit} onChange={(e) => { const v = e.target.value; if (isExponential(v)) { setErrors?.((p) => ({ ...p, costPerBaseUnit: "Exponential notation is not allowed" })); return; } const parts = v.split("."); if (parts[0] && parts[0].length > 7) { setErrors?.((p) => ({ ...p, costPerBaseUnit: "Maximum 7 digits allowed" })); return; } if (parts[1] && parts[1].length > 3) { setErrors?.((p) => ({ ...p, costPerBaseUnit: "Maximum 3 decimal places allowed" })); return; } setErrors?.((p) => ({ ...p, costPerBaseUnit: "" })); setForm({ ...form, costPerBaseUnit: v }); }} style={inputStyle()} />
            <ErrorMsg message={errors.costPerBaseUnit} />
          </Field>
        </div>
      </div>
      )}
      {!isPurchase && (
      <div className="row g-3">
        <div className="col-md-6">
          <Field label={isReceipt ? "Supplier" : form.movementType === "issue" ? "Issued To" : form.movementType === "transfer" ? "To Location" : "Location"}>
            {isAdjustment ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {locations.length > 0 ? (
                    <select className="lims-input" value={form.toLocation} onChange={(e) => { setErrors?.((p) => ({ ...p, toLocation: "" })); setLocErrors({}); setForm({ ...form, toLocation: e.target.value }); }} style={{ ...inputStyle(), flex: 1 }}>
                      <option value="">-- Select --</option>
                      {locations.filter((l) => l.status === "active").map((l) => <option key={l._id} value={l.name}>{l.code} — {l.name}</option>)}
                    </select>
                  ) : (
                    <input className="lims-input" required maxLength={120} value={form.toLocation} onChange={(e) => { const v = e.target.value; if (v && !/^[A-Za-z0-9 .&'\/,()@_-]*$/.test(v)) { setErrors?.((p) => ({ ...p, toLocation: "Invalid characters" })); return; } setErrors?.((p) => ({ ...p, toLocation: "" })); setForm({ ...form, toLocation: v }); }} style={{ ...inputStyle(), flex: 1 }} />
                  )}
                  <button type="button" title="Add location" onClick={() => { setLocMode("add"); setLocForm({ name: "", code: "" }); setLocErrors({}); }} style={{ width: 30, height: 30, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #d1d5db", borderRadius: 6, background: "#f0fdf4", color: "#166534", cursor: "pointer" }}>{Icons.plus}</button>
                  <button type="button" title="Edit selected location" disabled={!form.toLocation} onClick={() => { const loc = locations.find((l) => l.name === form.toLocation); if (loc) { setLocMode("edit"); setLocForm({ _id: loc._id, name: loc.name, code: loc.code }); setLocErrors({}); } }} style={{ width: 30, height: 30, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #d1d5db", borderRadius: 6, background: form.toLocation ? "#eff6ff" : "#f9fafb", color: form.toLocation ? "#1e40af" : "#9ca3af", cursor: form.toLocation ? "pointer" : "not-allowed" }}>{Icons.edit}</button>
                  <button type="button" title="Delete selected location" disabled={!form.toLocation} onClick={() => { const loc = locations.find((l) => l.name === form.toLocation); if (loc) deleteLocation(loc); }} style={{ width: 30, height: 30, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #d1d5db", borderRadius: 6, background: form.toLocation ? "#fef2f2" : "#f9fafb", color: form.toLocation ? "#991b1b" : "#9ca3af", cursor: form.toLocation ? "pointer" : "not-allowed" }}>{Icons.trash}</button>
                </div>
                {locMode && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 10, border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc" }}>
                    {locErrors.general && <div style={{ color: "#dc2626", fontSize: 12 }}>{locErrors.general}</div>}
                    <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>Name *</label>
                        <input className="lims-input" maxLength={120} value={locForm.name} onChange={(e) => { setLocErrors((p) => ({ ...p, name: "" })); setLocForm({ ...locForm, name: e.target.value }); }} style={{ ...inputStyle(), fontSize: 12 }} placeholder="e.g. Shelf A" />
                        {locErrors.name && <div style={{ color: "#dc2626", fontSize: 11 }}>{locErrors.name}</div>}
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>Code *</label>
                        <input className="lims-input" maxLength={20} value={locForm.code} onChange={(e) => { const v = e.target.value.toUpperCase(); setLocErrors((p) => ({ ...p, code: "" })); setLocForm({ ...locForm, code: v }); }} style={{ ...inputStyle(), fontSize: 12 }} placeholder="e.g. SHFA" />
                        {locErrors.code && <div style={{ color: "#dc2626", fontSize: 11 }}>{locErrors.code}</div>}
                      </div>
                      <button type="button" className="btn-lims-primary" disabled={locSaving} onClick={saveLocation} style={{ height: 32, fontSize: 12, padding: "0 14px" }}>{locSaving ? "Saving..." : locMode === "edit" ? "Update" : "Add"}</button>
                      <button type="button" className="btn-lims-secondary" onClick={() => { setLocMode(null); setLocForm({ name: "", code: "" }); setLocErrors({}); }} style={{ height: 32, fontSize: 12, padding: "0 14px" }}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            ) : isReceipt ? (
              <select className="lims-input" value={form.supplier} onChange={(e) => { const v = e.target.value; setErrors?.((p) => ({ ...p, supplier: "" })); setForm({ ...form, supplier: v }); }} style={{ ...inputStyle(), width: "100%" }}>
                <option value="">-- Select supplier --</option>
                {suppliers.filter((s) => s.status === "active").map((s) => <option key={s._id} value={s._id}>{s.code} — {s.name}</option>)}
              </select>
            ) : locations.length > 0 && form.movementType === "transfer" ? (
              <select className="lims-input" value={form.toLocation} onChange={(e) => { const v = e.target.value; setErrors?.((p) => ({ ...p, toLocation: "" })); setForm({ ...form, toLocation: v }); }} style={{ ...inputStyle(), width: "100%" }}>
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
      )}
      {!isPurchase && (
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
      )}
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
        <button className="btn-lims-primary" disabled={saving} style={{ height: 38, flex: 1 }}>{saving ? "Posting..." : isPurchase ? "Create Purchase Order" : "Post Transaction"}</button>
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
              <tr key={`${item._id}-${batch._id}`} style={{ borderTop: "1px solid var(--border-light)", background: expired ? "#fef2f2" : near ? "#fffbeb" : "transparent" }}>
                <td style={{ padding: 12 }}><strong>{item.name}</strong><br /><small>{item.itemCode}</small></td>
                <td style={{ padding: 12 }}>{batch.batchNo || "-"}</td>
                <td style={{ padding: 12 }}>{formatNumber(batch.quantityBase)} {item.baseUom?.symbol}</td>
                <td style={{ padding: 12 }}>{batch.expiryDate ? formatDate(batch.expiryDate) : "—"}</td>
                <td style={{ padding: 12 }}><Badge tone={riskTone}>{riskLabel}</Badge></td>
                <td style={{ padding: 12, whiteSpace: "nowrap" }}>
                  {(expired || near || isQuarantine) ? (
                    <button className="btn-lims-secondary" onClick={() => onWaste(item, batch)} style={{ height: 32, background: expired ? "#dc2626" : near ? "#f59e0b" : "#6b7280", color: "#fff", borderColor: "transparent" }}>Log Wastage</button>
                  ) : (
                    <span style={{ fontSize: 12, color: "#9ca3af", fontStyle: "italic" }}>—</span>
                  )}
                </td>
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
    opening: "info", receipt: "good", purchase: "good", issue: "warn",
    adjustment: "info", transfer: "neutral", wastage: "danger", expiry: "danger",
  };
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="form-card" style={{ padding: 16, borderRadius: 8 }}>
        <div className="row g-3" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
          <div style={{ flex: "1 1 160px", minWidth: 130 }}>
            <select className="lims-input" value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })} style={inputStyle()}>
              <option value="">All Types</option>
              {["opening", "receipt", "purchase", "issue", "adjustment", "transfer", "wastage", "expiry"].map((t) => <option key={t} value={t}>{t}</option>)}
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
        headings={["Date", "Item", "Type", "Qty", "Cost/Unit", "Total", "Supplier", "Balance", "Reference", "Reason"]}
        rows={movements.map((movement) => {
          const uomSym = movement.item?.baseUom?.symbol || "";
          const isNeg = movement.quantityBase < 0;
          const unitCost = movement.costPerBaseUnit || 0;
          const totalCost = Math.abs(movement.quantityBase) * unitCost;
          return [
            formatDate(movement.movementDate),
            movement.item ? `${movement.item.itemCode} - ${movement.item.name}` : "-",
            <Badge key="type" tone={movementTypeColors[movement.movementType] || "neutral"}>{movement.movementType}</Badge>,
            <span key="qty" style={{ fontWeight: 700, color: isNeg ? "#b91c1c" : "#047857" }}>{formatNumber(movement.quantityBase)}</span>,
            <span key="cost" style={{ fontSize: 12, color: "var(--text-muted)" }}>{unitCost > 0 ? `Rs ${formatNumber(unitCost)}` : "-"}</span>,
            <span key="total" style={{ fontWeight: 600, color: totalCost > 0 ? "#166534" : "var(--text-muted)" }}>{totalCost > 0 ? `Rs ${formatNumber(totalCost)}` : "-"}</span>,
            <span key="supplier" style={{ fontSize: 12, color: "var(--text-muted)", maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={movement.supplier || ""}>{movement.supplier || "-"}</span>,
            <span key="bal" style={{ fontWeight: 600, color: (movement.balanceAfterBase || 0) < 0 ? "#b91c1c" : "#166534" }}>{formatNumber(movement.balanceAfterBase)} {uomSym}</span>,
            movement.referenceNo || "-",
            movement.reason || "-",
          ];
        })}
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
