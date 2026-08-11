import { getInventoryUomModel } from "../models/tenant/InventoryUom.js";
import { getInventoryCategoryModel } from "../models/tenant/InventoryCategory.js";
import { getInventorySupplierModel } from "../models/tenant/InventorySupplier.js";
import { getInventoryItemModel } from "../models/tenant/InventoryItem.js";
import { mapInBatches } from "./seeder-utils.js";

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
  },
  {
    itemCode: "METHANOL",
    name: "Methyl Alcohol 99% (Methanol)",
    genericName: "METHANOL",
    categoryCode: "REAGENT",
    itemType: "reagent",
    baseUomSymbol: "mL",
    purchaseUomSymbol: "L",
    purchaseToBaseFactor: 1000,
    conversionFactorUnit: "ml",
    minimumStockBase: 1000,
    reorderLevelBase: 2000,
    maximumStockBase: 5000,
    supplierCode: "SIGMA",
    manufacturer: "Sigma-Aldrich",
    storageCondition: "Room Temp (15-25C)",
    defaultLocation: "Flammable Cabinet A",
    trackExpiry: true,
    batches: [
      { batchNo: "MTH001", quantityBase: 2000, costPerBaseUnit: 0.45, location: "Flammable Cabinet A", expiryDateOffsetDays: 365 }
    ]
  },
  {
    itemCode: "FORMALIN",
    name: "Formaldehyde Solution 10%",
    genericName: "FORMALIN",
    categoryCode: "REAGENT",
    itemType: "reagent",
    baseUomSymbol: "mL",
    purchaseUomSymbol: "L",
    purchaseToBaseFactor: 1000,
    conversionFactorUnit: "ml",
    minimumStockBase: 1000,
    reorderLevelBase: 2000,
    maximumStockBase: 5000,
    supplierCode: "SIGMA",
    manufacturer: "Sigma-Aldrich",
    storageCondition: "Room Temp (15-25C)",
    defaultLocation: "Chemical Shelf C",
    trackExpiry: true,
    batches: [
      { batchNo: "FML001", quantityBase: 2000, costPerBaseUnit: 0.6, location: "Chemical Shelf C", expiryDateOffsetDays: 730 }
    ]
  },
  {
    itemCode: "GLUCOSESTRIP",
    name: "Blood Glucose Test Strips",
    genericName: "GLUCOSESTRIP",
    categoryCode: "KIT",
    itemType: "reagent",
    baseUomSymbol: "each",
    purchaseUomSymbol: "box50",
    purchaseToBaseFactor: 50,
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
      { batchNo: "GLC001", quantityBase: 300, costPerBaseUnit: 12.0, location: "Biochemistry shelf 1", expiryDateOffsetDays: 365 }
    ]
  },
  {
    itemCode: "SYRINGE2ML",
    name: "Disposable Syringes 2ml with Needle",
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
      { batchNo: "SYR02A", quantityBase: 500, costPerBaseUnit: 2.2, location: "Phlebotomy Shelf A", expiryDateOffsetDays: 600 }
    ]
  },
  {
    itemCode: "SYRINGE10ML",
    name: "Disposable Syringes 10ml with Needle",
    genericName: "SYRINGE",
    categoryCode: "CONSUMABLE",
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
    defaultLocation: "Phlebotomy Shelf A",
    trackExpiry: true,
    batches: [
      { batchNo: "SYR10A", quantityBase: 300, costPerBaseUnit: 3.5, location: "Phlebotomy Shelf A", expiryDateOffsetDays: 600 }
    ]
  },
  {
    itemCode: "HEPARINTUBE",
    name: "Lithium Heparin Tubes (Green)",
    genericName: "HEPARINTUBE",
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
      { batchNo: "HEP2026A", quantityBase: 200, costPerBaseUnit: 4.8, location: "Phlebotomy Drawer 1", expiryDateOffsetDays: 500 }
    ]
  },
  {
    itemCode: "CITRATETUBE",
    name: "Sodium Citrate Tubes (Blue)",
    genericName: "CITRATETUBE",
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
      { batchNo: "CIT2026A", quantityBase: 200, costPerBaseUnit: 4.6, location: "Phlebotomy Drawer 1", expiryDateOffsetDays: 500 }
    ]
  },
  {
    itemCode: "FLUORIDETUBE",
    name: "Sodium Fluoride Tubes (Grey)",
    genericName: "FLUORIDETUBE",
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
      { batchNo: "FLR2026A", quantityBase: 300, costPerBaseUnit: 4.2, location: "Phlebotomy Drawer 1", expiryDateOffsetDays: 500 }
    ]
  },
  {
    itemCode: "COTTONROLL",
    name: "Absorbent Cotton Roll 500g",
    genericName: "COTTONROLL",
    categoryCode: "CONSUMABLE",
    itemType: "consumable",
    baseUomSymbol: "each",
    purchaseUomSymbol: "each",
    purchaseToBaseFactor: 1,
    conversionFactorUnit: "units",
    minimumStockBase: 10,
    reorderLevelBase: 20,
    maximumStockBase: 100,
    supplierCode: "THERMO",
    manufacturer: "Thermo Fisher",
    storageCondition: "Dry Room",
    defaultLocation: "Store Room A",
    trackExpiry: false,
    batches: [
      { batchNo: "CTN01", quantityBase: 40, costPerBaseUnit: 120.0, location: "Store Room A", expiryDateOffsetDays: 1000 }
    ]
  },
  {
    itemCode: "BANDAGE",
    name: "Adhesive Bandages (Band-aids)",
    genericName: "BANDAGE",
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
    storageCondition: "Room Temp",
    defaultLocation: "Phlebotomy Desk",
    trackExpiry: false,
    batches: [
      { batchNo: "BND01", quantityBase: 800, costPerBaseUnit: 0.5, location: "Phlebotomy Desk", expiryDateOffsetDays: 1000 }
    ]
  },
  {
    itemCode: "ALCOHOLSWAB",
    name: "Isopropyl Alcohol Prep Pads",
    genericName: "ALCOHOLSWAB",
    categoryCode: "CONSUMABLE",
    itemType: "consumable",
    baseUomSymbol: "each",
    purchaseUomSymbol: "box100",
    purchaseToBaseFactor: 100,
    conversionFactorUnit: "units",
    minimumStockBase: 500,
    reorderLevelBase: 1000,
    maximumStockBase: 5000,
    supplierCode: "BDCO",
    manufacturer: "Becton Dickinson",
    storageCondition: "Room Temp",
    defaultLocation: "Phlebotomy Desk",
    trackExpiry: true,
    batches: [
      { batchNo: "SWB01", quantityBase: 2000, costPerBaseUnit: 1.1, location: "Phlebotomy Desk", expiryDateOffsetDays: 730 }
    ]
  },
  {
    itemCode: "GLOVESL",
    name: "Nitrile Examination Gloves (Large)",
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
      { batchNo: "GLVL01", quantityBase: 600, costPerBaseUnit: 3.2, location: "Store Room A", expiryDateOffsetDays: 1000 }
    ]
  },
  {
    itemCode: "GLOVESS",
    name: "Nitrile Examination Gloves (Small)",
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
      { batchNo: "GLVS01", quantityBase: 600, costPerBaseUnit: 3.1, location: "Store Room A", expiryDateOffsetDays: 1000 }
    ]
  },
  {
    itemCode: "MASKS",
    name: "3-Ply Disposable Surgical Face Masks",
    genericName: "MASKS",
    categoryCode: "PPE",
    itemType: "consumable",
    baseUomSymbol: "each",
    purchaseUomSymbol: "box50",
    purchaseToBaseFactor: 50,
    conversionFactorUnit: "units",
    minimumStockBase: 100,
    reorderLevelBase: 200,
    maximumStockBase: 1000,
    supplierCode: "THERMO",
    manufacturer: "Thermo Fisher",
    storageCondition: "Room Temp",
    defaultLocation: "Store Room A",
    trackExpiry: false,
    batches: [
      { batchNo: "MSK01", quantityBase: 400, costPerBaseUnit: 1.5, location: "Store Room A", expiryDateOffsetDays: 1500 }
    ]
  },
  {
    itemCode: "APRON",
    name: "Disposable Plastic Aprons",
    genericName: "APRON",
    categoryCode: "PPE",
    itemType: "consumable",
    baseUomSymbol: "each",
    purchaseUomSymbol: "box100",
    purchaseToBaseFactor: 100,
    conversionFactorUnit: "units",
    minimumStockBase: 100,
    reorderLevelBase: 200,
    maximumStockBase: 1000,
    supplierCode: "THERMO",
    manufacturer: "Thermo Fisher",
    storageCondition: "Room Temp",
    defaultLocation: "Store Room A",
    trackExpiry: false,
    batches: [
      { batchNo: "APR01", quantityBase: 300, costPerBaseUnit: 6.0, location: "Store Room A", expiryDateOffsetDays: 1500 }
    ]
  },
  {
    itemCode: "COVERSLIPS",
    name: "Glass Microscope Cover Slips 22x22mm",
    genericName: "COVERSLIPS",
    categoryCode: "GLASS",
    itemType: "consumable",
    baseUomSymbol: "each",
    purchaseUomSymbol: "box100",
    purchaseToBaseFactor: 100,
    conversionFactorUnit: "units",
    minimumStockBase: 100,
    reorderLevelBase: 200,
    maximumStockBase: 1000,
    supplierCode: "THERMO",
    manufacturer: "Thermo Fisher",
    storageCondition: "Room Temp",
    defaultLocation: "Pathology Shelf B",
    trackExpiry: false,
    batches: [
      { batchNo: "COV01", quantityBase: 500, costPerBaseUnit: 0.8, location: "Pathology Shelf B", expiryDateOffsetDays: 2000 }
    ]
  },
  {
    itemCode: "PIPETTE1ML",
    name: "Graduated Plastic Transfer Pipettes 1ml",
    genericName: "PIPETTE",
    categoryCode: "GLASS",
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
    defaultLocation: "Lab Desk Drawer 2",
    trackExpiry: false,
    batches: [
      { batchNo: "PIP1M01", quantityBase: 800, costPerBaseUnit: 0.6, location: "Lab Desk Drawer 2", expiryDateOffsetDays: 2000 }
    ]
  },
  {
    itemCode: "PIPETTE3ML",
    name: "Graduated Plastic Transfer Pipettes 3ml",
    genericName: "PIPETTE",
    categoryCode: "GLASS",
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
    defaultLocation: "Lab Desk Drawer 2",
    trackExpiry: false,
    batches: [
      { batchNo: "PIP3M01", quantityBase: 800, costPerBaseUnit: 0.7, location: "Lab Desk Drawer 2", expiryDateOffsetDays: 2000 }
    ]
  },
  {
    itemCode: "CENTRIFUGETUBE",
    name: "Centrifuge Tubes 15ml Conical Plastic",
    genericName: "CENTRIFUGETUBE",
    categoryCode: "GLASS",
    itemType: "consumable",
    baseUomSymbol: "each",
    purchaseUomSymbol: "box50",
    purchaseToBaseFactor: 50,
    conversionFactorUnit: "units",
    minimumStockBase: 100,
    reorderLevelBase: 200,
    maximumStockBase: 1000,
    supplierCode: "THERMO",
    manufacturer: "Thermo Fisher",
    storageCondition: "Room Temp",
    defaultLocation: "Centrifuge Shelf B",
    trackExpiry: false,
    batches: [
      { batchNo: "CNT15M", quantityBase: 300, costPerBaseUnit: 4.5, location: "Centrifuge Shelf B", expiryDateOffsetDays: 1500 }
    ]
  },
  {
    itemCode: "BEAKER250ML",
    name: "Borosilicate Glass Beaker 250ml",
    genericName: "BEAKER",
    categoryCode: "GLASS",
    itemType: "consumable",
    baseUomSymbol: "each",
    purchaseUomSymbol: "each",
    purchaseToBaseFactor: 1,
    conversionFactorUnit: "units",
    minimumStockBase: 5,
    reorderLevelBase: 10,
    maximumStockBase: 50,
    supplierCode: "THERMO",
    manufacturer: "Thermo Fisher",
    storageCondition: "Room Temp",
    defaultLocation: "Glassware Shelf A",
    trackExpiry: false,
    batches: [
      { batchNo: "BKR250", quantityBase: 15, costPerBaseUnit: 95.0, location: "Glassware Shelf A", expiryDateOffsetDays: 5000 }
    ]
  },
  {
    itemCode: "TYPHOIDKIT",
    name: "Typhoid IgG/IgM Rapid Test Kits",
    genericName: "TYPHOIDKIT",
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
      { batchNo: "TYP01", quantityBase: 100, costPerBaseUnit: 75.0, location: "Cold Room Fridge B", expiryDateOffsetDays: 300 }
    ]
  },
  {
    itemCode: "MALARIAKIT",
    name: "Malaria Ag Pf/Pv Rapid Test Kits",
    genericName: "MALARIAKIT",
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
      { batchNo: "MAL01", quantityBase: 150, costPerBaseUnit: 85.0, location: "Cold Room Fridge B", expiryDateOffsetDays: 300 }
    ]
  },
  {
    itemCode: "SYPHILISKIT",
    name: "Syphilis Rapid Test Kits",
    genericName: "SYPHILISKIT",
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
      { batchNo: "SYP01", quantityBase: 100, costPerBaseUnit: 65.0, location: "Cold Room Fridge B", expiryDateOffsetDays: 300 }
    ]
  },
  {
    itemCode: "URINECUP",
    name: "Sterile Urine Specimen Collection Cups",
    genericName: "URINECUP",
    categoryCode: "CONSUMABLE",
    itemType: "consumable",
    baseUomSymbol: "each",
    purchaseUomSymbol: "box100",
    purchaseToBaseFactor: 100,
    conversionFactorUnit: "units",
    minimumStockBase: 100,
    reorderLevelBase: 250,
    maximumStockBase: 1000,
    supplierCode: "BDCO",
    manufacturer: "Becton Dickinson",
    storageCondition: "Room Temp",
    defaultLocation: "Phlebotomy Desk B",
    trackExpiry: false,
    batches: [
      { batchNo: "URNCP01", quantityBase: 400, costPerBaseUnit: 5.5, location: "Phlebotomy Desk B", expiryDateOffsetDays: 1000 }
    ]
  },
  {
    itemCode: "STOOLCONTAINER",
    name: "Sterile Stool Specimen Containers",
    genericName: "STOOLCONTAINER",
    categoryCode: "CONSUMABLE",
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
    storageCondition: "Room Temp",
    defaultLocation: "Phlebotomy Desk B",
    trackExpiry: false,
    batches: [
      { batchNo: "STLCN01", quantityBase: 300, costPerBaseUnit: 6.0, location: "Phlebotomy Desk B", expiryDateOffsetDays: 1000 }
    ]
  },
  {
    itemCode: "TOURNIQUET",
    name: "Elastic Phlebotomy Tourniquet Bands",
    genericName: "TOURNIQUET",
    categoryCode: "CONSUMABLE",
    itemType: "consumable",
    baseUomSymbol: "each",
    purchaseUomSymbol: "box10",
    purchaseToBaseFactor: 10,
    conversionFactorUnit: "units",
    minimumStockBase: 10,
    reorderLevelBase: 20,
    maximumStockBase: 100,
    supplierCode: "BDCO",
    manufacturer: "Becton Dickinson",
    storageCondition: "Room Temp",
    defaultLocation: "Phlebotomy Drawers",
    trackExpiry: false,
    batches: [
      { batchNo: "TRN01", quantityBase: 30, costPerBaseUnit: 35.0, location: "Phlebotomy Drawers", expiryDateOffsetDays: 3000 }
    ]
  },
  {
    itemCode: "DISTILLEDWATER",
    name: "Laboratory Grade Distilled Water 5L",
    genericName: "DISTILLEDWATER",
    categoryCode: "REAGENT",
    itemType: "reagent",
    baseUomSymbol: "mL",
    purchaseUomSymbol: "L",
    purchaseToBaseFactor: 1000,
    conversionFactorUnit: "ml",
    minimumStockBase: 5000,
    reorderLevelBase: 10000,
    maximumStockBase: 50000,
    supplierCode: "SIGMA",
    manufacturer: "Sigma-Aldrich",
    storageCondition: "Room Temp",
    defaultLocation: "Preparation Lab Shelf A",
    trackExpiry: false,
    batches: [
      { batchNo: "DSTW01", quantityBase: 20000, costPerBaseUnit: 0.05, location: "Preparation Lab Shelf A", expiryDateOffsetDays: 1000 }
    ]
  },
  {
    itemCode: "GIEMSASAIN",
    name: "Giemsa Stain Solution",
    genericName: "GIEMSASAIN",
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
    storageCondition: "Room Temp",
    defaultLocation: "Hematology Lab Shelf B",
    trackExpiry: true,
    batches: [
      { batchNo: "GMS01", quantityBase: 1000, costPerBaseUnit: 1.8, location: "Hematology Lab Shelf B", expiryDateOffsetDays: 365 }
    ]
  },
  {
    itemCode: "HCLREAGENT",
    name: "Hydrochloric Acid 0.1 N",
    genericName: "HCLREAGENT",
    categoryCode: "REAGENT",
    itemType: "reagent",
    baseUomSymbol: "mL",
    purchaseUomSymbol: "L",
    purchaseToBaseFactor: 1000,
    conversionFactorUnit: "ml",
    minimumStockBase: 1000,
    reorderLevelBase: 2000,
    maximumStockBase: 10000,
    supplierCode: "SIGMA",
    manufacturer: "Sigma-Aldrich",
    storageCondition: "Room Temp",
    defaultLocation: "Acid cabinet B",
    trackExpiry: false,
    batches: [
      { batchNo: "HCL001", quantityBase: 4000, costPerBaseUnit: 0.35, location: "Acid cabinet B", expiryDateOffsetDays: 2000 }
    ]
  },
  {
    itemCode: "SODIUMHYDROXIDE",
    name: "Sodium Hydroxide 0.1 N",
    genericName: "SODIUMHYDROXIDE",
    categoryCode: "REAGENT",
    itemType: "reagent",
    baseUomSymbol: "mL",
    purchaseUomSymbol: "L",
    purchaseToBaseFactor: 1000,
    conversionFactorUnit: "ml",
    minimumStockBase: 1000,
    reorderLevelBase: 2000,
    maximumStockBase: 10000,
    supplierCode: "SIGMA",
    manufacturer: "Sigma-Aldrich",
    storageCondition: "Room Temp",
    defaultLocation: "Chemical cabinet C",
    trackExpiry: false,
    batches: [
      { batchNo: "SOH001", quantityBase: 4000, costPerBaseUnit: 0.35, location: "Chemical cabinet C", expiryDateOffsetDays: 2000 }
    ]
  },
  {
    itemCode: "BLOODAGAR",
    name: "Prepared Blood Agar Plates",
    genericName: "BLOODAGAR",
    categoryCode: "KIT",
    itemType: "reagent",
    baseUomSymbol: "each",
    purchaseUomSymbol: "box50",
    purchaseToBaseFactor: 50,
    conversionFactorUnit: "units",
    minimumStockBase: 20,
    reorderLevelBase: 50,
    maximumStockBase: 200,
    supplierCode: "THERMO",
    manufacturer: "Oxoid",
    storageCondition: "Refrigerate (2-8C)",
    defaultLocation: "Microbiology Fridge A",
    trackExpiry: true,
    batches: [
      { batchNo: "BAGR01", quantityBase: 100, costPerBaseUnit: 35.0, location: "Microbiology Fridge A", expiryDateOffsetDays: 60 }
    ]
  },
  {
    itemCode: "MACCONKEYAGAR",
    name: "Prepared MacConkey Agar Plates",
    genericName: "MACCONKEYAGAR",
    categoryCode: "KIT",
    itemType: "reagent",
    baseUomSymbol: "each",
    purchaseUomSymbol: "box50",
    purchaseToBaseFactor: 50,
    conversionFactorUnit: "units",
    minimumStockBase: 20,
    reorderLevelBase: 50,
    maximumStockBase: 200,
    supplierCode: "THERMO",
    manufacturer: "Oxoid",
    storageCondition: "Refrigerate (2-8C)",
    defaultLocation: "Microbiology Fridge A",
    trackExpiry: true,
    batches: [
      { batchNo: "MCAGR01", quantityBase: 100, costPerBaseUnit: 30.0, location: "Microbiology Fridge A", expiryDateOffsetDays: 60 }
    ]
  },
  {
    itemCode: "ESRPIPETTE",
    name: "Westergren ESR Pipettes",
    genericName: "ESRPIPETTE",
    categoryCode: "GLASS",
    itemType: "consumable",
    baseUomSymbol: "each",
    purchaseUomSymbol: "box100",
    purchaseToBaseFactor: 100,
    conversionFactorUnit: "units",
    minimumStockBase: 50,
    reorderLevelBase: 100,
    maximumStockBase: 500,
    supplierCode: "THERMO",
    manufacturer: "Thermo Fisher",
    storageCondition: "Room Temp",
    defaultLocation: "Hematology Bench Shelf",
    trackExpiry: false,
    batches: [
      { batchNo: "ESRP01", quantityBase: 200, costPerBaseUnit: 6.5, location: "Hematology Bench Shelf", expiryDateOffsetDays: 2000 }
    ]
  },
  {
    itemCode: "SHARPSCONTAINER",
    name: "Biohazard Sharps Disposal Container 5L",
    genericName: "SHARPSCONTAINER",
    categoryCode: "CONSUMABLE",
    itemType: "consumable",
    baseUomSymbol: "each",
    purchaseUomSymbol: "each",
    purchaseToBaseFactor: 1,
    conversionFactorUnit: "units",
    minimumStockBase: 5,
    reorderLevelBase: 10,
    maximumStockBase: 50,
    supplierCode: "BDCO",
    manufacturer: "Becton Dickinson",
    storageCondition: "Room Temp",
    defaultLocation: "Waste Disposal Station A",
    trackExpiry: false,
    batches: [
      { batchNo: "SHRP01", quantityBase: 20, costPerBaseUnit: 320.0, location: "Waste Disposal Station A", expiryDateOffsetDays: 3000 }
    ]
  },
  {
    itemCode: "SANITISER",
    name: "Isopropyl Alcohol Hand Sanitiser 500ml",
    genericName: "SANITISER",
    categoryCode: "PPE",
    itemType: "consumable",
    baseUomSymbol: "each",
    purchaseUomSymbol: "each",
    purchaseToBaseFactor: 1,
    conversionFactorUnit: "units",
    minimumStockBase: 10,
    reorderLevelBase: 20,
    maximumStockBase: 100,
    supplierCode: "THERMO",
    manufacturer: "Thermo Fisher",
    storageCondition: "Room Temp",
    defaultLocation: "Phlebotomy Desk B",
    trackExpiry: false,
    batches: [
      { batchNo: "SNT01", quantityBase: 50, costPerBaseUnit: 110.0, location: "Phlebotomy Desk B", expiryDateOffsetDays: 1000 }
    ]
  }
];

export async function seedDefaultInventory(connection) {
  const InventoryUom = getInventoryUomModel(connection);
  const InventoryCategory = getInventoryCategoryModel(connection);
  const InventorySupplier = getInventorySupplierModel(connection);
  const InventoryItem = getInventoryItemModel(connection);

  const [existingUoms, existingCategories, existingSuppliers] = await Promise.all([
    InventoryUom.find({ name: { $in: uomsData.map((uom) => uom.name) } }),
    InventoryCategory.find({ code: { $in: categoriesData.map((category) => category.code) } }),
    InventorySupplier.find({ code: { $in: suppliersData.map((supplier) => supplier.code) } }),
  ]);
  const uomMap = new Map(existingUoms.map((uom) => [uom.symbol, uom._id]));
  const categoryMap = new Map(existingCategories.map((category) => [category.code, category._id]));
  const supplierMap = new Map(existingSuppliers.map((supplier) => [supplier.code, supplier._id]));

  const [createdUoms, createdCategories, createdSuppliers] = await Promise.all([
    mapInBatches(
      uomsData.filter((uom) => !existingUoms.some((existing) => existing.name === uom.name)),
      8,
      (uom) => InventoryUom.create(uom)
    ),
    mapInBatches(
      categoriesData.filter((category) => !categoryMap.has(category.code)),
      8,
      (category) => InventoryCategory.create(category)
    ),
    mapInBatches(
      suppliersData.filter((supplier) => !supplierMap.has(supplier.code)),
      8,
      (supplier) => InventorySupplier.create(supplier)
    ),
  ]);

  for (const uom of createdUoms) uomMap.set(uom.symbol, uom._id);
  for (const category of createdCategories) categoryMap.set(category.code, category._id);
  for (const supplier of createdSuppliers) supplierMap.set(supplier.code, supplier._id);

  const existingItems = await InventoryItem.find({
    itemCode: { $in: itemsData.map((item) => item.itemCode) },
  })
    .select("itemCode")
    .lean();
  const existingItemCodes = new Set(existingItems.map((item) => item.itemCode));
  const missingItems = itemsData.filter((item) => !existingItemCodes.has(item.itemCode));
  const createdItems = await mapInBatches(missingItems, 10, async (item) => {
      const categoryId = categoryMap.get(item.categoryCode);
      const baseUomId = uomMap.get(item.baseUomSymbol);
      const purchaseUomId = uomMap.get(item.purchaseUomSymbol);
      const supplierId = supplierMap.get(item.supplierCode);

      if (!categoryId || !baseUomId || !purchaseUomId) {
        return null;
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

      return { item: newItem, supplierId };
  });
  const createdItemLinks = createdItems.filter(Boolean);
  const itemsBySupplier = new Map();
  for (const { item, supplierId } of createdItemLinks) {
    if (!supplierId) continue;
    const key = String(supplierId);
    const supplierItems = itemsBySupplier.get(key) || [];
    supplierItems.push(item._id);
    itemsBySupplier.set(key, supplierItems);
  }
  if (itemsBySupplier.size > 0) {
    await InventorySupplier.bulkWrite(
      [...itemsBySupplier.entries()].map(([supplierId, itemIds]) => ({
        updateOne: {
          filter: { _id: supplierId },
          update: { $addToSet: { items: { $each: itemIds } } },
        },
      }))
    );
  }

  return {
    uomsSeeded: createdUoms.length,
    categoriesSeeded: createdCategories.length,
    suppliersSeeded: createdSuppliers.length,
    itemsSeeded: createdItemLinks.length,
  };
}

export async function hasAllDefaultInventory(connection) {
  const InventoryItem = getInventoryItemModel(connection);
  const defaultItemCodes = [...new Set(itemsData.map((item) => item.itemCode))];
  const existingCount = await InventoryItem.countDocuments({ itemCode: { $in: defaultItemCodes } });
  return existingCount === defaultItemCodes.length;
}
