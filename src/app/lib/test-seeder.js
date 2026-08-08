import { getTestCategoryModel } from "../models/tenant/TestCategory.js";
import { getTestDefinitionModel } from "../models/tenant/TestDefinition.js";

const categoriesData = [
  { name: "Hematology", description: "Studies blood cells and coagulation" },
  { name: "Biochemistry", description: "Measures chemical substances in blood and other fluids" },
  { name: "Endocrinology", description: "Hormone analysis and related dynamic function tests" },
  { name: "Serology & Immunology", description: "Evaluates antigen-antibody reactions and immune responses" },
  { name: "Clinical Pathology", description: "Microscopic and physical examination of fluids like urine/stool" },
  { name: "Tumour Markers", description: "Identifies biochemical substances associated with cancer" },
  { name: "Coagulation", description: "Assesses bleeding and blood clotting disorders" },
  { name: "Microbiology & Molecular", description: "Identifies infectious agents and DNA/RNA viral loads" },
];

const testsData = [
  // ==================== HEMATOLOGY ====================
  {
    categoryName: "Hematology",
    name: "Complete Blood Count",
    code: "CBC",
    sampleType: "Whole Blood",
    price: 350,
    parameters: [
      { name: "Hemoglobin", unit: "g/dL", normalMin: 12.0, normalMax: 16.0, maleMin: 13.5, maleMax: 17.5, femaleMin: 12.0, femaleMax: 15.5 },
      { name: "RBC Count", unit: "million/µL", normalMin: 4.0, normalMax: 5.5, maleMin: 4.5, maleMax: 5.9, femaleMin: 4.0, femaleMax: 5.2 },
      { name: "WBC Count", unit: "cells/µL", normalMin: 4000, normalMax: 11000 },
      { name: "Platelet Count", unit: "lakhs/µL", normalMin: 1.5, normalMax: 4.5 },
      { name: "Packed Cell Volume", unit: "%", normalMin: 36, normalMax: 48, maleMin: 40, maleMax: 50, femaleMin: 36, femaleMax: 46 },
      { name: "MCV", unit: "fL", normalMin: 80, normalMax: 100 },
      { name: "MCH", unit: "pg", normalMin: 27, normalMax: 32 },
      { name: "MCHC", unit: "g/dL", normalMin: 32, normalMax: 36 },
      { name: "RDW", unit: "%", normalMin: 11.5, normalMax: 14.5 }
    ]
  },
  {
    categoryName: "Hematology",
    name: "Hemoglobin Only",
    code: "HB",
    sampleType: "Whole Blood",
    price: 100,
    parameters: [
      { name: "Hemoglobin", unit: "g/dL", normalMin: 12.0, normalMax: 16.0, maleMin: 13.5, maleMax: 17.5, femaleMin: 12.0, femaleMax: 15.5 }
    ]
  },
  {
    categoryName: "Hematology",
    name: "Packed Cell Volume Test",
    code: "PCV",
    sampleType: "Whole Blood",
    price: 120,
    parameters: [
      { name: "PCV", unit: "%", normalMin: 36, normalMax: 48, maleMin: 40, maleMax: 50, femaleMin: 36, femaleMax: 46 }
    ]
  },
  {
    categoryName: "Hematology",
    name: "Total WBC Count",
    code: "WBC",
    sampleType: "Whole Blood",
    price: 120,
    parameters: [
      { name: "WBC Count", unit: "cells/µL", normalMin: 4000, normalMax: 11000 }
    ]
  },
  {
    categoryName: "Hematology",
    name: "Differential Leukocyte Count",
    code: "DLC",
    sampleType: "Whole Blood",
    price: 150,
    parameters: [
      { name: "Neutrophils", unit: "%", normalMin: 40, normalMax: 75 },
      { name: "Lymphocytes", unit: "%", normalMin: 20, normalMax: 45 },
      { name: "Eosinophils", unit: "%", normalMin: 1, normalMax: 6 },
      { name: "Monocytes", unit: "%", normalMin: 2, normalMax: 10 },
      { name: "Basophils", unit: "%", normalMin: 0, normalMax: 1 }
    ]
  },
  {
    categoryName: "Hematology",
    name: "Platelet Count Test",
    code: "PLT",
    sampleType: "Whole Blood",
    price: 150,
    parameters: [
      { name: "Platelet Count", unit: "lakhs/µL", normalMin: 1.5, normalMax: 4.5 }
    ]
  },
  {
    categoryName: "Hematology",
    name: "Erythrocyte Sedimentation Rate",
    code: "ESR",
    sampleType: "Whole Blood",
    price: 120,
    parameters: [
      { name: "ESR", unit: "mm/1st hr", normalMin: 0, normalMax: 20, maleMin: 0, maleMax: 15, femaleMin: 0, femaleMax: 20 }
    ]
  },
  {
    categoryName: "Hematology",
    name: "Absolute Eosinophil Count",
    code: "AEC",
    sampleType: "Whole Blood",
    price: 180,
    parameters: [
      { name: "AEC", unit: "cells/µL", normalMin: 40, normalMax: 440 }
    ]
  },
  {
    categoryName: "Hematology",
    name: "Absolute Neutrophil Count",
    code: "ANC",
    sampleType: "Whole Blood",
    price: 180,
    parameters: [
      { name: "ANC", unit: "cells/µL", normalMin: 2000, normalMax: 7000 }
    ]
  },
  {
    categoryName: "Hematology",
    name: "Absolute Lymphocyte Count",
    code: "ALC",
    sampleType: "Whole Blood",
    price: 180,
    parameters: [
      { name: "ALC", unit: "cells/µL", normalMin: 1000, normalMax: 4000 }
    ]
  },
  {
    categoryName: "Hematology",
    name: "Peripheral Blood Smear Study",
    code: "PBS",
    sampleType: "Whole Blood",
    price: 250,
    parameters: [
      { name: "RBC Morphology", unit: "status", normalMin: 0, normalMax: 0 },
      { name: "WBC Morphology", unit: "status", normalMin: 0, normalMax: 0 },
      { name: "Platelets Smear", unit: "status", normalMin: 0, normalMax: 0 }
    ]
  },
  {
    categoryName: "Hematology",
    name: "Reticulocyte Count",
    code: "RETIC",
    sampleType: "Whole Blood",
    price: 300,
    parameters: [
      { name: "Reticulocytes", unit: "%", normalMin: 0.5, normalMax: 2.5 }
    ]
  },
  {
    categoryName: "Hematology",
    name: "Blood Grouping & Rh Type",
    code: "BGRP",
    sampleType: "Whole Blood",
    price: 150,
    parameters: [
      { name: "Blood Group", unit: "type", normalMin: 0, normalMax: 0 },
      { name: "Rh Factor", unit: "type", normalMin: 0, normalMax: 0 }
    ]
  },
  {
    categoryName: "Hematology",
    name: "Direct Coombs Test",
    code: "COOMBSD",
    sampleType: "Whole Blood",
    price: 450,
    parameters: [
      { name: "Direct Coombs", unit: "status", normalMin: 0, normalMax: 0 }
    ]
  },
  {
    categoryName: "Hematology",
    name: "Indirect Coombs Test",
    code: "COOMBSI",
    sampleType: "Whole Blood",
    price: 500,
    parameters: [
      { name: "Indirect Coombs", unit: "status", normalMin: 0, normalMax: 0 }
    ]
  },
  {
    categoryName: "Hematology",
    name: "Bleeding & Clotting Time",
    code: "BTCT",
    sampleType: "Whole Blood",
    price: 200,
    parameters: [
      { name: "Bleeding Time", unit: "minutes", normalMin: 1, normalMax: 5 },
      { name: "Clotting Time", unit: "minutes", normalMin: 3, normalMax: 9 }
    ]
  },
  {
    categoryName: "Hematology",
    name: "Sickling Test for Anaemia",
    code: "SICKLE",
    sampleType: "Whole Blood",
    price: 250,
    parameters: [
      { name: "Sickle Cell", unit: "status", normalMin: 0, normalMax: 0 }
    ]
  },
  {
    categoryName: "Hematology",
    name: "Glucose 6 Phosphate Dehydrogenase",
    code: "G6PD",
    sampleType: "Whole Blood",
    price: 600,
    parameters: [
      { name: "G6PD Activity", unit: "U/g Hb", normalMin: 4.6, normalMax: 13.5 }
    ]
  },
  {
    categoryName: "Hematology",
    name: "Osmotic Fragility Test",
    code: "OFT",
    sampleType: "Whole Blood",
    price: 550,
    parameters: [
      { name: "Fragility Start", unit: "% NaCl", normalMin: 0.40, normalMax: 0.45 },
      { name: "Fragility Complete", unit: "% NaCl", normalMin: 0.30, normalMax: 0.35 }
    ]
  },
  {
    categoryName: "Hematology",
    name: "Hemoglobin Electrophoresis",
    code: "HBELECT",
    sampleType: "Whole Blood",
    price: 1800,
    parameters: [
      { name: "Hb A", unit: "%", normalMin: 95.0, normalMax: 98.0 },
      { name: "Hb A2", unit: "%", normalMin: 1.5, normalMax: 3.5 },
      { name: "Hb F", unit: "%", normalMin: 0.0, normalMax: 2.0 }
    ]
  },

  // ==================== BIOCHEMISTRY ====================
  {
    categoryName: "Biochemistry",
    name: "Liver Function Test",
    code: "LFT",
    sampleType: "Serum",
    price: 650,
    parameters: [
      { name: "Total Bilirubin", unit: "mg/dL", normalMin: 0.2, normalMax: 1.2 },
      { name: "Direct Bilirubin", unit: "mg/dL", normalMin: 0.0, normalMax: 0.3 },
      { name: "Indirect Bilirubin", unit: "mg/dL", normalMin: 0.2, normalMax: 0.8 },
      { name: "SGOT AST", unit: "U/L", normalMin: 5, normalMax: 40 },
      { name: "SGPT ALT", unit: "U/L", normalMin: 5, normalMax: 40 },
      { name: "Alkaline Phosphatase", unit: "U/L", normalMin: 30, normalMax: 120 },
      { name: "Total Protein", unit: "g/dL", normalMin: 6.0, normalMax: 8.3 },
      { name: "Albumin", unit: "g/dL", normalMin: 3.5, normalMax: 5.0 },
      { name: "Globulin", unit: "g/dL", normalMin: 2.0, normalMax: 3.5 },
      { name: "AG Ratio", unit: "ratio", normalMin: 1.1, normalMax: 2.2 }
    ]
  },
  {
    categoryName: "Biochemistry",
    name: "Kidney Function Test",
    code: "KFT",
    sampleType: "Serum",
    price: 700,
    parameters: [
      { name: "Urea", unit: "mg/dL", normalMin: 15, normalMax: 45 },
      { name: "Creatinine", unit: "mg/dL", normalMin: 0.6, normalMax: 1.2 },
      { name: "Uric Acid", unit: "mg/dL", normalMin: 3.0, normalMax: 7.0, maleMin: 3.5, maleMax: 7.2, femaleMin: 2.6, femaleMax: 6.0 },
      { name: "Calcium", unit: "mg/dL", normalMin: 8.8, normalMax: 10.2 },
      { name: "Phosphorus", unit: "mg/dL", normalMin: 2.5, normalMax: 4.5 }
    ]
  },
  {
    categoryName: "Biochemistry",
    name: "Lipid Profile",
    code: "LIPID",
    sampleType: "Serum",
    price: 600,
    parameters: [
      { name: "Total Cholesterol", unit: "mg/dL", normalMin: 100, normalMax: 200 },
      { name: "Triglycerides", unit: "mg/dL", normalMin: 50, normalMax: 150 },
      { name: "HDL Cholesterol", unit: "mg/dL", normalMin: 40, normalMax: 60 },
      { name: "LDL Cholesterol", unit: "mg/dL", normalMin: 0, normalMax: 100 },
      { name: "VLDL Cholesterol", unit: "mg/dL", normalMin: 5, normalMax: 30 }
    ]
  },
  {
    categoryName: "Biochemistry",
    name: "Blood Glucose Fasting",
    code: "FBS",
    sampleType: "Fluoride Plasma",
    price: 80,
    parameters: [
      { name: "Fasting Glucose", unit: "mg/dL", normalMin: 70, normalMax: 99 }
    ]
  },
  {
    categoryName: "Biochemistry",
    name: "Blood Glucose Post Prandial",
    code: "PPBS",
    sampleType: "Fluoride Plasma",
    price: 80,
    parameters: [
      { name: "Post Prandial Glucose", unit: "mg/dL", normalMin: 70, normalMax: 140 }
    ]
  },
  {
    categoryName: "Biochemistry",
    name: "Blood Glucose Random",
    code: "RBS",
    sampleType: "Fluoride Plasma",
    price: 80,
    parameters: [
      { name: "Random Glucose", unit: "mg/dL", normalMin: 70, normalMax: 140 }
    ]
  },
  {
    categoryName: "Biochemistry",
    name: "Glycated Hemoglobin",
    code: "HBA1C",
    sampleType: "Whole Blood",
    price: 380,
    parameters: [
      { name: "HbA1c", unit: "%", normalMin: 4.0, normalMax: 5.6 },
      { name: "Estimated Average Glucose", unit: "mg/dL", normalMin: 70, normalMax: 114 }
    ]
  },
  {
    categoryName: "Biochemistry",
    name: "Blood Urea Nitrogen",
    code: "BUN",
    sampleType: "Serum",
    price: 150,
    parameters: [
      { name: "Blood Urea Nitrogen", unit: "mg/dL", normalMin: 7, normalMax: 20 }
    ]
  },
  {
    categoryName: "Biochemistry",
    name: "Serum Creatinine Only",
    code: "CREAT",
    sampleType: "Serum",
    price: 160,
    parameters: [
      { name: "Serum Creatinine", unit: "mg/dL", normalMin: 0.6, normalMax: 1.2 }
    ]
  },
  {
    categoryName: "Biochemistry",
    name: "Serum Uric Acid Only",
    code: "URIC",
    sampleType: "Serum",
    price: 180,
    parameters: [
      { name: "Serum Uric Acid", unit: "mg/dL", normalMin: 3.0, normalMax: 7.0, maleMin: 3.5, maleMax: 7.2, femaleMin: 2.6, femaleMax: 6.0 }
    ]
  },
  {
    categoryName: "Biochemistry",
    name: "Serum Calcium Total",
    code: "CALCIUM",
    sampleType: "Serum",
    price: 180,
    parameters: [
      { name: "Total Calcium", unit: "mg/dL", normalMin: 8.8, normalMax: 10.2 }
    ]
  },
  {
    categoryName: "Biochemistry",
    name: "Serum Electrolytes",
    code: "ELECT",
    sampleType: "Serum",
    price: 450,
    parameters: [
      { name: "Sodium", unit: "mmol/L", normalMin: 136, normalMax: 145 },
      { name: "Potassium", unit: "mmol/L", normalMin: 3.5, normalMax: 5.1 },
      { name: "Chloride", unit: "mmol/L", normalMin: 98, normalMax: 107 }
    ]
  },
  {
    categoryName: "Biochemistry",
    name: "Serum Amylase",
    code: "AMYLASE",
    sampleType: "Serum",
    price: 400,
    parameters: [
      { name: "Amylase", unit: "U/L", normalMin: 28, normalMax: 100 }
    ]
  },
  {
    categoryName: "Biochemistry",
    name: "Serum Lipase Only",
    code: "LIPASE",
    sampleType: "Serum",
    price: 450,
    parameters: [
      { name: "Lipase", unit: "U/L", normalMin: 10, normalMax: 60 }
    ]
  },
  {
    categoryName: "Biochemistry",
    name: "Alkaline Phosphatase Only",
    code: "ALP",
    sampleType: "Serum",
    price: 180,
    parameters: [
      { name: "ALP", unit: "U/L", normalMin: 30, normalMax: 120 }
    ]
  },
  {
    categoryName: "Biochemistry",
    name: "Serum SGOT",
    code: "SGOT",
    sampleType: "Serum",
    price: 160,
    parameters: [
      { name: "AST", unit: "U/L", normalMin: 5, normalMax: 40 }
    ]
  },
  {
    categoryName: "Biochemistry",
    name: "Serum SGPT",
    code: "SGPT",
    sampleType: "Serum",
    price: 160,
    parameters: [
      { name: "ALT", unit: "U/L", normalMin: 5, normalMax: 40 }
    ]
  },
  {
    categoryName: "Biochemistry",
    name: "Gamma Glutamyl Transferase",
    code: "GGT",
    sampleType: "Serum",
    price: 350,
    parameters: [
      { name: "GGT", unit: "U/L", normalMin: 8, normalMax: 60 }
    ]
  },
  {
    categoryName: "Biochemistry",
    name: "Lactate Dehydrogenase Test",
    code: "LDH",
    sampleType: "Serum",
    price: 380,
    parameters: [
      { name: "LDH", unit: "U/L", normalMin: 140, normalMax: 280 }
    ]
  },
  {
    categoryName: "Biochemistry",
    name: "Serum Total Protein Only",
    code: "PROT",
    sampleType: "Serum",
    price: 150,
    parameters: [
      { name: "Total Protein", unit: "g/dL", normalMin: 6.0, normalMax: 8.3 }
    ]
  },
  {
    categoryName: "Biochemistry",
    name: "Serum Albumin Only",
    code: "ALB",
    sampleType: "Serum",
    price: 150,
    parameters: [
      { name: "Albumin", unit: "g/dL", normalMin: 3.5, normalMax: 5.0 }
    ]
  },
  {
    categoryName: "Biochemistry",
    name: "Serum Inorganic Phosphorus",
    code: "PHOSPH",
    sampleType: "Serum",
    price: 160,
    parameters: [
      { name: "Phosphorus", unit: "mg/dL", normalMin: 2.5, normalMax: 4.5 }
    ]
  },
  {
    categoryName: "Biochemistry",
    name: "Serum Magnesium Only",
    code: "MAGNESIUM",
    sampleType: "Serum",
    price: 250,
    parameters: [
      { name: "Magnesium", unit: "mg/dL", normalMin: 1.7, normalMax: 2.5 }
    ]
  },
  {
    categoryName: "Biochemistry",
    name: "Oral Glucose Tolerance Test",
    code: "OGTT",
    sampleType: "Fluoride Plasma",
    price: 240,
    parameters: [
      { name: "Fasting Glucose", unit: "mg/dL", normalMin: 70, normalMax: 99 },
      { name: "Glucose 1 Hour", unit: "mg/dL", normalMin: 70, normalMax: 180 },
      { name: "Glucose 2 Hour", unit: "mg/dL", normalMin: 70, normalMax: 140 }
    ]
  },
  {
    categoryName: "Biochemistry",
    name: "Serum Iron Profile",
    code: "IRON",
    sampleType: "Serum",
    price: 800,
    parameters: [
      { name: "Serum Iron", unit: "µg/dL", normalMin: 50, normalMax: 170, maleMin: 65, maleMax: 175, femaleMin: 50, femaleMax: 170 },
      { name: "Total Iron Binding Capacity", unit: "µg/dL", normalMin: 250, normalMax: 450 },
      { name: "Transferrin Saturation", unit: "%", normalMin: 20, normalMax: 50 }
    ]
  },

  // ==================== ENDOCRINOLOGY ====================
  {
    categoryName: "Endocrinology",
    name: "Thyroid Profile Total",
    code: "TFTT",
    sampleType: "Serum",
    price: 550,
    parameters: [
      { name: "Total T3", unit: "ng/mL", normalMin: 0.8, normalMax: 2.0 },
      { name: "Total T4", unit: "µg/dL", normalMin: 5.1, normalMax: 14.1 },
      { name: "Thyroid Stimulating Hormone", unit: "µIU/mL", normalMin: 0.4, normalMax: 4.2 }
    ]
  },
  {
    categoryName: "Endocrinology",
    name: "Thyroid Profile Free",
    code: "TFTF",
    sampleType: "Serum",
    price: 750,
    parameters: [
      { name: "Free T3", unit: "pg/mL", normalMin: 2.0, normalMax: 4.4 },
      { name: "Free T4", unit: "ng/dL", normalMin: 0.8, normalMax: 1.8 },
      { name: "Ultra TSH", unit: "µIU/mL", normalMin: 0.4, normalMax: 4.2 }
    ]
  },
  {
    categoryName: "Endocrinology",
    name: "Thyroid Stimulating Hormone Only",
    code: "TSH",
    sampleType: "Serum",
    price: 250,
    parameters: [
      { name: "TSH", unit: "µIU/mL", normalMin: 0.4, normalMax: 4.2 }
    ]
  },
  {
    categoryName: "Endocrinology",
    name: "Free T3 Test",
    code: "FT3",
    sampleType: "Serum",
    price: 300,
    parameters: [
      { name: "Free T3", unit: "pg/mL", normalMin: 2.0, normalMax: 4.4 }
    ]
  },
  {
    categoryName: "Endocrinology",
    name: "Free T4 Test",
    code: "FT4",
    sampleType: "Serum",
    price: 300,
    parameters: [
      { name: "Free T4", unit: "ng/dL", normalMin: 0.8, normalMax: 1.8 }
    ]
  },
  {
    categoryName: "Endocrinology",
    name: "Serum Prolactin Test",
    code: "PROLACTIN",
    sampleType: "Serum",
    price: 450,
    parameters: [
      { name: "Prolactin", unit: "ng/mL", normalMin: 4.0, normalMax: 23.0, maleMin: 4.0, maleMax: 15.0, femaleMin: 5.0, femaleMax: 23.3 }
    ]
  },
  {
    categoryName: "Endocrinology",
    name: "Luteinizing Hormone Test",
    code: "LH",
    sampleType: "Serum",
    price: 450,
    parameters: [
      { name: "LH", unit: "mIU/mL", normalMin: 1.5, normalMax: 12.0, maleMin: 1.7, maleMax: 8.6, femaleMin: 1.5, femaleMax: 12.5 }
    ]
  },
  {
    categoryName: "Endocrinology",
    name: "Follicle Stimulating Hormone Test",
    code: "FSH",
    sampleType: "Serum",
    price: 450,
    parameters: [
      { name: "FSH", unit: "mIU/mL", normalMin: 1.5, normalMax: 12.4, maleMin: 1.5, maleMax: 12.4, femaleMin: 1.7, femaleMax: 21.5 }
    ]
  },
  {
    categoryName: "Endocrinology",
    name: "Serum Estradiol Test",
    code: "E2",
    sampleType: "Serum",
    price: 550,
    parameters: [
      { name: "Estradiol", unit: "pg/mL", normalMin: 15, normalMax: 350, maleMin: 10, maleMax: 50, femaleMin: 15, femaleMax: 350 }
    ]
  },
  {
    categoryName: "Endocrinology",
    name: "Serum Progesterone Test",
    code: "PROG",
    sampleType: "Serum",
    price: 550,
    parameters: [
      { name: "Progesterone", unit: "ng/mL", normalMin: 0.1, normalMax: 25.0, maleMin: 0.1, maleMax: 1.0, femaleMin: 0.2, femaleMax: 25.0 }
    ]
  },
  {
    categoryName: "Endocrinology",
    name: "Total Testosterone Test",
    code: "TESTO",
    sampleType: "Serum",
    price: 600,
    parameters: [
      { name: "Testosterone", unit: "ng/dL", normalMin: 200, normalMax: 800, maleMin: 280, maleMax: 800, femaleMin: 15, femaleMax: 70 }
    ]
  },
  {
    categoryName: "Endocrinology",
    name: "Free Testosterone Test",
    code: "FTESTO",
    sampleType: "Serum",
    price: 1200,
    parameters: [
      { name: "Free Testosterone", unit: "pg/mL", normalMin: 5, normalMax: 30, maleMin: 8.8, maleMax: 27.0, femaleMin: 0.5, femaleMax: 2.2 }
    ]
  },
  {
    categoryName: "Endocrinology",
    name: "Serum Cortisol Morning",
    code: "CORTISOLM",
    sampleType: "Serum",
    price: 500,
    parameters: [
      { name: "Cortisol AM", unit: "µg/dL", normalMin: 6.2, normalMax: 19.4 }
    ]
  },
  {
    categoryName: "Endocrinology",
    name: "Serum Cortisol Afternoon",
    code: "CORTISOLA",
    sampleType: "Serum",
    price: 500,
    parameters: [
      { name: "Cortisol PM", unit: "µg/dL", normalMin: 2.3, normalMax: 11.9 }
    ]
  },
  {
    categoryName: "Endocrinology",
    name: "Growth Hormone Test",
    code: "GH",
    sampleType: "Serum",
    price: 650,
    parameters: [
      { name: "Growth Hormone", unit: "ng/mL", normalMin: 0.0, normalMax: 5.0, maleMin: 0.0, maleMax: 3.0, femaleMin: 0.0, femaleMax: 5.0 }
    ]
  },
  {
    categoryName: "Endocrinology",
    name: "Fasting Serum Insulin",
    code: "INSULIN",
    sampleType: "Serum",
    price: 550,
    parameters: [
      { name: "Fasting Insulin", unit: "µIU/mL", normalMin: 2.6, normalMax: 24.9 }
    ]
  },
  {
    categoryName: "Endocrinology",
    name: "Serum C Peptide",
    code: "CPEPTIDE",
    sampleType: "Serum",
    price: 900,
    parameters: [
      { name: "C Peptide", unit: "ng/mL", normalMin: 0.9, normalMax: 7.1 }
    ]
  },
  {
    categoryName: "Endocrinology",
    name: "Intact Parathyroid Hormone",
    code: "PTH",
    sampleType: "Serum",
    price: 1100,
    parameters: [
      { name: "Intact PTH", unit: "pg/mL", normalMin: 15, normalMax: 65 }
    ]
  },
  {
    categoryName: "Endocrinology",
    name: "Beta hCG Quantitative",
    code: "BHCG",
    sampleType: "Serum",
    price: 650,
    parameters: [
      { name: "Beta hCG", unit: "mIU/mL", normalMin: 0, normalMax: 5 }
    ]
  },
  {
    categoryName: "Endocrinology",
    name: "Serum DHEA Sulfate",
    code: "DHEAS",
    sampleType: "Serum",
    price: 750,
    parameters: [
      { name: "DHEA S", unit: "µg/dL", normalMin: 80, normalMax: 560, maleMin: 80, maleMax: 560, femaleMin: 35, femaleMax: 430 }
    ]
  },
  {
    categoryName: "Endocrinology",
    name: "Sex Hormone Binding Globulin",
    code: "SHBG",
    sampleType: "Serum",
    price: 1200,
    parameters: [
      { name: "SHBG", unit: "nmol/L", normalMin: 18, normalMax: 110, maleMin: 18, maleMax: 54, femaleMin: 20, femaleMax: 110 }
    ]
  },
  {
    categoryName: "Endocrinology",
    name: "Anti Mullerian Hormone",
    code: "AMH",
    sampleType: "Serum",
    price: 2200,
    parameters: [
      { name: "AMH Level", unit: "ng/mL", normalMin: 0.7, normalMax: 7.0 }
    ]
  },
  {
    categoryName: "Endocrinology",
    name: "Progesterone Receptor Test",
    code: "PR",
    sampleType: "Biopsy",
    price: 1800,
    parameters: [
      { name: "PR Positive", unit: "%", normalMin: 1, normalMax: 100 }
    ]
  },
  {
    categoryName: "Endocrinology",
    name: "Estrogen Receptor Test",
    code: "ER",
    sampleType: "Biopsy",
    price: 1800,
    parameters: [
      { name: "ER Positive", unit: "%", normalMin: 1, normalMax: 100 }
    ]
  },
  {
    categoryName: "Endocrinology",
    name: "Serum Thyroglobulin Test",
    code: "TG",
    sampleType: "Serum",
    price: 1500,
    parameters: [
      { name: "Thyroglobulin", unit: "ng/mL", normalMin: 1.4, normalMax: 78.0 }
    ]
  },

  // ==================== SEROLOGY & IMMUNOLOGY ====================
  {
    categoryName: "Serology & Immunology",
    name: "Vitamin D3 Test",
    code: "VITD",
    sampleType: "Serum",
    price: 1200,
    parameters: [
      { name: "Vitamin D level", unit: "ng/mL", normalMin: 30, normalMax: 100 }
    ]
  },
  {
    categoryName: "Serology & Immunology",
    name: "Vitamin B12 Test",
    code: "VITB12",
    sampleType: "Serum",
    price: 800,
    parameters: [
      { name: "Vitamin B12 level", unit: "pg/mL", normalMin: 211, normalMax: 911 }
    ]
  },
  {
    categoryName: "Serology & Immunology",
    name: "C Reactive Protein Quantitative",
    code: "CRP",
    sampleType: "Serum",
    price: 350,
    parameters: [
      { name: "CRP Level", unit: "mg/L", normalMin: 0, normalMax: 5.0 }
    ]
  },
  {
    categoryName: "Serology & Immunology",
    name: "Rheumatoid Factor Quantitative",
    code: "RF",
    sampleType: "Serum",
    price: 450,
    parameters: [
      { name: "RF Level", unit: "IU/mL", normalMin: 0, normalMax: 14 }
    ]
  },
  {
    categoryName: "Serology & Immunology",
    name: "Anti Streptolysin O Titre",
    code: "ASO",
    sampleType: "Serum",
    price: 450,
    parameters: [
      { name: "ASO Level", unit: "IU/mL", normalMin: 0, normalMax: 200 }
    ]
  },
  {
    categoryName: "Serology & Immunology",
    name: "Widal Slide Test",
    code: "WIDAL",
    sampleType: "Serum",
    price: 180,
    parameters: [
      { name: "S Typhi O", unit: "titre", normalMin: 0, normalMax: 0 },
      { name: "S Typhi H", unit: "titre", normalMin: 0, normalMax: 0 },
      { name: "S Paratyphi AH", unit: "titre", normalMin: 0, normalMax: 0 },
      { name: "S Paratyphi BH", unit: "titre", normalMin: 0, normalMax: 0 }
    ]
  },
  {
    categoryName: "Serology & Immunology",
    name: "Dengue NS1 Antigen Test",
    code: "DENGUENS1",
    sampleType: "Serum",
    price: 550,
    parameters: [
      { name: "Dengue NS1", unit: "status", normalMin: 0, normalMax: 0 }
    ]
  },
  {
    categoryName: "Serology & Immunology",
    name: "Dengue Antibodies IgM & IgG",
    code: "DENGUEAB",
    sampleType: "Serum",
    price: 750,
    parameters: [
      { name: "Dengue IgM", unit: "index", normalMin: 0, normalMax: 0.9 },
      { name: "Dengue IgG", unit: "index", normalMin: 0, normalMax: 0.9 }
    ]
  },
  {
    categoryName: "Serology & Immunology",
    name: "HBsAg Rapid Test",
    code: "HBSAG",
    sampleType: "Serum",
    price: 250,
    parameters: [
      { name: "Hepatitis B Surface Antigen", unit: "status", normalMin: 0, normalMax: 0 }
    ]
  },
  {
    categoryName: "Serology & Immunology",
    name: "Anti HCV Rapid Test",
    code: "HCV",
    sampleType: "Serum",
    price: 350,
    parameters: [
      { name: "Hepatitis C Antibody", unit: "status", normalMin: 0, normalMax: 0 }
    ]
  },
  {
    categoryName: "Serology & Immunology",
    name: "HIV 1 & 2 Antibody Screening",
    code: "HIV",
    sampleType: "Serum",
    price: 350,
    parameters: [
      { name: "HIV 1 and 2 Test", unit: "status", normalMin: 0, normalMax: 0 }
    ]
  },
  {
    categoryName: "Serology & Immunology",
    name: "Syphilis Screening VDRL Test",
    code: "VDRL",
    sampleType: "Serum",
    price: 200,
    parameters: [
      { name: "VDRL Test", unit: "status", normalMin: 0, normalMax: 0 }
    ]
  },
  {
    categoryName: "Serology & Immunology",
    name: "Anti Nuclear Antibody IFA",
    code: "ANA",
    sampleType: "Serum",
    price: 1100,
    parameters: [
      { name: "ANA IFA Titre", unit: "titre", normalMin: 0, normalMax: 0 }
    ]
  },
  {
    categoryName: "Serology & Immunology",
    name: "Anti dsDNA Test",
    code: "DSDNA",
    sampleType: "Serum",
    price: 1200,
    parameters: [
      { name: "Anti dsDNA level", unit: "IU/mL", normalMin: 0, normalMax: 30 }
    ]
  },
  {
    categoryName: "Serology & Immunology",
    name: "Anti Cyclic Citrullinated Peptide",
    code: "ACCP",
    sampleType: "Serum",
    price: 1400,
    parameters: [
      { name: "Anti CCP level", unit: "U/mL", normalMin: 0, normalMax: 17 }
    ]
  },
  {
    categoryName: "Serology & Immunology",
    name: "Serum Folate Level",
    code: "FOLATE",
    sampleType: "Serum",
    price: 800,
    parameters: [
      { name: "Folate level", unit: "ng/mL", normalMin: 3.1, normalMax: 17.5 }
    ]
  },
  {
    categoryName: "Serology & Immunology",
    name: "Total Immunoglobulin E",
    code: "IGE",
    sampleType: "Serum",
    price: 650,
    parameters: [
      { name: "Total IgE level", unit: "IU/mL", normalMin: 0, normalMax: 100 }
    ]
  },
  {
    categoryName: "Serology & Immunology",
    name: "Typhidot IgM & IgG Test",
    code: "TYPHIDOT",
    sampleType: "Serum",
    price: 450,
    parameters: [
      { name: "Typhidot IgM", unit: "status", normalMin: 0, normalMax: 0 },
      { name: "Typhidot IgG", unit: "status", normalMin: 0, normalMax: 0 }
    ]
  },
  {
    categoryName: "Serology & Immunology",
    name: "Chikungunya IgM Antibody Test",
    code: "CHIKM",
    sampleType: "Serum",
    price: 650,
    parameters: [
      { name: "Chikungunya IgM", unit: "index", normalMin: 0, normalMax: 0.9 }
    ]
  },
  {
    categoryName: "Serology & Immunology",
    name: "Leptospira IgM Antibody Test",
    code: "LEPTOM",
    sampleType: "Serum",
    price: 650,
    parameters: [
      { name: "Leptospira IgM", unit: "index", normalMin: 0, normalMax: 0.9 }
    ]
  },

  // ==================== CLINICAL PATHOLOGY ====================
  {
    categoryName: "Clinical Pathology",
    name: "Urine Routine Examination",
    code: "URINE",
    sampleType: "Urine",
    price: 150,
    parameters: [
      { name: "Urine pH", unit: "pH", normalMin: 4.5, normalMax: 8.0 },
      { name: "Specific Gravity", unit: "gravity", normalMin: 1.005, normalMax: 1.030 },
      { name: "Urine Protein", unit: "mg/dL", normalMin: 0, normalMax: 0 },
      { name: "Urine Glucose", unit: "mg/dL", normalMin: 0, normalMax: 0 },
      { name: "Pus Cells", unit: "/HPF", normalMin: 0, normalMax: 5 },
      { name: "Epithelial Cells", unit: "/HPF", normalMin: 0, normalMax: 10 },
      { name: "RBCs", unit: "/HPF", normalMin: 0, normalMax: 2 }
    ]
  },
  {
    categoryName: "Clinical Pathology",
    name: "Urine Pregnancy Test",
    code: "UPT",
    sampleType: "Urine",
    price: 100,
    parameters: [
      { name: "HCG Pregnancy Test", unit: "status", normalMin: 0, normalMax: 0 }
    ]
  },
  {
    categoryName: "Clinical Pathology",
    name: "Stool Routine Examination",
    code: "STOOL",
    sampleType: "Stool",
    price: 180,
    parameters: [
      { name: "Color", unit: "status", normalMin: 0, normalMax: 0 },
      { name: "Consistency", unit: "status", normalMin: 0, normalMax: 0 },
      { name: "Mucus", unit: "status", normalMin: 0, normalMax: 0 },
      { name: "Pus Cells", unit: "/HPF", normalMin: 0, normalMax: 2 },
      { name: "RBCs", unit: "/HPF", normalMin: 0, normalMax: 0 },
      { name: "Ova and Cysts", unit: "status", normalMin: 0, normalMax: 0 }
    ]
  },
  {
    categoryName: "Clinical Pathology",
    name: "Stool Occult Blood",
    code: "SOB",
    sampleType: "Stool",
    price: 200,
    parameters: [
      { name: "Occult Blood", unit: "status", normalMin: 0, normalMax: 0 }
    ]
  },
  {
    categoryName: "Clinical Pathology",
    name: "Semen Analysis",
    code: "SEMEN",
    sampleType: "Semen",
    price: 600,
    parameters: [
      { name: "Semen Volume", unit: "mL", normalMin: 1.5, normalMax: 6.0 },
      { name: "Sperm Count", unit: "million/mL", normalMin: 15, normalMax: 200 },
      { name: "Rapid Progressive Motility", unit: "%", normalMin: 32, normalMax: 100 },
      { name: "Total Motility", unit: "%", normalMin: 40, normalMax: 100 },
      { name: "Normal Morphology", unit: "%", normalMin: 4, normalMax: 100 }
    ]
  },
  {
    categoryName: "Clinical Pathology",
    name: "CSF Analysis",
    code: "CSF",
    sampleType: "CSF",
    price: 1000,
    parameters: [
      { name: "CSF Total Protein", unit: "mg/dL", normalMin: 15, normalMax: 45 },
      { name: "CSF Glucose", unit: "mg/dL", normalMin: 40, normalMax: 70 },
      { name: "CSF Chloride", unit: "mmol/L", normalMin: 110, normalMax: 125 },
      { name: "CSF WBC Count", unit: "cells/µL", normalMin: 0, normalMax: 5 }
    ]
  },
  {
    categoryName: "Clinical Pathology",
    name: "Ascitic Fluid Analysis",
    code: "ASCITIC",
    sampleType: "Ascitic Fluid",
    price: 900,
    parameters: [
      { name: "Ascitic Protein", unit: "g/dL", normalMin: 1.0, normalMax: 3.0 },
      { name: "Ascitic Albumin", unit: "g/dL", normalMin: 0.5, normalMax: 2.0 },
      { name: "Ascitic WBC Count", unit: "cells/µL", normalMin: 0, normalMax: 250 }
    ]
  },
  {
    categoryName: "Clinical Pathology",
    name: "Pleural Fluid Analysis",
    code: "PLEURAL",
    sampleType: "Pleural Fluid",
    price: 900,
    parameters: [
      { name: "Pleural Protein", unit: "g/dL", normalMin: 1.0, normalMax: 3.0 },
      { name: "Pleural LDH", unit: "U/L", normalMin: 60, normalMax: 200 },
      { name: "Pleural WBC Count", unit: "cells/µL", normalMin: 0, normalMax: 500 }
    ]
  },
  {
    categoryName: "Clinical Pathology",
    name: "Synovial Fluid Analysis",
    code: "SYNOVIAL",
    sampleType: "Synovial Fluid",
    price: 1000,
    parameters: [
      { name: "Synovial Protein", unit: "g/dL", normalMin: 1.0, normalMax: 3.0 },
      { name: "Synovial WBC Count", unit: "cells/µL", normalMin: 0, normalMax: 150 }
    ]
  },
  {
    categoryName: "Clinical Pathology",
    name: "Sputum AFB Stain",
    code: "SAFB",
    sampleType: "Sputum",
    price: 250,
    parameters: [
      { name: "AFB Smear", unit: "status", normalMin: 0, normalMax: 0 }
    ]
  },
  {
    categoryName: "Clinical Pathology",
    name: "Urine Microalbumin",
    code: "UMICRO",
    sampleType: "Urine",
    price: 450,
    parameters: [
      { name: "Microalbumin Level", unit: "mg/L", normalMin: 0, normalMax: 20 }
    ]
  },
  {
    categoryName: "Clinical Pathology",
    name: "Urine Protein 24 Hour",
    code: "U24PROT",
    sampleType: "Urine",
    price: 400,
    parameters: [
      { name: "Protein Total 24 Hour", unit: "mg/24h", normalMin: 50, normalMax: 150 }
    ]
  },
  {
    categoryName: "Clinical Pathology",
    name: "Urine Creatinine 24 Hour",
    code: "U24CREAT",
    sampleType: "Urine",
    price: 400,
    parameters: [
      { name: "Creatinine Total 24 Hour", unit: "g/24h", normalMin: 0.8, normalMax: 2.0, maleMin: 1.0, maleMax: 2.0, femaleMin: 0.8, femaleMax: 1.8 }
    ]
  },
  {
    categoryName: "Clinical Pathology",
    name: "Renal Stone Analysis",
    code: "STONE",
    sampleType: "Kidney Stone",
    price: 800,
    parameters: [
      { name: "Stone Calcium", unit: "%", normalMin: 0, normalMax: 100 },
      { name: "Stone Oxalate", unit: "%", normalMin: 0, normalMax: 100 },
      { name: "Stone Phosphate", unit: "%", normalMin: 0, normalMax: 100 },
      { name: "Stone Uric Acid", unit: "%", normalMin: 0, normalMax: 100 }
    ]
  },
  {
    categoryName: "Clinical Pathology",
    name: "Sputum Routine Test",
    code: "SPUTUM",
    sampleType: "Sputum",
    price: 250,
    parameters: [
      { name: "Sputum Color", unit: "status", normalMin: 0, normalMax: 0 },
      { name: "Epithelial Cells", unit: "/LPF", normalMin: 0, normalMax: 10 },
      { name: "Pus Cells Count", unit: "/HPF", normalMin: 0, normalMax: 25 },
      { name: "Gram Stain Smear", unit: "findings", normalMin: 0, normalMax: 0 }
    ]
  },
  {
    categoryName: "Clinical Pathology",
    name: "Body Fluid Cell Count",
    code: "BFCC",
    sampleType: "Body Fluid",
    price: 350,
    parameters: [
      { name: "Total Cells Count", unit: "cells/µL", normalMin: 0, normalMax: 10 },
      { name: "Polymorphs Percent", unit: "%", normalMin: 0, normalMax: 100 },
      { name: "Lymphocytes Percent", unit: "%", normalMin: 0, normalMax: 100 }
    ]
  },
  {
    categoryName: "Clinical Pathology",
    name: "Body Fluid Amylase",
    code: "FLAMYLASE",
    sampleType: "Body Fluid",
    price: 450,
    parameters: [
      { name: "Fluid Amylase Level", unit: "U/L", normalMin: 0, normalMax: 100 }
    ]
  },
  {
    categoryName: "Clinical Pathology",
    name: "Urine Bence Jones Protein",
    code: "BJP",
    sampleType: "Urine",
    price: 350,
    parameters: [
      { name: "Bence Jones Protein Test", unit: "status", normalMin: 0, normalMax: 0 }
    ]
  },
  {
    categoryName: "Clinical Pathology",
    name: "Stool Reducing Sugar",
    code: "STOOLRED",
    sampleType: "Stool",
    price: 180,
    parameters: [
      { name: "Reducing Sugar Test", unit: "status", normalMin: 0, normalMax: 0 }
    ]
  },
  {
    categoryName: "Clinical Pathology",
    name: "Urine Bile Salts Bile Pigments",
    code: "USALTPIG",
    sampleType: "Urine",
    price: 180,
    parameters: [
      { name: "Urine Bile Salts", unit: "status", normalMin: 0, normalMax: 0 },
      { name: "Urine Bile Pigments", unit: "status", normalMin: 0, normalMax: 0 }
    ]
  },

  // ==================== TUMOUR MARKERS ====================
  {
    categoryName: "Tumour Markers",
    name: "Prostate Specific Antigen Total",
    code: "PSAT",
    sampleType: "Serum",
    price: 650,
    parameters: [
      { name: "Total PSA level", unit: "ng/mL", normalMin: 0.0, normalMax: 4.0 }
    ]
  },
  {
    categoryName: "Tumour Markers",
    name: "Free Prostate Specific Antigen",
    code: "FPSA",
    sampleType: "Serum",
    price: 1200,
    parameters: [
      { name: "Free PSA level", unit: "ng/mL", normalMin: 0.0, normalMax: 1.0 }
    ]
  },
  {
    categoryName: "Tumour Markers",
    name: "Cancer Antigen 125 Test",
    code: "CA125",
    sampleType: "Serum",
    price: 1100,
    parameters: [
      { name: "CA 125 level", unit: "U/mL", normalMin: 0.0, normalMax: 35.0 }
    ]
  },
  {
    categoryName: "Tumour Markers",
    name: "Cancer Antigen 19 9 Test",
    code: "CA199",
    sampleType: "Serum",
    price: 1100,
    parameters: [
      { name: "CA 19 9 level", unit: "U/mL", normalMin: 0.0, normalMax: 37.0 }
    ]
  },
  {
    categoryName: "Tumour Markers",
    name: "Cancer Antigen 15 3 Test",
    code: "CA153",
    sampleType: "Serum",
    price: 1100,
    parameters: [
      { name: "CA 15 3 level", unit: "U/mL", normalMin: 0.0, normalMax: 30.0 }
    ]
  },
  {
    categoryName: "Tumour Markers",
    name: "Carcinoembryonic Antigen Test",
    code: "CEA",
    sampleType: "Serum",
    price: 700,
    parameters: [
      { name: "CEA Level", unit: "ng/mL", normalMin: 0.0, normalMax: 5.0 }
    ]
  },
  {
    categoryName: "Tumour Markers",
    name: "Alpha Fetoprotein Test",
    code: "AFP",
    sampleType: "Serum",
    price: 700,
    parameters: [
      { name: "AFP Level", unit: "IU/mL", normalMin: 0.0, normalMax: 5.8 }
    ]
  },
  {
    categoryName: "Tumour Markers",
    name: "Beta 2 Microglobulin Test",
    code: "B2M",
    sampleType: "Serum",
    price: 900,
    parameters: [
      { name: "Beta 2 Microglobulin", unit: "mg/L", normalMin: 0.7, normalMax: 1.8 }
    ]
  },
  {
    categoryName: "Tumour Markers",
    name: "Calcitonin Test",
    code: "CALCITONIN",
    sampleType: "Serum",
    price: 1400,
    parameters: [
      { name: "Calcitonin level", unit: "pg/mL", normalMin: 0.0, normalMax: 8.4 }
    ]
  },
  {
    categoryName: "Tumour Markers",
    name: "Human Epididymis Protein 4",
    code: "HE4",
    sampleType: "Serum",
    price: 1800,
    parameters: [
      { name: "HE4 Level", unit: "pmol/L", normalMin: 0.0, normalMax: 140.0 }
    ]
  },
  {
    categoryName: "Tumour Markers",
    name: "Chromogranin A Test",
    code: "CHGA",
    sampleType: "Serum",
    price: 2500,
    parameters: [
      { name: "Chromogranin A", unit: "ng/mL", normalMin: 27, normalMax: 94 }
    ]
  },
  {
    categoryName: "Tumour Markers",
    name: "Neuron Specific Enolase Test",
    code: "NSE",
    sampleType: "Serum",
    price: 1600,
    parameters: [
      { name: "NSE level", unit: "µg/L", normalMin: 0.0, normalMax: 16.3 }
    ]
  },
  {
    categoryName: "Tumour Markers",
    name: "Cyfra 21 1 Lung Marker",
    code: "CYFRA211",
    sampleType: "Serum",
    price: 1800,
    parameters: [
      { name: "Cyfra 21 1 level", unit: "ng/mL", normalMin: 0.0, normalMax: 3.3 }
    ]
  },
  {
    categoryName: "Tumour Markers",
    name: "Squamous Cell Carcinoma Antigen",
    code: "SCCA",
    sampleType: "Serum",
    price: 1900,
    parameters: [
      { name: "SCC Antigen level", unit: "µg/L", normalMin: 0.0, normalMax: 1.5 }
    ]
  },
  {
    categoryName: "Tumour Markers",
    name: "Human Chorionic Gonadotropin Total",
    code: "HCG",
    sampleType: "Serum",
    price: 650,
    parameters: [
      { name: "Total Beta HCG Level", unit: "mIU/mL", normalMin: 0, normalMax: 5 }
    ]
  },

  // ==================== COAGULATION ====================
  {
    categoryName: "Coagulation",
    name: "Prothrombin Time with INR",
    code: "PTINR",
    sampleType: "Citrate Plasma",
    price: 350,
    parameters: [
      { name: "Prothrombin Time", unit: "seconds", normalMin: 11.0, normalMax: 14.5 },
      { name: "Control Time", unit: "seconds", normalMin: 11.0, normalMax: 13.5 },
      { name: "INR Ratio Value", unit: "ratio", normalMin: 0.8, normalMax: 1.2 }
    ]
  },
  {
    categoryName: "Coagulation",
    name: "Activated Partial Thromboplastin Time",
    code: "APTT",
    sampleType: "Citrate Plasma",
    price: 380,
    parameters: [
      { name: "APTT Patient Time", unit: "seconds", normalMin: 26.0, normalMax: 36.0 },
      { name: "APTT Control Time", unit: "seconds", normalMin: 26.0, normalMax: 34.0 }
    ]
  },
  {
    categoryName: "Coagulation",
    name: "Plasma Fibrinogen Test",
    code: "FIBRINOGEN",
    sampleType: "Citrate Plasma",
    price: 450,
    parameters: [
      { name: "Fibrinogen level", unit: "mg/dL", normalMin: 150, normalMax: 400 }
    ]
  },
  {
    categoryName: "Coagulation",
    name: "D Dimer Quantitative",
    code: "DDIMER",
    sampleType: "Citrate Plasma",
    price: 1100,
    parameters: [
      { name: "D Dimer level", unit: "ng/mL FEU", normalMin: 0, normalMax: 500 }
    ]
  },
  {
    categoryName: "Coagulation",
    name: "Thrombin Time Test",
    code: "TT",
    sampleType: "Citrate Plasma",
    price: 380,
    parameters: [
      { name: "Thrombin Time Value", unit: "seconds", normalMin: 12.0, normalMax: 19.0 }
    ]
  },
  {
    categoryName: "Coagulation",
    name: "Bleeding Time Ivy Method",
    code: "BTIVY",
    sampleType: "Whole Blood",
    price: 200,
    parameters: [
      { name: "Bleeding Time Ivy", unit: "minutes", normalMin: 2, normalMax: 9 }
    ]
  },
  {
    categoryName: "Coagulation",
    name: "Clotting Time Lee White",
    code: "CTLEE",
    sampleType: "Whole Blood",
    price: 200,
    parameters: [
      { name: "Clotting Time Lee White", unit: "minutes", normalMin: 5, normalMax: 15 }
    ]
  },
  {
    categoryName: "Coagulation",
    name: "Factor VIII Activity Assay",
    code: "FACTOR8",
    sampleType: "Citrate Plasma",
    price: 1800,
    parameters: [
      { name: "Factor VIII Activity", unit: "%", normalMin: 50, normalMax: 150 }
    ]
  },
  {
    categoryName: "Coagulation",
    name: "Factor IX Activity Assay",
    code: "FACTOR9",
    sampleType: "Citrate Plasma",
    price: 1800,
    parameters: [
      { name: "Factor IX Activity", unit: "%", normalMin: 50, normalMax: 150 }
    ]
  },
  {
    categoryName: "Coagulation",
    name: "Lupus Anticoagulant Screening",
    code: "LACSCREEN",
    sampleType: "Citrate Plasma",
    price: 2200,
    parameters: [
      { name: "DRVVT Screen Time", unit: "seconds", normalMin: 30, normalMax: 45 },
      { name: "DRVVT Confirm Time", unit: "seconds", normalMin: 30, normalMax: 40 },
      { name: "LAC Ratio Value", unit: "ratio", normalMin: 0.8, normalMax: 1.2 }
    ]
  },
  {
    categoryName: "Coagulation",
    name: "Antithrombin III Activity",
    code: "AT3",
    sampleType: "Citrate Plasma",
    price: 1500,
    parameters: [
      { name: "Antithrombin III Level", unit: "%", normalMin: 80, normalMax: 120 }
    ]
  },
  {
    categoryName: "Coagulation",
    name: "Protein C Activity Assay",
    code: "PROTC",
    sampleType: "Citrate Plasma",
    price: 2000,
    parameters: [
      { name: "Protein C Activity", unit: "%", normalMin: 70, normalMax: 140 }
    ]
  },
  {
    categoryName: "Coagulation",
    name: "Protein S Activity Assay",
    code: "PROTS",
    sampleType: "Citrate Plasma",
    price: 2000,
    parameters: [
      { name: "Protein S Activity", unit: "%", normalMin: 60, normalMax: 130 }
    ]
  },
  {
    categoryName: "Coagulation",
    name: "Activated Protein C Resistance",
    code: "APCR",
    sampleType: "Citrate Plasma",
    price: 2500,
    parameters: [
      { name: "APC Resistance Ratio", unit: "ratio", normalMin: 2.0, normalMax: 5.0 }
    ]
  },
  {
    categoryName: "Coagulation",
    name: "Fibrin Degradation Products",
    code: "FDP",
    sampleType: "Citrate Plasma",
    price: 900,
    parameters: [
      { name: "FDP Level", unit: "µg/mL", normalMin: 0, normalMax: 5 }
    ]
  },

  // ==================== MICROBIOLOGY & MOLECULAR ====================
  {
    categoryName: "Microbiology & Molecular",
    name: "Blood Culture & Sensitivity",
    code: "BCS",
    sampleType: "Whole Blood",
    price: 850,
    parameters: [
      { name: "Incubation Period", unit: "days", normalMin: 1, normalMax: 7 },
      { name: "Culture Growth", unit: "status", normalMin: 0, normalMax: 0 },
      { name: "Organism Isolated", unit: "status", normalMin: 0, normalMax: 0 }
    ]
  },
  {
    categoryName: "Microbiology & Molecular",
    name: "Urine Culture & Sensitivity",
    code: "UCS",
    sampleType: "Urine",
    price: 600,
    parameters: [
      { name: "Pus Cells Count", unit: "/HPF", normalMin: 0, normalMax: 5 },
      { name: "Colony Count", unit: "CFU/mL", normalMin: 0, normalMax: 1000 },
      { name: "Organism Isolated", unit: "status", normalMin: 0, normalMax: 0 }
    ]
  },
  {
    categoryName: "Microbiology & Molecular",
    name: "Sputum Gram Stain",
    code: "SPUTUMGS",
    sampleType: "Sputum",
    price: 200,
    parameters: [
      { name: "Epithelial Cells Count", unit: "/LPF", normalMin: 0, normalMax: 10 },
      { name: "Pus Cells Count", unit: "/HPF", normalMin: 0, normalMax: 25 },
      { name: "Gram Positive Organisms", unit: "status", normalMin: 0, normalMax: 0 },
      { name: "Gram Negative Organisms", unit: "status", normalMin: 0, normalMax: 0 }
    ]
  },
  {
    categoryName: "Microbiology & Molecular",
    name: "KOH Mount for Fungi",
    code: "KOHMOUNT",
    sampleType: "Skin Scraping",
    price: 200,
    parameters: [
      { name: "Fungal Elements Test", unit: "status", normalMin: 0, normalMax: 0 }
    ]
  },
  {
    categoryName: "Microbiology & Molecular",
    name: "Mantoux Tuberculin Skin Test",
    code: "MANTOUX",
    sampleType: "Intradermal",
    price: 250,
    parameters: [
      { name: "Duration of Test", unit: "hours", normalMin: 48, normalMax: 72 },
      { name: "Induration Size", unit: "mm", normalMin: 0, normalMax: 5 },
      { name: "Test Interpretation", unit: "status", normalMin: 0, normalMax: 0 }
    ]
  },
  {
    categoryName: "Microbiology & Molecular",
    name: "PCR for Tuberculosis",
    code: "TBPCR",
    sampleType: "Sputum",
    price: 2200,
    parameters: [
      { name: "TB DNA Detection", unit: "status", normalMin: 0, normalMax: 0 }
    ]
  },
  {
    categoryName: "Microbiology & Molecular",
    name: "Hepatitis B Virus DNA Quantitative",
    code: "HBVDNA",
    sampleType: "Plasma",
    price: 5500,
    parameters: [
      { name: "HBV DNA Viral Load", unit: "IU/mL", normalMin: 0, normalMax: 20 },
      { name: "Log Value level", unit: "log10 IU/mL", normalMin: 0, normalMax: 1.3 }
    ]
  },
  {
    categoryName: "Microbiology & Molecular",
    name: "Hepatitis C Virus RNA Quantitative",
    code: "HCVRNA",
    sampleType: "Plasma",
    price: 6000,
    parameters: [
      { name: "HCV RNA Viral Load", unit: "IU/mL", normalMin: 0, normalMax: 15 },
      { name: "Log Value level", unit: "log10 IU/mL", normalMin: 0, normalMax: 1.2 }
    ]
  },
  {
    categoryName: "Microbiology & Molecular",
    name: "Malaria Antigen Rapid Test",
    code: "MALARIA",
    sampleType: "Whole Blood",
    price: 300,
    parameters: [
      { name: "P falciparum", unit: "status", normalMin: 0, normalMax: 0 },
      { name: "P vivax", unit: "status", normalMin: 0, normalMax: 0 }
    ]
  },
  {
    categoryName: "Microbiology & Molecular",
    name: "Widal Tube Agglutination",
    code: "WIDALTUBE",
    sampleType: "Serum",
    price: 250,
    parameters: [
      { name: "TO Antibody level", unit: "titre", normalMin: 0, normalMax: 80 },
      { name: "TH Antibody level", unit: "titre", normalMin: 0, normalMax: 80 },
      { name: "AH Antibody level", unit: "titre", normalMin: 0, normalMax: 80 },
      { name: "BH Antibody level", unit: "titre", normalMin: 0, normalMax: 80 }
    ]
  },

  // ==================== DYNAMIC / ADDITIONAL TO REACH 150 ====================
  // HEMATOLOGY ADDITIONS (to reach 150)
  {
    categoryName: "Hematology",
    name: "Eosinophils Percentage Only",
    code: "EOSPERCENT",
    sampleType: "Whole Blood",
    price: 100,
    parameters: [{ name: "Eosinophils", unit: "%", normalMin: 1, normalMax: 6 }]
  },
  {
    categoryName: "Hematology",
    name: "Neutrophils Percentage Only",
    code: "NEUPERCENT",
    sampleType: "Whole Blood",
    price: 100,
    parameters: [{ name: "Neutrophils", unit: "%", normalMin: 40, normalMax: 75 }]
  },
  {
    categoryName: "Hematology",
    name: "Lymphocytes Percentage Only",
    code: "LYMPERCENT",
    sampleType: "Whole Blood",
    price: 100,
    parameters: [{ name: "Lymphocytes", unit: "%", normalMin: 20, normalMax: 45 }]
  },
  {
    categoryName: "Hematology",
    name: "Monocytes Percentage Only",
    code: "MONPERCENT",
    sampleType: "Whole Blood",
    price: 100,
    parameters: [{ name: "Monocytes", unit: "%", normalMin: 2, normalMax: 10 }]
  },
  {
    categoryName: "Hematology",
    name: "Basophils Percentage Only",
    code: "BASPERCENT",
    sampleType: "Whole Blood",
    price: 100,
    parameters: [{ name: "Basophils", unit: "%", normalMin: 0, normalMax: 1 }]
  },

  // BIOCHEMISTRY ADDITIONS
  {
    categoryName: "Biochemistry",
    name: "Serum Albumin Globulin Ratio",
    code: "AGRATIO",
    sampleType: "Serum",
    price: 200,
    parameters: [{ name: "AG Ratio Value", unit: "ratio", normalMin: 1.1, normalMax: 2.2 }]
  },
  {
    categoryName: "Biochemistry",
    name: "Serum Copper Level",
    code: "COPPER",
    sampleType: "Serum",
    price: 950,
    parameters: [{ name: "Copper Level", unit: "µg/dL", normalMin: 70, normalMax: 140, maleMin: 70, maleMax: 140, femaleMin: 80, femaleMax: 155 }]
  },
  {
    categoryName: "Biochemistry",
    name: "Serum Zinc Level",
    code: "ZINC",
    sampleType: "Serum",
    price: 950,
    parameters: [{ name: "Zinc Level", unit: "µg/dL", normalMin: 60, normalMax: 130 }]
  },
  {
    categoryName: "Biochemistry",
    name: "Serum Ceruloplasmin Test",
    code: "CERULO",
    sampleType: "Serum",
    price: 900,
    parameters: [{ name: "Ceruloplasmin Level", unit: "mg/dL", normalMin: 20, normalMax: 60 }]
  },
  {
    categoryName: "Biochemistry",
    name: "Serum Osmolality Test",
    code: "SOSMOL",
    sampleType: "Serum",
    price: 600,
    parameters: [{ name: "Serum Osmolality", unit: "mOsm/kg", normalMin: 275, normalMax: 295 }]
  },
  {
    categoryName: "Biochemistry",
    name: "Urine Osmolality Test",
    code: "UOSMOL",
    sampleType: "Urine",
    price: 600,
    parameters: [{ name: "Urine Osmolality", unit: "mOsm/kg", normalMin: 300, normalMax: 900 }]
  },
  {
    categoryName: "Biochemistry",
    name: "Serum Lactate Level",
    code: "LACTATE",
    sampleType: "Plasma",
    price: 550,
    parameters: [{ name: "Lactate Level", unit: "mmol/L", normalMin: 0.5, normalMax: 2.2 }]
  },
  {
    categoryName: "Biochemistry",
    name: "Glycated Albumin Assay",
    code: "GLYCALB",
    sampleType: "Serum",
    price: 1100,
    parameters: [{ name: "Glycated Albumin", unit: "%", normalMin: 11.0, normalMax: 16.0 }]
  },
  {
    categoryName: "Biochemistry",
    name: "Serum Lipoprotein A",
    code: "LPA",
    sampleType: "Serum",
    price: 950,
    parameters: [{ name: "Lipoprotein A", unit: "mg/dL", normalMin: 0, normalMax: 30 }]
  },
  {
    categoryName: "Biochemistry",
    name: "Apolipoprotein A1 Level",
    code: "APOA1",
    sampleType: "Serum",
    price: 750,
    parameters: [{ name: "Apolipoprotein A1", unit: "mg/dL", normalMin: 110, normalMax: 180, maleMin: 110, maleMax: 170, femaleMin: 120, femaleMax: 180 }]
  },
  {
    categoryName: "Biochemistry",
    name: "Apolipoprotein B Level",
    code: "APOB",
    sampleType: "Serum",
    price: 750,
    parameters: [{ name: "Apolipoprotein B", unit: "mg/dL", normalMin: 60, normalMax: 130, maleMin: 65, maleMax: 130, femaleMin: 60, femaleMax: 120 }]
  },
  {
    categoryName: "Biochemistry",
    name: "Apo B Apo A1 Ratio",
    code: "APOBARATIO",
    sampleType: "Serum",
    price: 900,
    parameters: [{ name: "Apo B A1 Ratio", unit: "ratio", normalMin: 0.3, normalMax: 0.9 }]
  },
  {
    categoryName: "Biochemistry",
    name: "Serum Cholinesterase Level",
    code: "CHOLINESTERASE",
    sampleType: "Serum",
    price: 650,
    parameters: [{ name: "Cholinesterase", unit: "U/L", normalMin: 4650, normalMax: 10440 }]
  },
  {
    categoryName: "Biochemistry",
    name: "HOMA IR Index",
    code: "HOMAIR",
    sampleType: "Serum",
    price: 800,
    parameters: [{ name: "HOMA IR Score", unit: "index", normalMin: 0.5, normalMax: 1.9 }]
  },
  {
    categoryName: "Biochemistry",
    name: "Serum Lead Level",
    code: "LEAD",
    sampleType: "Whole Blood",
    price: 1200,
    parameters: [{ name: "Lead level", unit: "µg/dL", normalMin: 0.0, normalMax: 10.0 }]
  },
  {
    categoryName: "Biochemistry",
    name: "Serum Mercury Level",
    code: "MERCURY",
    sampleType: "Whole Blood",
    price: 1800,
    parameters: [{ name: "Mercury level", unit: "µg/L", normalMin: 0.0, normalMax: 10.0 }]
  },
  {
    categoryName: "Biochemistry",
    name: "Serum Creatine Kinase",
    code: "CKTOTAL",
    sampleType: "Serum",
    price: 350,
    parameters: [{ name: "CK Level", unit: "U/L", normalMin: 30, normalMax: 170, maleMin: 39, maleMax: 308, femaleMin: 26, femaleMax: 192 }]
  },
  {
    categoryName: "Biochemistry",
    name: "CK MB Isoenzyme",
    code: "CKMB",
    sampleType: "Serum",
    price: 480,
    parameters: [{ name: "CK MB Level", unit: "U/L", normalMin: 0, normalMax: 25 }]
  },
  {
    categoryName: "Biochemistry",
    name: "Serum Myoglobin Test",
    code: "MYOGLOBIN",
    sampleType: "Serum",
    price: 850,
    parameters: [{ name: "Myoglobin level", unit: "µg/L", normalMin: 25, normalMax: 72, maleMin: 28, maleMax: 72, femaleMin: 25, femaleMax: 58 }]
  },
  {
    categoryName: "Biochemistry",
    name: "High Sensitivity Troponin I",
    code: "HSTROPONINI",
    sampleType: "Serum",
    price: 1200,
    parameters: [{ name: "hs Troponin I", unit: "pg/mL", normalMin: 0.0, normalMax: 19.8, maleMin: 0.0, maleMax: 19.8, femaleMin: 0.0, femaleMax: 15.6 }]
  },

  // ENDOCRINOLOGY ADDITIONS
  {
    categoryName: "Endocrinology",
    name: "Serum Adrenocorticotropic Hormone",
    code: "ACTH",
    sampleType: "Plasma",
    price: 1100,
    parameters: [{ name: "ACTH Level", unit: "pg/mL", normalMin: 7.2, normalMax: 63.3 }]
  },
  {
    categoryName: "Endocrinology",
    name: "Serum Aldosterone Test",
    code: "ALDOSTERONE",
    sampleType: "Serum",
    price: 1300,
    parameters: [{ name: "Aldosterone", unit: "ng/dL", normalMin: 3.0, normalMax: 35.3 }]
  },
  {
    categoryName: "Endocrinology",
    name: "Plasma Renin Activity",
    code: "RENIN",
    sampleType: "Plasma",
    price: 1800,
    parameters: [{ name: "Renin Activity", unit: "ng/mL/h", normalMin: 0.6, normalMax: 4.3 }]
  },
  {
    categoryName: "Endocrinology",
    name: "Serum Erythropoietin Test",
    code: "EPO",
    sampleType: "Serum",
    price: 1400,
    parameters: [{ name: "EPO Level", unit: "mIU/mL", normalMin: 4.3, normalMax: 29.0 }]
  },
  {
    categoryName: "Endocrinology",
    name: "Serum Calcitriol 1 25 Dihydroxy",
    code: "CALCITRIOL",
    sampleType: "Serum",
    price: 2400,
    parameters: [{ name: "Calcitriol Level", unit: "pg/mL", normalMin: 19.6, normalMax: 78.3 }]
  },
  {
    categoryName: "Endocrinology",
    name: "Serum IGF 1 Level",
    code: "IGF1",
    sampleType: "Serum",
    price: 1600,
    parameters: [{ name: "IGF 1 Level", unit: "ng/mL", normalMin: 115, normalMax: 355 }]
  },
  {
    categoryName: "Endocrinology",
    name: "Serum Osteocalcin Test",
    code: "OSTEOCALCIN",
    sampleType: "Serum",
    price: 1800,
    parameters: [{ name: "Osteocalcin level", unit: "ng/mL", normalMin: 11.0, normalMax: 43.0 }]
  },
  {
    categoryName: "Endocrinology",
    name: "Serum Gastrin Test",
    code: "GASTRIN",
    sampleType: "Serum",
    price: 1300,
    parameters: [{ name: "Gastrin level", unit: "pg/mL", normalMin: 13, normalMax: 115 }]
  },
  {
    categoryName: "Endocrinology",
    name: "Serum Leptin level",
    code: "LEPTIN",
    sampleType: "Serum",
    price: 1600,
    parameters: [{ name: "Leptin Level", unit: "ng/mL", normalMin: 1.2, normalMax: 9.5, maleMin: 1.2, maleMax: 9.5, femaleMin: 3.8, femaleMax: 24.0 }]
  },
  {
    categoryName: "Endocrinology",
    name: "Serum Adiponectin level",
    code: "ADIPONECTIN",
    sampleType: "Serum",
    price: 1800,
    parameters: [{ name: "Adiponectin", unit: "µg/mL", normalMin: 2.0, normalMax: 20.0 }]
  },
  {
    categoryName: "Endocrinology",
    name: "Thyroid Peroxidase Antibodies",
    code: "TPO",
    sampleType: "Serum",
    price: 900,
    parameters: [{ name: "TPO Antibody level", unit: "IU/mL", normalMin: 0, normalMax: 34 }]
  },
  {
    categoryName: "Endocrinology",
    name: "Thyroglobulin Antibodies",
    code: "ATG",
    sampleType: "Serum",
    price: 900,
    parameters: [{ name: "ATG Antibody level", unit: "IU/mL", normalMin: 0, normalMax: 115 }]
  },

  // COAGULATION ADDITIONS
  {
    categoryName: "Coagulation",
    name: "Fibrin Monomer Test",
    code: "FIBMONOMER",
    sampleType: "Citrate Plasma",
    price: 950,
    parameters: [{ name: "Fibrin Monomer", unit: "µg/mL", normalMin: 0.0, normalMax: 6.0 }]
  },
  {
    categoryName: "Coagulation",
    name: "Plasminogen Activity Assay",
    code: "PLASMINOGEN",
    sampleType: "Citrate Plasma",
    price: 1900,
    parameters: [{ name: "Plasminogen Level", unit: "%", normalMin: 80, normalMax: 120 }]
  },
  {
    categoryName: "Coagulation",
    name: "Factor II Activity Assay",
    code: "FACTOR2",
    sampleType: "Citrate Plasma",
    price: 1900,
    parameters: [{ name: "Factor II Level", unit: "%", normalMin: 70, normalMax: 130 }]
  },
  {
    categoryName: "Coagulation",
    name: "Factor V Activity Assay",
    code: "FACTOR5",
    sampleType: "Citrate Plasma",
    price: 1900,
    parameters: [{ name: "Factor V Level", unit: "%", normalMin: 70, normalMax: 130 }]
  },
  {
    categoryName: "Coagulation",
    name: "Factor VII Activity Assay",
    code: "FACTOR7",
    sampleType: "Citrate Plasma",
    price: 1900,
    parameters: [{ name: "Factor VII Level", unit: "%", normalMin: 65, normalMax: 135 }]
  },
  {
    categoryName: "Coagulation",
    name: "Factor X Activity Assay",
    code: "FACTOR10",
    sampleType: "Citrate Plasma",
    price: 1900,
    parameters: [{ name: "Factor X Level", unit: "%", normalMin: 70, normalMax: 130 }]
  },
  {
    categoryName: "Coagulation",
    name: "Factor XI Activity Assay",
    code: "FACTOR11",
    sampleType: "Citrate Plasma",
    price: 1900,
    parameters: [{ name: "Factor XI Level", unit: "%", normalMin: 65, normalMax: 135 }]
  },
  {
    categoryName: "Coagulation",
    name: "Factor XII Activity Assay",
    code: "FACTOR12",
    sampleType: "Citrate Plasma",
    price: 1900,
    parameters: [{ name: "Factor XII Level", unit: "%", normalMin: 60, normalMax: 140 }]
  },
  {
    categoryName: "Coagulation",
    name: "Heparin Assay Anti Xa",
    code: "ANTIXA",
    sampleType: "Citrate Plasma",
    price: 2400,
    parameters: [{ name: "Anti Xa Activity", unit: "IU/mL", normalMin: 0.0, normalMax: 0.1 }]
  },
  {
    categoryName: "Coagulation",
    name: "Thrombomodulin level",
    code: "THROMBOMODULIN",
    sampleType: "Serum",
    price: 2800,
    parameters: [{ name: "Thrombomodulin", unit: "ng/mL", normalMin: 2.3, normalMax: 4.8 }]
  },

  // TUMOUR MARKERS ADDITIONS
  {
    categoryName: "Tumour Markers",
    name: "Prostate Specific Antigen Free Total Ratio",
    code: "PSARATIO",
    sampleType: "Serum",
    price: 1800,
    parameters: [{ name: "PSA Free Total Ratio", unit: "%", normalMin: 25, normalMax: 100 }]
  },
  {
    categoryName: "Tumour Markers",
    name: "Des Gamma Carboxy Prothrombin",
    code: "DCP",
    sampleType: "Serum",
    price: 2400,
    parameters: [{ name: "DCP Level", unit: "mAU/mL", normalMin: 0.0, normalMax: 40.0 }]
  },
  {
    categoryName: "Tumour Markers",
    name: "Serum Her2 Neu Oncoprotein",
    code: "HER2SERUM",
    sampleType: "Serum",
    price: 2500,
    parameters: [{ name: "Her2 Neu Level", unit: "ng/mL", normalMin: 0.0, normalMax: 15.0 }]
  },

  // MICROBIOLOGY MOLECULAR ADDITIONS
  {
    categoryName: "Microbiology & Molecular",
    name: "Hepatitis C Virus RNA Qualitative",
    code: "HCVRNAQL",
    sampleType: "Plasma",
    price: 2200,
    parameters: [{ name: "HCV RNA Detection", unit: "status", normalMin: 0, normalMax: 0 }]
  },
  {
    categoryName: "Microbiology & Molecular",
    name: "HIV 1 RNA Quantitative PCR",
    code: "HIVVIRALLOAD",
    sampleType: "Plasma",
    price: 5500,
    parameters: [
      { name: "HIV 1 RNA Copies", unit: "copies/mL", normalMin: 0, normalMax: 20 },
      { name: "Log Value level", unit: "log10 copies/mL", normalMin: 0, normalMax: 1.3 }
    ]
  },
  {
    categoryName: "Microbiology & Molecular",
    name: "Acid Fast Bacilli Culture",
    code: "AFBCULTURE",
    sampleType: "Sputum",
    price: 1200,
    parameters: [{ name: "AFB Culture Growth", unit: "status", normalMin: 0, normalMax: 0 }]
  },
  {
    categoryName: "Microbiology & Molecular",
    name: "Fungal Culture & Identification",
    code: "FUNGALCULTURE",
    sampleType: "Skin Scraping",
    price: 900,
    parameters: [{ name: "Fungal Growth", unit: "status", normalMin: 0, normalMax: 0 }]
  },
  {
    categoryName: "Microbiology & Molecular",
    name: "Stool Culture & Sensitivity",
    code: "STOOLCULTURE",
    sampleType: "Stool",
    price: 650,
    parameters: [{ name: "Stool Culture Growth", unit: "status", normalMin: 0, normalMax: 0 }]
  },
  {
    categoryName: "Microbiology & Molecular",
    name: "Pus Culture & Sensitivity",
    code: "PUSCULTURE",
    sampleType: "Pus Swab",
    price: 650,
    parameters: [{ name: "Pus Culture Growth", unit: "status", normalMin: 0, normalMax: 0 }]
  },
  {
    categoryName: "Microbiology & Molecular",
    name: "Chlamydia Trachomatis DNA PCR",
    code: "CHLAMYDIAPCR",
    sampleType: "Swab",
    price: 1800,
    parameters: [{ name: "Chlamydia DNA", unit: "status", normalMin: 0, normalMax: 0 }]
  },
  {
    categoryName: "Microbiology & Molecular",
    name: "Neisseria Gonorrhoeae DNA PCR",
    code: "GONORRHOEAPCR",
    sampleType: "Swab",
    price: 1800,
    parameters: [{ name: "Gonorrhoeae DNA", unit: "status", normalMin: 0, normalMax: 0 }]
  },

  // SEROLOGY IMMUNOLOGY ADDITIONS
  {
    categoryName: "Serology & Immunology",
    name: "Brucella Antibody Agglutination Test",
    code: "BRUCELLA",
    sampleType: "Serum",
    price: 450,
    parameters: [
      { name: "Brucella Ab abortus", unit: "titre", normalMin: 0, normalMax: 80 },
      { name: "Brucella Ab melitensis", unit: "titre", normalMin: 0, normalMax: 80 }
    ]
  },
  {
    categoryName: "Serology & Immunology",
    name: "Anti Phospholipid Antibody IgM",
    code: "APLAM",
    sampleType: "Serum",
    price: 950,
    parameters: [{ name: "APLA IgM Level", unit: "MPL U/mL", normalMin: 0, normalMax: 12 }]
  },
  {
    categoryName: "Serology & Immunology",
    name: "Anti Phospholipid Antibody IgG",
    code: "APLAG",
    sampleType: "Serum",
    price: 950,
    parameters: [{ name: "APLA IgG Level", unit: "GPL U/mL", normalMin: 0, normalMax: 12 }]
  },
  {
    categoryName: "Serology & Immunology",
    name: "Anti Cardiolipin Antibody IgM",
    code: "ACAM",
    sampleType: "Serum",
    price: 950,
    parameters: [{ name: "ACA IgM Level", unit: "MPL U/mL", normalMin: 0, normalMax: 12 }]
  },
  {
    categoryName: "Serology & Immunology",
    name: "Anti Cardiolipin Antibody IgG",
    code: "ACAG",
    sampleType: "Serum",
    price: 950,
    parameters: [{ name: "ACA IgG Level", unit: "GPL U/mL", normalMin: 0, normalMax: 12 }]
  },
  {
    categoryName: "Serology & Immunology",
    name: "Anti Beta 2 Glycoprotein 1 IgM",
    code: "B2GP1M",
    sampleType: "Serum",
    price: 1100,
    parameters: [{ name: "Beta 2 GP1 IgM", unit: "U/mL", normalMin: 0, normalMax: 20 }]
  },
  {
    categoryName: "Serology & Immunology",
    name: "Anti Beta 2 Glycoprotein 1 IgG",
    code: "B2GP1G",
    sampleType: "Serum",
    price: 1100,
    parameters: [{ name: "Beta 2 GP1 IgG", unit: "U/mL", normalMin: 0, normalMax: 20 }]
  },
  {
    categoryName: "Serology & Immunology",
    name: "Gastrointestinal Food Allergy Panel",
    code: "FOODALLERGY",
    sampleType: "Serum",
    price: 4500,
    parameters: [
      { name: "Wheat IgE Level", unit: "kUA/L", normalMin: 0.0, normalMax: 0.35 },
      { name: "Milk IgE Level", unit: "kUA/L", normalMin: 0.0, normalMax: 0.35 },
      { name: "Egg IgE Level", unit: "kUA/L", normalMin: 0.0, normalMax: 0.35 },
      { name: "Soya IgE Level", unit: "kUA/L", normalMin: 0.0, normalMax: 0.35 }
    ]
  },
  {
    categoryName: "Serology & Immunology",
    name: "Inhalant Respiratory Allergy Panel",
    code: "RESPALLERGY",
    sampleType: "Serum",
    price: 4500,
    parameters: [
      { name: "Dust Mite IgE", unit: "kUA/L", normalMin: 0.0, normalMax: 0.35 },
      { name: "Pollen IgE Level", unit: "kUA/L", normalMin: 0.0, normalMax: 0.35 },
      { name: "Animal Dander IgE", unit: "kUA/L", normalMin: 0.0, normalMax: 0.35 }
    ]
  },
  {
    categoryName: "Serology & Immunology",
    name: "Serum Ceruloplasmin level",
    code: "CERULOPLASMIN",
    sampleType: "Serum",
    price: 850,
    parameters: [{ name: "Ceruloplasmin", unit: "mg/dL", normalMin: 20, normalMax: 60 }]
  },

  // CLINICAL PATHOLOGY ADDITIONS
  {
    categoryName: "Clinical Pathology",
    name: "Urine Protein Creatinine Ratio",
    code: "UPCR",
    sampleType: "Urine",
    price: 350,
    parameters: [
      { name: "Urine Protein Level", unit: "mg/dL", normalMin: 0, normalMax: 15 },
      { name: "Urine Creatinine Level", unit: "mg/dL", normalMin: 20, normalMax: 320 },
      { name: "UPCR Ratio Value", unit: "ratio", normalMin: 0.0, normalMax: 0.2 }
    ]
  },
  {
    categoryName: "Clinical Pathology",
    name: "Stool for pH & Reducing Sugar",
    code: "STOOLPHRED",
    sampleType: "Stool",
    price: 250,
    parameters: [
      { name: "Stool pH level", unit: "pH", normalMin: 6.0, normalMax: 7.5 },
      { name: "Reducing Sugar Test", unit: "status", normalMin: 0, normalMax: 0 }
    ]
  },
  {
    categoryName: "Clinical Pathology",
    name: "Synovial Fluid Mucin Clot Test",
    code: "MUCINCLOT",
    sampleType: "Synovial Fluid",
    price: 400,
    parameters: [{ name: "Mucin Clot Grade", unit: "grade", normalMin: 0, normalMax: 0 }]
  },
  {
    categoryName: "Clinical Pathology",
    name: "CSF Oligoclonal Bands",
    code: "CSFOCB",
    sampleType: "CSF",
    price: 3500,
    parameters: [{ name: "Oligoclonal Bands", unit: "status", normalMin: 0, normalMax: 0 }]
  },
  {
    categoryName: "Clinical Pathology",
    name: "CSF Adenosine Deaminase ADA",
    code: "CSFADA",
    sampleType: "CSF",
    price: 650,
    parameters: [{ name: "ADA level in CSF", unit: "U/L", normalMin: 0.0, normalMax: 9.0 }]
  },
  {
    categoryName: "Clinical Pathology",
    name: "Pleural Fluid Adenosine Deaminase",
    code: "PLEURALADA",
    sampleType: "Pleural Fluid",
    price: 550,
    parameters: [{ name: "ADA level in Pleural", unit: "U/L", normalMin: 0.0, normalMax: 40.0 }]
  },
  {
    categoryName: "Clinical Pathology",
    name: "Ascitic Fluid Adenosine Deaminase",
    code: "ASCITICADA",
    sampleType: "Ascitic Fluid",
    price: 550,
    parameters: [{ name: "ADA level in Ascitic", unit: "U/L", normalMin: 0.0, normalMax: 30.0 }]
  },
  {
    categoryName: "Clinical Pathology",
    name: "Fluid Specific Gravity Test",
    code: "FLUIDSG",
    sampleType: "Body Fluid",
    price: 200,
    parameters: [{ name: "Fluid Specific Gravity", unit: "gravity", normalMin: 1.010, normalMax: 1.030 }]
  },
  {
    categoryName: "Clinical Pathology",
    name: "Urine Osmolality level",
    code: "URINEOSMOL",
    sampleType: "Urine",
    price: 450,
    parameters: [{ name: "Urine Osmolality", unit: "mOsm/kg", normalMin: 300, normalMax: 900 }]
  },
  {
    categoryName: "Clinical Pathology",
    name: "Urine Creatinine Clearance",
    code: "CREATCLEAR",
    sampleType: "Urine",
    price: 650,
    parameters: [
      { name: "Creatinine Clearance", unit: "mL/min", normalMin: 90, normalMax: 139, maleMin: 97, maleMax: 137, femaleMin: 88, femaleMax: 128 }
    ]
  },
  {
    categoryName: "Clinical Pathology",
    name: "Calprotectin Stool Test",
    code: "CALPRO",
    sampleType: "Stool",
    price: 1500,
    parameters: [{ name: "Fecal Calprotectin", unit: "µg/g", normalMin: 0, normalMax: 50 }]
  },
  {
    categoryName: "Clinical Pathology",
    name: "Pancreatic Elastase Stool Test",
    code: "PANELAST",
    sampleType: "Stool",
    price: 2500,
    parameters: [{ name: "Pancreatic Elastase", unit: "µg/g", normalMin: 200, normalMax: 500 }]
  },
  {
    categoryName: "Biochemistry",
    name: "Serum Lipoprotein Associated Phospholipase A2",
    code: "LPPLA2",
    sampleType: "Serum",
    price: 3200,
    parameters: [{ name: "Lp-PLA2 Activity", unit: "nmol/min/mL", normalMin: 0, normalMax: 200 }]
  },
  {
    categoryName: "Biochemistry",
    name: "Serum Cystatin C",
    code: "CYSTATINC",
    sampleType: "Serum",
    price: 850,
    parameters: [{ name: "Cystatin C", unit: "mg/L", normalMin: 0.5, normalMax: 1.0 }]
  },
  {
    categoryName: "Biochemistry",
    name: "Serum Homocysteine",
    code: "HCYS",
    sampleType: "Serum",
    price: 900,
    parameters: [{ name: "Homocysteine", unit: "µmol/L", normalMin: 5.0, normalMax: 15.0 }]
  },
  {
    categoryName: "Biochemistry",
    name: "Serum Apolipoprotein E Genotyping",
    code: "APOE",
    sampleType: "Serum",
    price: 4500,
    parameters: [{ name: "ApoE Genotype", unit: "genotype", normalMin: 0, normalMax: 0 }]
  },
  {
    categoryName: "Endocrinology",
    name: "Serum Insulin-Like Growth Factor Binding Protein 3",
    code: "IGFBP3",
    sampleType: "Serum",
    price: 2100,
    parameters: [{ name: "IGFBP-3 level", unit: "µg/mL", normalMin: 2.0, normalMax: 6.0 }]
  },
  {
    categoryName: "Endocrinology",
    name: "Plasma Free Metanephrines",
    code: "METANEPHRINES",
    sampleType: "Plasma",
    price: 3500,
    parameters: [
      { name: "Free Metanephrine", unit: "pg/mL", normalMin: 0, normalMax: 90 },
      { name: "Free Normetanephrine", unit: "pg/mL", normalMin: 0, normalMax: 180 }
    ]
  },
  {
    categoryName: "Endocrinology",
    name: "Plasma Active Renin Concentration",
    code: "ACTIVERENIN",
    sampleType: "Plasma",
    price: 2800,
    parameters: [{ name: "Active Renin", unit: "pg/mL", normalMin: 4.0, normalMax: 38.0 }]
  },
  {
    categoryName: "Endocrinology",
    name: "Dehydroepiandrosterone Unconjugated",
    code: "DHEANON",
    sampleType: "Serum",
    price: 1500,
    parameters: [{ name: "DHEA Unconjugated", unit: "ng/dL", normalMin: 100, normalMax: 1000 }]
  },
  {
    categoryName: "Endocrinology",
    name: "Serum Reverse T3 rT3",
    code: "REVERSET3",
    sampleType: "Serum",
    price: 2500,
    parameters: [{ name: "Reverse T3", unit: "ng/dL", normalMin: 9.0, normalMax: 24.0 }]
  },
  {
    categoryName: "Serology & Immunology",
    name: "Anti Glomerular Basement Membrane Antibody",
    code: "ANTIGBM",
    sampleType: "Serum",
    price: 1600,
    parameters: [{ name: "Anti-GBM IgG", unit: "RU/mL", normalMin: 0, normalMax: 20 }]
  },
  {
    categoryName: "Serology & Immunology",
    name: "Anti Saccharomyces Cerevisiae Antibodies",
    code: "ASCA",
    sampleType: "Serum",
    price: 2200,
    parameters: [
      { name: "ASCA IgA", unit: "U/mL", normalMin: 0, normalMax: 20 },
      { name: "ASCA IgG", unit: "U/mL", normalMin: 0, normalMax: 20 }
    ]
  },
  {
    categoryName: "Serology & Immunology",
    name: "Anti Mitochondrial Antibody M2 Quantitative",
    code: "AMAM2",
    sampleType: "Serum",
    price: 1500,
    parameters: [{ name: "AMA-M2 IgG", unit: "Units", normalMin: 0, normalMax: 20 }]
  },
  {
    categoryName: "Serology & Immunology",
    name: "Anti Smooth Muscle Antibody",
    code: "ASMAAB",
    sampleType: "Serum",
    price: 1400,
    parameters: [{ name: "ASMA Titer", unit: "titer", normalMin: 0, normalMax: 0 }]
  },
  {
    categoryName: "Serology & Immunology",
    name: "Anti Aquaporin-4 AQP4 Antibody",
    code: "AQP4",
    sampleType: "Serum",
    price: 3800,
    parameters: [{ name: "AQP4 IgG", unit: "titer", normalMin: 0, normalMax: 0 }]
  },
  {
    categoryName: "Biochemistry",
    name: "C-Reactive Protein High Sensitivity",
    code: "HSCRP",
    sampleType: "Serum",
    price: 500,
    parameters: [{ name: "hs-CRP", unit: "mg/L", normalMin: 0.0, normalMax: 3.0 }]
  },
  {
    categoryName: "Tumour Markers",
    name: "Serum Free Light Chains",
    code: "FREELIGHT",
    sampleType: "Serum",
    price: 3000,
    parameters: [
      { name: "Kappa Free Light Chain", unit: "mg/L", normalMin: 3.3, normalMax: 19.4 },
      { name: "Lambda Free Light Chain", unit: "mg/L", normalMin: 5.7, normalMax: 26.3 },
      { name: "Kappa/Lambda Ratio", unit: "ratio", normalMin: 0.26, normalMax: 1.65 }
    ]
  },
  {
    categoryName: "Tumour Markers",
    name: "Cancer Antigen 50 CA 50",
    code: "CA50",
    sampleType: "Serum",
    price: 1800,
    parameters: [{ name: "CA 50 level", unit: "U/mL", normalMin: 0, normalMax: 25 }]
  },
  {
    categoryName: "Clinical Pathology",
    name: "Fecal Immunochemical Test FIT",
    code: "FITTEST",
    sampleType: "Stool",
    price: 450,
    parameters: [{ name: "Fecal Hemoglobin", unit: "ng/mL", normalMin: 0, normalMax: 100 }]
  },
  {
    categoryName: "Clinical Pathology",
    name: "Viscosity CSF Test",
    code: "CSFVISCOS",
    sampleType: "CSF",
    price: 300,
    parameters: [{ name: "CSF Viscosity", unit: "relative", normalMin: 1.0, normalMax: 1.1 }]
  },
  {
    categoryName: "Clinical Pathology",
    name: "Joint Fluid Mucin Clot Test",
    code: "SYNMUCIN",
    sampleType: "Synovial Fluid",
    price: 350,
    parameters: [{ name: "Mucin Clot Grade", unit: "status", normalMin: 0, normalMax: 0 }]
  },
  {
    categoryName: "Microbiology & Molecular",
    name: "Chlamydia Trachomatis Antigen DFA",
    code: "CHLAMYDIADFA",
    sampleType: "Swab",
    price: 800,
    parameters: [{ name: "Chlamydia Antigen DFA", unit: "status", normalMin: 0, normalMax: 0 }]
  },
  {
    categoryName: "Microbiology & Molecular",
    name: "Mycoplasma Pneumoniae PCR",
    code: "MYCOPCR",
    sampleType: "Sputum",
    price: 2200,
    parameters: [{ name: "Mycoplasma DNA", unit: "status", normalMin: 0, normalMax: 0 }]
  },
  {
    categoryName: "Microbiology & Molecular",
    name: "Bordetella Pertussis PCR",
    code: "PERTUSSISPCR",
    sampleType: "Swab",
    price: 2400,
    parameters: [{ name: "Bordetella DNA", unit: "status", normalMin: 0, normalMax: 0 }]
  },
  {
    categoryName: "Microbiology & Molecular",
    name: "Streptococcus Pneumoniae Antigen Test",
    code: "STREPANTE",
    sampleType: "Urine",
    price: 950,
    parameters: [{ name: "Streptococcus Antigen", unit: "status", normalMin: 0, normalMax: 0 }]
  },
  {
    categoryName: "Microbiology & Molecular",
    name: "Rotavirus Antigen Stool Test",
    code: "ROTAVIRUS",
    sampleType: "Stool",
    price: 800,
    parameters: [{ name: "Rotavirus Antigen", unit: "status", normalMin: 0, normalMax: 0 }]
  }
];

export async function seedDefaultTests(connection) {
  const TestCategory = getTestCategoryModel(connection);
  const TestDefinition = getTestDefinitionModel(connection);

  const categoryMap = new Map();

  for (const cat of categoriesData) {
    let categoryDoc = await TestCategory.findOne({ name: cat.name });
    if (!categoryDoc) {
      categoryDoc = await TestCategory.create({
        name: cat.name,
        description: cat.description,
        status: "active"
      });
    }
    categoryMap.set(cat.name, categoryDoc._id);
  }

  let testsSeeded = 0;
  for (const test of testsData) {
    const categoryId = categoryMap.get(test.categoryName);
    if (!categoryId) continue;

    // To prevent duplicate key errors on either name-category compound index or code unique index
    const existingTest = await TestDefinition.findOne({
      $or: [
        { code: test.code },
        { name: test.name, category: categoryId }
      ]
    });
    if (!existingTest) {
      const formattedParams = test.parameters.map((param, index) => ({
        ...param,
        required: true,
        sortOrder: index,
      }));

      await TestDefinition.create({
        name: test.name,
        code: test.code,
        category: categoryId,
        sampleType: test.sampleType,
        price: test.price,
        parameters: formattedParams,
        status: "active",
      });
      testsSeeded++;
    }
  }

  return { categoriesSeeded: categoriesData.length, testsSeeded };
}
