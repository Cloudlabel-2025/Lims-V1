import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const repo = "G:/workspace-prod/Lims-V1";
const casePath = path.join(repo, "docs/.qa_release_package/lims_release_test_cases.json");
const outputDir = path.join(repo, "outputs/019ff072-f7be-74a3-8d6b-71f2a3a642cd");
const outputPath = path.join(outputDir, "LIMS_Three_Level_Release_Testing_Tracker.xlsx");
const previewDir = path.join(repo, "docs/.qa_release_package/workbook_previews");
const cases = JSON.parse(await fs.readFile(casePath, "utf8"));
const modules = [...new Set(cases.map((x) => x.Module))].sort();
const endRow = 5 + cases.length;

const wb = Workbook.create();
const dashboard = wb.worksheets.add("Release Dashboard");
const testCases = wb.worksheets.add("Test Cases");
const levelSummary = wb.worksheets.add("Level Summary");
const moduleSummary = wb.worksheets.add("Module Summary");
const defects = wb.worksheets.add("Defects");
const testRuns = wb.worksheets.add("Test Runs");
const rules = wb.worksheets.add("Lists & Rules");
const instructions = wb.worksheets.add("Instructions");

const colors = {
  navy: "#163A5F", blue: "#2E74B5", lightBlue: "#E8F1F8", pale: "#F4F6F9",
  gray: "#64748B", border: "#D5DEE8", white: "#FFFFFF", yellow: "#FFF6CC",
  green: "#DCFCE7", greenText: "#166534", red: "#FEE2E2", redText: "#991B1B",
  amber: "#FEF3C7", amberText: "#92400E", purple: "#EDE9FE", purpleText: "#5B21B6",
};

function title(sheet, range, text, subtitle) {
  sheet.mergeCells(range);
  const r = sheet.getRange(range);
  r.values = [[text]];
  r.format = { fill: colors.navy, font: { bold: true, color: colors.white, size: 20 }, verticalAlignment: "center", horizontalAlignment: "left" };
  r.format.rowHeight = 34;
  if (subtitle) {
    const row = Number(range.match(/\d+/)?.[0] || 1) + 1;
    sheet.mergeCells(`A${row}:H${row}`);
    const s = sheet.getRange(`A${row}:H${row}`);
    s.values = [[subtitle]];
    s.format = { fill: colors.lightBlue, font: { color: colors.navy, italic: true, size: 10 }, wrapText: true };
    s.format.rowHeight = 28;
  }
}

function headerFormat(range) {
  range.format = {
    fill: colors.blue,
    font: { bold: true, color: colors.white },
    verticalAlignment: "center",
    wrapText: true,
    borders: { preset: "outside", style: "thin", color: colors.navy },
  };
  range.format.rowHeight = 30;
}

function sectionHeader(range) {
  range.format = { fill: colors.lightBlue, font: { bold: true, color: colors.navy }, wrapText: true };
}

for (const s of [dashboard, testCases, levelSummary, moduleSummary, defects, testRuns, rules, instructions]) {
  s.showGridLines = false;
}

// TEST CASES
const headers = [
  "Case ID", "Level", "Module", "Submodule", "Scenario", "Test Type", "Role", "Priority",
  "Release Gate", "Gap Covered", "Preconditions", "Test Data", "Steps", "Expected Result",
  "Status", "Actual Result", "Defect ID", "Defect Severity", "Defect Status", "Tester", "Environment",
  "Build", "Execution Date", "Evidence Link", "Retest Status", "Comments",
  "Executed Flag", "Pass Flag", "Open Blocker", "Evidence Flag", "Gap Flag",
];
title(testCases, "A1:H1", "LIMS CONSOLIDATED TEST CASE REGISTER", "Enter results only in the yellow columns. Dashboard and summaries update from formulas.");
testCases.getRange("A3:O3").merge();
testCases.getRange("A3:O3").values = [["Levels: 1 = core flow | 2 = detailed functional/integration/gaps | 3 = market-readiness release gate"]];
testCases.getRange("A3:O3").format = { fill: colors.pale, font: { bold: true, color: colors.navy }, wrapText: true };
testCases.getRange("A5:AE5").values = [headers];
headerFormat(testCases.getRange("A5:AE5"));

const rows = cases.map((c) => headers.slice(0, 26).map((h) => c[h] ?? ""));
testCases.getRange(`A6:Z${endRow}`).values = rows;
testCases.getRange(`AA6`).formulas = [[`=IF(OR(O6="Passed",O6="Failed",O6="Blocked"),1,0)`]];
testCases.getRange(`AA6:AA${endRow}`).fillDown();
testCases.getRange(`AB6`).formulas = [[`=IF(O6="Passed",1,0)`]];
testCases.getRange(`AB6:AB${endRow}`).fillDown();
testCases.getRange(`AC6`).formulas = [[`=IF(AND(OR(R6="Critical",R6="High"),OR(O6="Failed",O6="Blocked"),S6<>"Closed",S6<>"Rejected"),1,0)`]];
testCases.getRange(`AC6:AC${endRow}`).fillDown();
testCases.getRange(`AD6`).formulas = [[`=IF(X6<>"",1,0)`]];
testCases.getRange(`AD6:AD${endRow}`).fillDown();
testCases.getRange(`AE6`).formulas = [[`=IF(J6<>"",1,0)`]];
testCases.getRange(`AE6:AE${endRow}`).fillDown();

testCases.getRange(`A6:N${endRow}`).format = { verticalAlignment: "top", wrapText: true };
testCases.getRange(`O6:Z${endRow}`).format = { fill: colors.yellow, verticalAlignment: "top", wrapText: true };
testCases.getRange(`AA6:AE${endRow}`).format = { fill: colors.pale, font: { color: colors.gray }, numberFormat: "0" };
testCases.getRange(`W6:W${endRow}`).format.numberFormat = "yyyy-mm-dd";
testCases.freezePanes.freezeRows(5);
testCases.freezePanes.freezeColumns(4);

const widths = {
  A: 12, B: 11, C: 24, D: 16, E: 32, F: 15, G: 22, H: 11, I: 12, J: 30,
  K: 32, L: 28, M: 55, N: 42, O: 12, P: 34, Q: 14, R: 14, S: 14, T: 18,
  U: 14, V: 14, W: 14, X: 30, Y: 15, Z: 32, AA: 11, AB: 9, AC: 12, AD: 12, AE: 10,
};
for (const [col, width] of Object.entries(widths)) testCases.getRange(`${col}:${col}`).format.columnWidth = width;

testCases.getRange(`O6:O${endRow}`).dataValidation = { rule: { type: "list", values: ["Not Run", "Passed", "Failed", "Blocked", "N/A"] } };
testCases.getRange(`R6:R${endRow}`).dataValidation = { rule: { type: "list", values: ["", "Critical", "High", "Medium", "Low"] } };
testCases.getRange(`S6:S${endRow}`).dataValidation = { rule: { type: "list", values: ["", "Open", "In Progress", "Fixed", "Closed", "Rejected", "Deferred"] } };
testCases.getRange(`U6:U${endRow}`).dataValidation = { rule: { type: "list", values: ["QA", "UAT", "Staging", "Production-like"] } };
testCases.getRange(`Y6:Y${endRow}`).dataValidation = { rule: { type: "list", values: ["Not Required", "Pending", "Passed", "Failed"] } };

const statusRange = testCases.getRange(`O6:O${endRow}`);
statusRange.conditionalFormats.add("containsText", { text: "Passed", format: { fill: colors.green, font: { color: colors.greenText, bold: true } } });
statusRange.conditionalFormats.add("containsText", { text: "Failed", format: { fill: colors.red, font: { color: colors.redText, bold: true } } });
statusRange.conditionalFormats.add("containsText", { text: "Blocked", format: { fill: colors.amber, font: { color: colors.amberText, bold: true } } });
statusRange.conditionalFormats.add("containsText", { text: "Not Run", format: { fill: colors.pale, font: { color: colors.gray } } });
testCases.getRange(`AC6:AC${endRow}`).conditionalFormats.add("cellIs", { operator: "equal", formula: 1, format: { fill: colors.red, font: { color: colors.redText, bold: true } } });

const casesTable = testCases.tables.add(`A5:AE${endRow}`, true, "LimsTestCases");
casesTable.style = "TableStyleMedium2";
casesTable.showFilterButton = true;
casesTable.showBandedRows = true;

// LEVEL SUMMARY
title(levelSummary, "A1:M1", "LEVEL SUMMARY", "Formula-driven execution, pass, evidence and blocker metrics.");
levelSummary.getRange("A5:M5").values = [["Level", "Total", "Executed", "Passed", "Failed", "Blocked", "N/A", "Execution %", "Pass %", "Gate Cases", "Gate Evidence", "Evidence %", "Open C/H"]];
headerFormat(levelSummary.getRange("A5:M5"));
levelSummary.getRange("A6:A8").values = [["Level 1"], ["Level 2"], ["Level 3"]];
for (let r = 6; r <= 8; r++) {
  levelSummary.getRange(`B${r}:M${r}`).formulas = [[
    `=COUNTIF('Test Cases'!$B$6:$B$${endRow},A${r})`,
    `=SUMIF('Test Cases'!$B$6:$B$${endRow},A${r},'Test Cases'!$AA$6:$AA$${endRow})`,
    `=SUMIF('Test Cases'!$B$6:$B$${endRow},A${r},'Test Cases'!$AB$6:$AB$${endRow})`,
    `=COUNTIFS('Test Cases'!$B$6:$B$${endRow},A${r},'Test Cases'!$O$6:$O$${endRow},"Failed")`,
    `=COUNTIFS('Test Cases'!$B$6:$B$${endRow},A${r},'Test Cases'!$O$6:$O$${endRow},"Blocked")`,
    `=COUNTIFS('Test Cases'!$B$6:$B$${endRow},A${r},'Test Cases'!$O$6:$O$${endRow},"N/A")`,
    `=IFERROR(C${r}/(B${r}-G${r}),0)`,
    `=IFERROR(D${r}/C${r},0)`,
    `=COUNTIFS('Test Cases'!$B$6:$B$${endRow},A${r},'Test Cases'!$I$6:$I$${endRow},"Yes")`,
    `=SUMIFS('Test Cases'!$AD$6:$AD$${endRow},'Test Cases'!$B$6:$B$${endRow},A${r},'Test Cases'!$I$6:$I$${endRow},"Yes")`,
    `=IFERROR(K${r}/J${r},0)`,
    `=SUMIF('Test Cases'!$B$6:$B$${endRow},A${r},'Test Cases'!$AC$6:$AC$${endRow})`,
  ]];
}
levelSummary.getRange("H6:I8").format.numberFormat = "0%";
levelSummary.getRange("L6:L8").format.numberFormat = "0%";
levelSummary.getRange("A6:M8").format = { borders: { preset: "inside", style: "thin", color: colors.border } };
levelSummary.getRange("A:A").format.columnWidth = 14;
levelSummary.getRange("B:M").format.columnWidth = 13;
levelSummary.freezePanes.freezeRows(5);

// MODULE SUMMARY
title(moduleSummary, "A1:I1", "MODULE SUMMARY", "Use this sheet to find modules with low execution, failures, blockers or gaps.");
moduleSummary.getRange("A5:I5").values = [["Module", "Total", "Executed", "Passed", "Failed", "Blocked", "Execution %", "Pass %", "Gap Cases"]];
headerFormat(moduleSummary.getRange("A5:I5"));
moduleSummary.getRange(`A6:A${5 + modules.length}`).values = modules.map((m) => [m]);
for (let r = 6; r <= 5 + modules.length; r++) {
  moduleSummary.getRange(`B${r}:I${r}`).formulas = [[
    `=COUNTIF('Test Cases'!$C$6:$C$${endRow},A${r})`,
    `=SUMIF('Test Cases'!$C$6:$C$${endRow},A${r},'Test Cases'!$AA$6:$AA$${endRow})`,
    `=SUMIF('Test Cases'!$C$6:$C$${endRow},A${r},'Test Cases'!$AB$6:$AB$${endRow})`,
    `=COUNTIFS('Test Cases'!$C$6:$C$${endRow},A${r},'Test Cases'!$O$6:$O$${endRow},"Failed")`,
    `=COUNTIFS('Test Cases'!$C$6:$C$${endRow},A${r},'Test Cases'!$O$6:$O$${endRow},"Blocked")`,
    `=IFERROR(C${r}/B${r},0)`, `=IFERROR(D${r}/C${r},0)`,
    `=SUMIF('Test Cases'!$C$6:$C$${endRow},A${r},'Test Cases'!$AE$6:$AE$${endRow})`,
  ]];
}
moduleSummary.getRange(`G6:H${5 + modules.length}`).format.numberFormat = "0%";
moduleSummary.getRange("A:A").format.columnWidth = 40;
moduleSummary.getRange("B:I").format.columnWidth = 13;
moduleSummary.freezePanes.freezeRows(5);
moduleSummary.getRange(`G6:H${5 + modules.length}`).conditionalFormats.add("colorScale", { colors: [colors.red, colors.amber, colors.green], thresholds: ["min", "50%", "max"] });

// DASHBOARD
title(dashboard, "A1:H1", "LIMS RELEASE TESTING DASHBOARD", "100% readiness plus all release gates is required for READY FOR SALES.");
dashboard.getRange("A3:B3").values = [["Release thresholds (editable)", "Target"]];
headerFormat(dashboard.getRange("A3:B3"));
dashboard.getRange("A4:A11").values = [
  ["Sales Readiness Target"], ["Level 1 Execution"], ["Level 1 Pass"], ["Level 2 Execution"],
  ["Level 2 Pass"], ["Level 3 Execution"], ["Level 3 Pass"], ["Gate Evidence"],
];
dashboard.getRange("B4:B11").values = [[1], [1], [1], [0.95], [0.95], [1], [0.98], [1]];
dashboard.getRange("B4:B11").format = { fill: colors.yellow, numberFormat: "0%", font: { bold: true, color: colors.navy } };
dashboard.getRange("A12:B12").values = [["Max Open Critical/High", 0]];
dashboard.getRange("B12").format = { fill: colors.yellow, numberFormat: "0", font: { bold: true, color: colors.navy } };

dashboard.getRange("D3:E3").values = [["Execution KPIs", "Value"]];
headerFormat(dashboard.getRange("D3:E3"));
dashboard.getRange("D4:D12").values = [["Total Cases"], ["Executed"], ["Passed"], ["Failed"], ["Blocked"], ["Not Run"], ["N/A"], ["Open Critical/High"], ["Gate Cases Without Evidence"]];
dashboard.getRange("E4:E12").formulas = [[
  `=COUNTA('Test Cases'!$A$6:$A$${endRow})`],
  [`=SUM('Test Cases'!$AA$6:$AA$${endRow})`],
  [`=SUM('Test Cases'!$AB$6:$AB$${endRow})`],
  [`=COUNTIF('Test Cases'!$O$6:$O$${endRow},"Failed")`],
  [`=COUNTIF('Test Cases'!$O$6:$O$${endRow},"Blocked")`],
  [`=COUNTIF('Test Cases'!$O$6:$O$${endRow},"Not Run")`],
  [`=COUNTIF('Test Cases'!$O$6:$O$${endRow},"N/A")`],
  [`=SUM('Test Cases'!$AC$6:$AC$${endRow})`],
  [`=COUNTIFS('Test Cases'!$I$6:$I$${endRow},"Yes",'Test Cases'!$AD$6:$AD$${endRow},0)`],
];
dashboard.getRange("G3:H3").values = [["Readiness KPIs", "Value"]];
headerFormat(dashboard.getRange("G3:H3"));
dashboard.getRange("G4:G10").values = [["Overall Execution"], ["Overall Pass"], ["Gate Evidence"], ["Level 3 Execution"], ["Level 3 Pass"], ["Readiness Score"], ["Sales Status"]];
dashboard.getRange("H4:H10").formulas = [[
  `=IFERROR(E5/(E4-E10),0)`],
  [`=IFERROR(E6/E5,0)`],
  [`=IFERROR(SUMIFS('Test Cases'!$AD$6:$AD$${endRow},'Test Cases'!$I$6:$I$${endRow},"Yes")/COUNTIF('Test Cases'!$I$6:$I$${endRow},"Yes"),0)`],
  [`='Level Summary'!H8`],
  [`='Level Summary'!I8`],
  [`=IF(E5=0,0,MIN(1,'Level Summary'!H6/$B$5)*10%+MIN(1,'Level Summary'!I6/$B$6)*10%+MIN(1,'Level Summary'!H7/$B$7)*15%+MIN(1,'Level Summary'!I7/$B$8)*15%+MIN(1,'Level Summary'!H8/$B$9)*20%+MIN(1,'Level Summary'!I8/$B$10)*20%+MIN(1,H6/$B$11)*5%+IF(E11<=$B$12,5%,0))`],
  [`=IF(AND(H9>=$B$4,'Level Summary'!H6>=$B$5,'Level Summary'!I6>=$B$6,'Level Summary'!H7>=$B$7,'Level Summary'!I7>=$B$8,'Level Summary'!H8>=$B$9,'Level Summary'!I8>=$B$10,H6>=$B$11,E11<=$B$12),"READY FOR SALES","NOT READY FOR SALES")`],
];
dashboard.getRange("H4:H9").format.numberFormat = "0%";
dashboard.getRange("H10").format = { fill: colors.red, font: { bold: true, color: colors.redText, size: 14 }, wrapText: true };
dashboard.getRange("H10").conditionalFormats.addCustom('=$H$10="READY FOR SALES"', { fill: colors.green, font: { color: colors.greenText, bold: true } });

dashboard.getRange("A15:B20").values = [["Status", "Count"], ["Passed", null], ["Failed", null], ["Blocked", null], ["Not Run", null], ["N/A", null]];
headerFormat(dashboard.getRange("A15:B15"));
for (let r = 16; r <= 20; r++) dashboard.getRange(`B${r}`).formulas = [[`=COUNTIF('Test Cases'!$O$6:$O$${endRow},A${r})`]];
dashboard.getRange("D15:F18").values = [["Level", "Execution", "Pass"], ["Level 1", null, null], ["Level 2", null, null], ["Level 3", null, null]];
headerFormat(dashboard.getRange("D15:F15"));
for (let r = 16; r <= 18; r++) dashboard.getRange(`E${r}:F${r}`).formulas = [[`='Level Summary'!H${r-10}`, `='Level Summary'!I${r-10}`]];
dashboard.getRange("E16:F18").format.numberFormat = "0%";

const statusChart = dashboard.charts.add("doughnut", dashboard.getRange("A15:B20"));
statusChart.title = "Test Status Distribution";
statusChart.hasLegend = true;
statusChart.setPosition("A22", "D38");
const levelChart = dashboard.charts.add("bar", dashboard.getRange("D15:F18"));
levelChart.title = "Execution and Pass Rate by Level";
levelChart.hasLegend = true;
levelChart.yAxis = { numberFormatCode: "0%", min: 0, max: 1 };
levelChart.setPosition("E22", "K38");

dashboard.getRange("A:A").format.columnWidth = 26;
dashboard.getRange("B:B").format.columnWidth = 14;
dashboard.getRange("C:C").format.columnWidth = 3;
dashboard.getRange("D:D").format.columnWidth = 24;
dashboard.getRange("E:E").format.columnWidth = 14;
dashboard.getRange("F:F").format.columnWidth = 12;
dashboard.getRange("G:G").format.columnWidth = 24;
dashboard.getRange("H:H").format.columnWidth = 22;
dashboard.freezePanes.freezeRows(2);

// DEFECTS
title(defects, "A1:Q1", "DEFECT REGISTER", "Create one row per defect and link it to the Test Case ID.");
const defectHeaders = ["Defect ID", "Test Case ID", "Level", "Module", "Summary", "Severity", "Status", "Owner", "Opened Date", "Target Date", "Closed Date", "Age Days", "Root Cause", "Fix Build", "Retest Result", "Evidence", "Comments"];
defects.getRange("A4:Q4").values = [defectHeaders];
headerFormat(defects.getRange("A4:Q4"));
defects.getRange("A5:Q5").values = [["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""]];
defects.getRange("L5").formulas = [[`=IF(I5="","",IF(K5<>"",K5-I5,TODAY()-I5))`]];
defects.getRange("F5:F500").dataValidation = { rule: { type: "list", values: ["Critical", "High", "Medium", "Low"] } };
defects.getRange("G5:G500").dataValidation = { rule: { type: "list", values: ["Open", "In Progress", "Fixed", "Closed", "Rejected", "Deferred"] } };
defects.getRange("O5:O500").dataValidation = { rule: { type: "list", values: ["Pending", "Passed", "Failed", "Not Required"] } };
defects.getRange("I5:K500").format.numberFormat = "yyyy-mm-dd";
defects.getRange("L5:L500").format.numberFormat = "0";
defects.getRange("A:Q").format.wrapText = true;
for (const [col, width] of Object.entries({A:14,B:14,C:11,D:24,E:38,F:12,G:14,H:18,I:14,J:14,K:14,L:10,M:24,N:14,O:14,P:28,Q:30})) defects.getRange(`${col}:${col}`).format.columnWidth = width;
defects.freezePanes.freezeRows(4);
const defectsTable = defects.tables.add("A4:Q5", true, "LimsDefects");
defectsTable.style = "TableStyleMedium2";

// TEST RUNS
title(testRuns, "A1:N1", "TEST RUN LOG", "Use one row per test cycle or release candidate.");
const runHeaders = ["Run ID", "Build", "Environment", "Level", "Start Date", "End Date", "Lead", "Scope", "Total", "Executed", "Passed", "Failed", "Blocked", "Decision / Notes"];
testRuns.getRange("A4:N4").values = [runHeaders];
headerFormat(testRuns.getRange("A4:N4"));
testRuns.getRange("A5:N5").values = [["RUN-001", "", "QA", "Level 1", "", "", "", "Initial core-flow run", "", "", "", "", "", ""]];
testRuns.getRange("C5:C200").dataValidation = { rule: { type: "list", values: ["QA", "UAT", "Staging", "Production-like"] } };
testRuns.getRange("D5:D200").dataValidation = { rule: { type: "list", values: ["Level 1", "Level 2", "Level 3", "Full Regression"] } };
testRuns.getRange("E5:F200").format.numberFormat = "yyyy-mm-dd";
for (const [col, width] of Object.entries({A:13,B:15,C:16,D:15,E:14,F:14,G:18,H:30,I:11,J:11,K:11,L:11,M:11,N:38})) testRuns.getRange(`${col}:${col}`).format.columnWidth = width;
testRuns.freezePanes.freezeRows(4);
const runTable = testRuns.tables.add("A4:N5", true, "LimsTestRuns");
runTable.style = "TableStyleMedium2";

// LISTS & RULES
title(rules, "A1:F1", "LISTS, COLOR LEGEND AND RELEASE RULES", "Yellow cells are editable inputs. Formula cells must not be overwritten.");
rules.getRange("A4:B4").values = [["Status", "Meaning"]]; headerFormat(rules.getRange("A4:B4"));
rules.getRange("A5:B9").values = [["Not Run", "Not executed"], ["Passed", "Actual result matches expected result"], ["Failed", "Unexpected result; defect required"], ["Blocked", "Cannot execute because of dependency/defect"], ["N/A", "Not applicable with approved reason"]];
rules.getRange("D4:F4").values = [["Release rule", "Default", "Purpose"]]; headerFormat(rules.getRange("D4:F4"));
rules.getRange("D5:F13").values = [
  ["Sales readiness", 1, "Dashboard must reach target"], ["Level 1 execution", 1, "All core tests"], ["Level 1 pass", 1, "No core failure"],
  ["Level 2 execution", 0.95, "Detailed coverage"], ["Level 2 pass", 0.95, "Functional quality"], ["Level 3 execution", 1, "All market-readiness tests"],
  ["Level 3 pass", 0.98, "Release-candidate quality"], ["Gate evidence", 1, "Proof for mandatory cases"], ["Open Critical/High", 0, "No release blocker"],
];
rules.getRange("E5:E12").format.numberFormat = "0%";
rules.getRange("A:A").format.columnWidth = 18; rules.getRange("B:B").format.columnWidth = 48;
rules.getRange("D:D").format.columnWidth = 28; rules.getRange("E:E").format.columnWidth = 14; rules.getRange("F:F").format.columnWidth = 36;

// INSTRUCTIONS
title(instructions, "A1:H1", "HOW TO USE THIS WORKBOOK", "Follow these steps. Do not manually type dashboard percentages.");
instructions.getRange("A4:H4").merge(); instructions.getRange("A4:H4").values = [["1. Open Test Cases and filter by Level, Module, Role or Priority."]];
instructions.getRange("A6:H6").merge(); instructions.getRange("A6:H6").values = [["2. Enter Status, Actual Result, Defect, Tester, Build, Date and Evidence in the yellow columns."]];
instructions.getRange("A8:H8").merge(); instructions.getRange("A8:H8").values = [["3. Create each defect in Defects and use the same Defect ID in Test Cases."]];
instructions.getRange("A10:H10").merge(); instructions.getRange("A10:H10").values = [["4. Review Level Summary and Module Summary after every test cycle."]];
instructions.getRange("A12:H12").merge(); instructions.getRange("A12:H12").values = [["5. Review Release Dashboard. READY FOR SALES appears only when all configured gates pass."]];
instructions.getRange("A14:H14").merge(); instructions.getRange("A14:H14").values = [["Important: 10% testing is not a safe market-release threshold. The default Sales Readiness Target is 100%."]];
for (const row of [4,6,8,10,12,14]) {
  instructions.getRange(`A${row}:H${row}`).format = { fill: row === 14 ? colors.amber : colors.lightBlue, font: { bold: true, color: row === 14 ? colors.amberText : colors.navy, size: 12 }, wrapText: true, verticalAlignment: "center" };
  instructions.getRange(`A${row}:H${row}`).format.rowHeight = 34;
}
for (const c of ["A","B","C","D","E","F","G","H"]) instructions.getRange(`${c}:${c}`).format.columnWidth = 16;

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(previewDir, { recursive: true });

const dashPreview = await wb.render({ sheetName: "Release Dashboard", range: "A1:K38", scale: 1.3, format: "png" });
await fs.writeFile(path.join(previewDir, "release_dashboard.png"), new Uint8Array(await dashPreview.arrayBuffer()));
const casesPreview = await wb.render({ sheetName: "Test Cases", range: "A1:O18", scale: 1.0, format: "png" });
await fs.writeFile(path.join(previewDir, "test_cases.png"), new Uint8Array(await casesPreview.arrayBuffer()));
const casesDataPreview = await wb.render({ sheetName: "Test Cases", range: "A5:O18", scale: 1.0, format: "png" });
await fs.writeFile(path.join(previewDir, "test_cases_data.png"), new Uint8Array(await casesDataPreview.arrayBuffer()));
const summaryPreview = await wb.render({ sheetName: "Level Summary", range: "A1:M10", scale: 1.4, format: "png" });
await fs.writeFile(path.join(previewDir, "level_summary.png"), new Uint8Array(await summaryPreview.arrayBuffer()));
for (const [sheetName, range, fileName, scale] of [
  ["Module Summary", `A1:I${Math.min(30, 5 + modules.length)}`, "module_summary.png", 1.2],
  ["Defects", "A1:Q8", "defects.png", 1.0],
  ["Test Runs", "A1:N8", "test_runs.png", 1.1],
  ["Lists & Rules", "A1:F14", "lists_rules.png", 1.2],
  ["Instructions", "A1:H15", "instructions.png", 1.2],
]) {
  const preview = await wb.render({ sheetName, range, scale, format: "png" });
  await fs.writeFile(path.join(previewDir, fileName), new Uint8Array(await preview.arrayBuffer()));
}

const xlsx = await SpreadsheetFile.exportXlsx(wb);
await xlsx.save(outputPath);

const inspectDashboard = await wb.inspect({ kind: "table", range: "Release Dashboard!A1:H20", include: "values,formulas", tableMaxRows: 20, tableMaxCols: 8, maxChars: 7000 });
const inspectSummary = await wb.inspect({ kind: "table", range: "Level Summary!A1:M8", include: "values,formulas", tableMaxRows: 10, tableMaxCols: 13, maxChars: 7000 });
const errors = await wb.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A", options: { useRegex: true, maxResults: 300 }, summary: "final formula error scan" });
console.log(JSON.stringify({ outputPath, caseCount: cases.length, modules: modules.length, dashboard: inspectDashboard.ndjson, levelSummary: inspectSummary.ndjson, formulaErrors: errors.ndjson }, null, 2));
