import { getInventoryUomModel } from "../models/tenant/InventoryUom.js";
import { getInventoryCategoryModel } from "../models/tenant/InventoryCategory.js";
import { getInventorySupplierModel } from "../models/tenant/InventorySupplier.js";
import { getInventoryItemModel } from "../models/tenant/InventoryItem.js";

const uomsData = [
  { name: "Microgram", symbol: "mcg", type: "weight", conversionToBase: 0.000001, baseSymbol: "g" },
  { name: "Milligram", symbol: "mg", type: "weight", conversionToBase: 0.001, baseSymbol: "g" },
  { name: "Gram", symbol: "g", type: "weight", conversionToBase: 1, baseSymbol: "g" },
  { name: "Kilogram", symbol: "kg", type: "weight", conversionToBase: 1000, baseSymbol: "g" },
  { name: "Milliliter", symbol: "mL", type: "volume", conversionToBase: 0.001, baseSymbol: "L" },
  { name: "Liter", symbol: "L", type: "volume", conversionToBase: 1, baseSymbol: "L" },
  { name: "Units", symbol: "units", type: "count", conversionToBase: 1, baseSymbol: "units" },
  { name: "Each", symbol: "each", type: "count", conversionToBase: 1, baseSymbol: "each" },
  { name: "Dozen", symbol: "dozen", type: "count", conversionToBase: 12, baseSymbol: "each" },
  { name: "Box of 10", symbol: "box10", type: "pack", conversionToBase: 10, baseSymbol: "each" },
  { name: "Box of 50", symbol: "box50", type: "pack", conversionToBase: 50, baseSymbol: "each" },
  { name: "Box of 100", symbol: "box100", type: "pack", conversionToBase: 100, baseSymbol: "each" },
  { name: "Strip of 10", symbol: "strip10", type: "pack", conversionToBase: 10, baseSymbol: "each" },
  { name: "Vial", symbol: "vial", type: "pack", conversionToBase: 1, baseSymbol: "each" },
  { name: "Pair", symbol: "pair", type: "count", conversionToBase: 2, baseSymbol: "each" },
];

const categoriesData = [
  { name: "Reagents", code: "REAGENT", description: "Chemical and laboratory reagents" },
  { name: "Consumables", code: "CONSUMABLE", description: "Disposable phlebotomy and lab supplies" },
  { name: "Rapid Test Kits", code: "KIT", description: "Qualitative diagnostic rapid testing kits" },
  { name: "Vacutainers & Tubes", code: "TUBE", description: "Specimen collection tubes and vacutainers" },
  { name: "Personal Protective Equipment", code: "PPE", description: "Gowns, gloves, masks, and protective wear" },
  { name: "Glassware & Labware", code: "GLASS", description: "Pipettes, slides, and glass laboratory materials" },
];

const suppliersData = [
  { name: "Sigma-Aldrich", code: "SIGMA", contactPerson: "John Doe", email: "john@sigma.com", phone: "9876543210", address: "Sigma Road, Bangalore", leadTimeDays: 7, rating: 5 },
  { name: "Roche Diagnostics", code: "ROCHE", contactPerson: "Alice Smith", email: "alice@roche.com", phone: "9876543211", address: "Roche Plaza, Mumbai", leadTimeDays: 10, rating: 5 },
  { name: "Thermo Fisher Scientific", code: "THERMO", contactPerson: "Bob Johnson", email: "bob@thermo.com", phone: "9876543212", address: "Thermo Tech Park, Chennai", leadTimeDays: 5, rating: 4 },
  { name: "Abbott Laboratories", code: "ABBOTT", contactPerson: "Charlie Brown", email: "charlie@abbott.com", phone: "9876543213", address: "Abbott House, Mumbai", leadTimeDays: 7, rating: 4 },
  { name: "Bio-Rad Laboratories", code: "BIORAD", contactPerson: "David Miller", email: "david@biorad.com", phone: "9876543214", address: "Bio-Rad House, Gurgaon", leadTimeDays: 14, rating: 4 },
  { name: "BD Becton Dickinson", code: "BDCO", contactPerson: "Emma Watson", email: "emma@bd.com", phone: "9876543215", address: "BD Tech Office, Gurugram", leadTimeDays: 5, rating: 5 },
];

const itemsData = [
  {
    itemCode: "ETHANOL",
    name: "Ethyl Alcohol 99%",
    genericName: "ETHANOL",
    categoryCode: "REAGENT",
    itemType: "reagent",
    baseUomSymbol: "mL",
    purchaseUomSymbol: "L",
    purchaseToBaseFactor: 1000,
    conversionFactorUnit: "ml",
    minimumStockBase: 2000,
    reorderLevelBase: 3000,
    maximumStockBase: 10000,
    supplierCode: "SIGMA",
    manufacturer: "Sigma-Aldrich",
    storageCondition: "Room Temp (15-25C)",
    defaultLocation: "Flammable Cabinet A",
    trackExpiry: true,
    batches: [
      { batchNo: "ETH001", quantityBase: 3000, costPerBaseUnit: 0.5, location: "Flammable Cabinet A", expiryDateOffsetDays: 365 },
      { batchNo: "ETH002", quantityBase: 2000, costPerBaseUnit: 0.55, location: "Flammable Cabinet A", expiryDateOffsetDays: 730 },
    ]
  },
  {
    itemCode: "LEISHMAN",
    name: "Leishman Stain Solution",
    genericName: "LEISHMAN",
    categoryCode: "REAGENT",
    itemType: "reagent",
    baseUomSymbol: "mL",
    purchaseUomSymbol: "L",
    purchaseToBaseFactor: 1000,
    conversionFactorUnit: "ml",
    minimumStockBase: 500,
    reorderLevelBase: 1000,
    maximumStockBase: 5000,
    supplierCode: "SIGMA",
    manufacturer: "Sigma-Aldrich",
    storageCondition: "Room Temp (15-25C)",
    defaultLocation: "Staining Bench shelf 2",
    trackExpiry: true,
    batches: [
      { batchNo: "LSH982", quantityBase: 2000, costPerBaseUnit: 1.2, location: "Staining Bench shelf 2", expiryDateOffsetDays: 180 }
    ]
  },
  {
    itemCode: "EDTATUBE",
    name: "EDTA K3 Vacuum Tubes (Lavender)",
    genericName: "EDTATUBE",
    categoryCode: "TUBE",
    itemType: "consumable",
    baseUomSymbol: "each",
    purchaseUomSymbol: "box100",
    purchaseToBaseFactor: 100,
    conversionFactorUnit: "units",
    minimumStockBase: 100,
    reorderLevelBase: 200,
    maximumStockBase: 1000,
    supplierCode: "BDCO",
    manufacturer: "Becton Dickinson",
    storageCondition: "Room Temp (15-30C)",
    defaultLocation: "Phlebotomy Drawer 1",
    trackExpiry: true,
    batches: [
      { batchNo: "EDTA2026A", quantityBase: 300, costPerBaseUnit: 4.0, location: "Phlebotomy Drawer 1", expiryDateOffsetDays: 500 }
    ]
  },
  {
    itemCode: "SERUMTUBE",
    name: "Serum Clot Activator Tubes (Red)",
    genericName: "SERUMTUBE",
    categoryCode: "TUBE",
    itemType: "consumable",
    baseUomSymbol: "each",
    purchaseUomSymbol: "box100",
    purchaseToBaseFactor: 100,
    conversionFactorUnit: "units",
    minimumStockBase: 100,
    reorderLevelBase: 200,
    maximumStockBase: 1000,
    supplierCode: "BDCO",
    manufacturer: "Becton Dickinson",
    storageCondition: "Room Temp (15-30C)",
    defaultLocation: "Phlebotomy Drawer 1",
    trackExpiry: true,
    batches: [
      { batchNo: "SER2026A", quantityBase: 300, costPerBaseUnit: 4.5, location: "Phlebotomy Drawer 1", expiryDateOffsetDays: 500 }
    ]
  },
  {
    itemCode: "SYRINGE5ML",
    name: "Disposable Syringes 5ml with Needle",
    genericName: "SYRINGE",
    categoryCode: "CONSUMABLE",
    itemType: "consumable",
    baseUomSymbol: "each",
    purchaseUomSymbol: "box100",
    purchaseToBaseFactor: 100,
    conversionFactorUnit: "units",
    minimumStockBase: 200,
    reorderLevelBase: 400,
    maximumStockBase: 2000,
    supplierCode: "BDCO",
    manufacturer: "Becton Dickinson",
    storageCondition: "Room Temp (15-30C)",
    defaultLocation: "Phlebotomy Shelf A",
    trackExpiry: true,
    batches: [
      { batchNo: "SYR05A", quantityBase: 500, costPerBaseUnit: 2.5, location: "Phlebotomy Shelf A", expiryDateOffsetDays: 600 }
    ]
  },
  {
    itemCode: "DENGUEKIT",
    name: "Dengue NS1 Antigen Rapid Test Kits",
    genericName: "DENGUEKIT",
    categoryCode: "KIT",
    itemType: "reagent",
    baseUomSymbol: "each",
    purchaseUomSymbol: "box50",
    purchaseToBaseFactor: 50,
    conversionFactorUnit: "units",
    minimumStockBase: 50,
    reorderLevelBase: 100,
    maximumStockBase: 500,
    supplierCode: "ABBOTT",
    manufacturer: "Abbott Labs",
    storageCondition: "Refrigerate (2-8C)",
    defaultLocation: "Cold Room Fridge B",
    trackExpiry: true,
    batches: [
      { batchNo: "DNG902A", quantityBase: 150, costPerBaseUnit: 120.0, location: "Cold Room Fridge B", expiryDateOffsetDays: 300 }
    ]
  },
  {
    itemCode: "URINESTRIP",
    name: "Urine Reagent Strips 10 Parameter",
    genericName: "URINESTRIP",
    categoryCode: "KIT",
    itemType: "reagent",
    baseUomSymbol: "each",
    purchaseUomSymbol: "box100",
    purchaseToBaseFactor: 100,
    conversionFactorUnit: "units",
    minimumStockBase: 100,
    reorderLevelBase: 200,
    maximumStockBase: 1000,
    supplierCode: "ROCHE",
    manufacturer: "Roche Diagnostics",
    storageCondition: "Room Temp (15-30C)",
    defaultLocation: "Biochemistry shelf 1",
    trackExpiry: true,
    batches: [
      { batchNo: "URN401", quantityBase: 400, costPerBaseUnit: 15.0, location: "Biochemistry shelf 1", expiryDateOffsetDays: 240 }
    ]
  },
  {
    itemCode: "GLOVESM",
    name: "Nitrile Examination Gloves (Medium)",
    genericName: "GLOVES",
    categoryCode: "PPE",
    itemType: "consumable",
    baseUomSymbol: "each",
    purchaseUomSymbol: "box100",
    purchaseToBaseFactor: 100,
    conversionFactorUnit: "units",
    minimumStockBase: 200,
    reorderLevelBase: 400,
    maximumStockBase: 2000,
    supplierCode: "THERMO",
    manufacturer: "Thermo Fisher",
    storageCondition: "Room Temp",
    defaultLocation: "Store Room A",
    trackExpiry: false,
    batches: [
      { batchNo: "GLVM01", quantityBase: 800, costPerBaseUnit: 3.0, location: "Store Room A", expiryDateOffsetDays: 1000 }
    ]
  },
  {
    itemCode: "SLIDES",
    name: "Microscope Glass Slides Plain",
    genericName: "SLIDES",
    categoryCode: "GLASS",
    itemType: "consumable",
    baseUomSymbol: "each",
    purchaseUomSymbol: "box50",
    purchaseToBaseFactor: 50,
    conversionFactorUnit: "units",
    minimumStockBase: 50,
    reorderLevelBase: 100,
    maximumStockBase: 1000,
    supplierCode: "THERMO",
    manufacturer: "Thermo Fisher",
    storageCondition: "Room Temp",
    defaultLocation: "Hematology Bench Shelf 1",
    trackExpiry: false,
    batches: [
      { batchNo: "SLD50A", quantityBase: 250, costPerBaseUnit: 1.0, location: "Hematology Bench Shelf 1", expiryDateOffsetDays: 1500 }
    ]
  },
  {
    itemCode: "HIVKIT",
    name: "HIV 1 and 2 Rapid Test Kits",
    genericName: "HIVKIT",
    categoryCode: "KIT",
    itemType: "reagent",
    baseUomSymbol: "each",
    purchaseUomSymbol: "box50",
    purchaseToBaseFactor: 50,
    conversionFactorUnit: "units",
    minimumStockBase: 30,
    reorderLevelBase: 60,
    maximumStockBase: 300,
    supplierCode: "ABBOTT",
    manufacturer: "Abbott Labs",
    storageCondition: "Refrigerate (2-8C)",
    defaultLocation: "Cold Room Fridge B",
    trackExpiry: true,
    batches: [
      { batchNo: "HIV604B", quantityBase: 100, costPerBaseUnit: 110.0, location: "Cold Room Fridge B", expiryDateOffsetDays: 300 }
    ]
  },
  {
    itemCode: "HCVKIT",
    name: "HCV Rapid Test Kits",
    genericName: "HCVKIT",
    categoryCode: "KIT",
    itemType: "reagent",
    baseUomSymbol: "each",
    purchaseUomSymbol: "box50",
    purchaseToBaseFactor: 50,
    conversionFactorUnit: "units",
    minimumStockBase: 30,
    reorderLevelBase: 60,
    maximumStockBase: 300,
    supplierCode: "ABBOTT",
    manufacturer: "Abbott Labs",
    storageCondition: "Refrigerate (2-8C)",
    defaultLocation: "Cold Room Fridge B",
    trackExpiry: true,
    batches: [
      { batchNo: "HCV502", quantityBase: 100, costPerBaseUnit: 115.0, location: "Cold Room Fridge B", expiryDateOffsetDays: 300 }
    ]
  },
  {
    itemCode: "HBSAGKIT",
    name: "HBsAg Rapid Test Kits",
    genericName: "HBSAGKIT",
    categoryCode: "KIT",
    itemType: "reagent",
    baseUomSymbol: "each",
    purchaseUomSymbol: "box50",
    purchaseToBaseFactor: 50,
    conversionFactorUnit: "units",
    minimumStockBase: 30,
    reorderLevelBase: 60,
    maximumStockBase: 300,
    supplierCode: "ABBOTT",
    manufacturer: "Abbott Labs",
    storageCondition: "Refrigerate (2-8C)",
    defaultLocation: "Cold Room Fridge B",
    trackExpiry: true,
    batches: [
      { batchNo: "HBS101", quantityBase: 100, costPerBaseUnit: 90.0, location: "Cold Room Fridge B", expiryDateOffsetDays: 300 }
    ]
  },
  {
    itemCode: "WIDALKIT",
    name: "Widal Agglutination Slide Test Kits",
    genericName: "WIDALKIT",
    categoryCode: "KIT",
    itemType: "reagent",
    baseUomSymbol: "each",
    purchaseUomSymbol: "box50",
    purchaseToBaseFactor: 50,
    conversionFactorUnit: "units",
    minimumStockBase: 50,
    reorderLevelBase: 100,
    maximumStockBase: 400,
    supplierCode: "ROCHE",
    manufacturer: "Roche Diagnostics",
    storageCondition: "Refrigerate (2-8C)",
    defaultLocation: "Cold Room Fridge B",
    trackExpiry: true,
    batches: [
      { batchNo: "WDL77A", quantityBase: 150, costPerBaseUnit: 80.0, location: "Cold Room Fridge B", expiryDateOffsetDays: 200 }
    ]
  },
  {
    itemCode: "LANCETS",
    name: "Disposable Sterile Blood Lancets",
    genericName: "LANCET",
    categoryCode: "CONSUMABLE",
    itemType: "consumable",
    baseUomSymbol: "each",
    purchaseUomSymbol: "box100",
    purchaseToBaseFactor: 100,
    conversionFactorUnit: "units",
    minimumStockBase: 200,
    reorderLevelBase: 500,
    maximumStockBase: 5000,
    supplierCode: "BDCO",
    manufacturer: "Becton Dickinson",
    storageCondition: "Room Temp",
    defaultLocation: "Phlebotomy Drawer 2",
    trackExpiry: false,
    batches: [
      { batchNo: "LNC2026", quantityBase: 1000, costPerBaseUnit: 0.8, location: "Phlebotomy Drawer 2", expiryDateOffsetDays: 1000 }
    ]
  },
  {
    itemCode: "PREGKIT",
    name: "Urine Pregnancy Test Strip Kits (hCG)",
    genericName: "PREGKIT",
    categoryCode: "KIT",
    itemType: "reagent",
    baseUomSymbol: "each",
    purchaseUomSymbol: "box50",
    purchaseToBaseFactor: 50,
    conversionFactorUnit: "units",
    minimumStockBase: 50,
    reorderLevelBase: 100,
    maximumStockBase: 1000,
    supplierCode: "ROCHE",
    manufacturer: "Roche Diagnostics",
    storageCondition: "Room Temp",
    defaultLocation: "Pathology Bench Shelf",
    trackExpiry: true,
    batches: [
      { batchNo: "PRG001", quantityBase: 200, costPerBaseUnit: 15.0, location: "Pathology Bench Shelf", expiryDateOffsetDays: 365 }
    ]
  }
];

export async function seedDefaultInventory(connection) {
  const InventoryUom = getInventoryUomModel(connection);
  const InventoryCategory = getInventoryCategoryModel(connection);
  const InventorySupplier = getInventorySupplierModel(connection);
  const InventoryItem = getInventoryItemModel(connection);

  // 1. Seed UOMs
  const uomMap = new Map();
  for (const uom of uomsData) {
    let uomDoc = await InventoryUom.findOne({ name: uom.name });
    if (!uomDoc) {
      uomDoc = await InventoryUom.create(uom);
    }
    uomMap.set(uom.symbol, uomDoc._id);
  }

  // 2. Seed Categories
  const categoryMap = new Map();
  for (const cat of categoriesData) {
    let catDoc = await InventoryCategory.findOne({ code: cat.code });
    if (!catDoc) {
      catDoc = await InventoryCategory.create(cat);
    }
    categoryMap.set(cat.code, catDoc._id);
  }

  // 3. Seed Suppliers
  const supplierMap = new Map();
  for (const sup of suppliersData) {
    let supDoc = await InventorySupplier.findOne({ code: sup.code });
    if (!supDoc) {
      supDoc = await InventorySupplier.create(sup);
    }
    supplierMap.set(sup.code, supDoc._id);
  }

  // 4. Seed Items & Batches
  let itemsSeeded = 0;
  for (const item of itemsData) {
    const existingItem = await InventoryItem.findOne({ itemCode: item.itemCode });
    if (!existingItem) {
      const categoryId = categoryMap.get(item.categoryCode);
      const baseUomId = uomMap.get(item.baseUomSymbol);
      const purchaseUomId = uomMap.get(item.purchaseUomSymbol);
      const supplierId = supplierMap.get(item.supplierCode);

      if (!categoryId || !baseUomId || !purchaseUomId) {
        continue; // skip if dependencies are somehow missing
      }

      // Calculate total stock on hand from batches
      const stockOnHandBase = item.batches.reduce((sum, b) => sum + b.quantityBase, 0);

      const formattedBatches = item.batches.map(b => {
        const receivedDate = new Date();
        const expiryDate = new Date();
        expiryDate.setDate(receivedDate.getDate() + (b.expiryDateOffsetDays || 365));

        return {
          batchNo: b.batchNo,
          supplier: item.manufacturer,
          supplierRef: supplierId || null,
          receivedDate,
          expiryDate,
          quantityBase: b.quantityBase,
          costPerBaseUnit: b.costPerBaseUnit,
          location: b.location,
          status: "available",
        };
      });

      const newItem = await InventoryItem.create({
        itemCode: item.itemCode,
        name: item.name,
        genericName: item.genericName,
        category: categoryId,
        itemType: item.itemType,
        baseUom: baseUomId,
        purchaseUom: purchaseUomId,
        purchaseToBaseFactor: item.purchaseToBaseFactor,
        conversionFactorUnit: item.conversionFactorUnit,
        stockOnHandBase,
        minimumStockBase: item.minimumStockBase,
        reorderLevelBase: item.reorderLevelBase,
        maximumStockBase: item.maximumStockBase,
        preferredSupplierRef: supplierId || null,
        manufacturer: item.manufacturer,
        storageCondition: item.storageCondition,
        defaultLocation: item.defaultLocation,
        trackExpiry: item.trackExpiry,
        status: "active",
        batches: formattedBatches,
      });

      // Link item to supplier
      if (supplierId) {
        await InventorySupplier.findByIdAndUpdate(supplierId, {
          $addToSet: { items: newItem._id }
        });
      }

      itemsSeeded++;
    }
  }

  return {
    uomsSeeded: uomsData.length,
    categoriesSeeded: categoriesData.length,
    suppliersSeeded: suppliersData.length,
    itemsSeeded,
  };
}
