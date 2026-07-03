import ExcelJS from "exceljs";

function addHeaderRow(worksheet, title, cols) {
  worksheet.mergeCells(1, 1, 1, cols.length);
  const headerCell = worksheet.getCell(1, 1);
  headerCell.value = title;
  headerCell.font = { bold: true, size: 14 };
  headerCell.alignment = { horizontal: "center" };
  worksheet.addRow([]);
}

function addColumnHeaders(worksheet, headings) {
  const row = worksheet.addRow(headings);
  row.font = { bold: true };
  row.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } };
    cell.border = {
      top: { style: "thin" }, left: { style: "thin" },
      bottom: { style: "thin" }, right: { style: "thin" },
    };
  });
}

export async function exportDailyCollection(daily, totalCollection, breakdown) {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("Daily Collection");

  addHeaderRow(ws, "Daily Collection Report", ["Date", "Cash", "Card", "UPI", "Other", "Total"]);
  addColumnHeaders(ws, ["Date", "Cash", "Card", "UPI", "Other", "Total"]);

  for (const d of daily) {
    ws.addRow([d.date, d.cash, d.card, d.upi || 0, d.other, d.total]);
  }

  ws.addRow([]);
  ws.addRow(["Total", "", "", "", "", totalCollection]);
  ws.addRow(["Cash Total", breakdown.cash, "Card Total", breakdown.card, "UPI Total", breakdown.upi || 0]);
  ws.addRow(["Other Total", breakdown.other]);

  ws.columns.forEach((col) => { if (col) col.width = 18; });

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

export async function exportMonthlyRevenue(monthly, totalRevenue, totalBills) {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("Monthly Revenue");

  addHeaderRow(ws, "Monthly Revenue Report", ["Month", "Bills", "Revenue", "Collection", "Outstanding"]);
  addColumnHeaders(ws, ["Month", "Bills", "Revenue", "Collection", "Outstanding"]);

  for (const m of monthly) {
    ws.addRow([m.month, m.bills, m.revenue, m.collection, m.outstanding]);
  }

  ws.addRow([]);
  ws.addRow(["Total Bills", totalBills, "Total Revenue", totalRevenue]);

  ws.columns.forEach((col) => { if (col) col.width = 20; });

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

export async function exportWeeklyCollection(weekly, totalCollection, breakdown) {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("Weekly Collection");

  addHeaderRow(ws, "Weekly Collection Report", ["Week", "Cash", "Card", "Other", "Total"]);
  addColumnHeaders(ws, ["Week", "Cash", "Card", "Other", "Total"]);

  for (const w of weekly) {
    ws.addRow([w.week, w.cash, w.card, w.other, w.total]);
  }

  ws.addRow([]);
  ws.addRow(["Total", "", "", "", totalCollection]);
  ws.addRow(["Cash Total", breakdown.cash, "Card Total", breakdown.card, "Other Total", breakdown.other]);

  ws.columns.forEach((col) => { if (col) col.width = 18; });

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

export async function exportOutstanding(rows, totalOutstanding, totalBilled, totalCollected) {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("Outstanding Dues");

  addHeaderRow(ws, "Outstanding Dues Report", ["Entry", "Bill ID", "Description", "Amount", "Date"]);
  addColumnHeaders(ws, ["Entry", "Bill ID", "Description", "Amount", "Date"]);

  for (const r of rows) {
    ws.addRow([r.entryNumber, r.billId, r.description, r.amount, r.date ? new Date(r.date).toLocaleDateString("en-IN") : ""]);
  }

  ws.addRow([]);
  ws.addRow(["Total Outstanding", totalOutstanding]);
  ws.addRow(["Total Billed", totalBilled]);
  ws.addRow(["Total Collected", totalCollected]);

  ws.columns.forEach((col) => { if (col) col.width = 22; });

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

export async function exportConsolidated({ daily, weekly, monthly }) {
  const workbook = new ExcelJS.Workbook();

  // Sheet 1: Daily Collection
  const wsDaily = workbook.addWorksheet("Daily Collection");
  addHeaderRow(wsDaily, "Daily Collection Report", ["Date", "Cash", "Card", "UPI", "Other", "Total"]);
  addColumnHeaders(wsDaily, ["Date", "Cash", "Card", "UPI", "Other", "Total"]);
  for (const d of daily) {
    wsDaily.addRow([d.date, d.cash, d.card, d.upi || 0, d.other, d.total]);
  }
  const dailyTotal = daily.reduce((s, d) => s + d.total, 0);
  wsDaily.addRow([]);
  wsDaily.addRow(["Grand Total", "", "", "", "", dailyTotal]);
  wsDaily.columns.forEach((col) => { if (col) col.width = 18; });

  // Sheet 2: Weekly Collection
  const wsWeekly = workbook.addWorksheet("Weekly Collection");
  addHeaderRow(wsWeekly, "Weekly Collection Report", ["Week", "Cash", "Card", "Other", "Total"]);
  addColumnHeaders(wsWeekly, ["Week", "Cash", "Card", "Other", "Total"]);
  for (const w of weekly) {
    wsWeekly.addRow([w.week, w.cash, w.card, w.other, w.total]);
  }
  const weeklyTotal = weekly.reduce((s, w) => s + w.total, 0);
  wsWeekly.addRow([]);
  wsWeekly.addRow(["Grand Total", "", "", "", weeklyTotal]);
  wsWeekly.columns.forEach((col) => { if (col) col.width = 18; });

  // Sheet 3: Monthly Revenue
  const wsMonthly = workbook.addWorksheet("Monthly Revenue");
  addHeaderRow(wsMonthly, "Monthly Revenue Report", ["Month", "Bills", "Revenue", "Collection", "Outstanding"]);
  addColumnHeaders(wsMonthly, ["Month", "Bills", "Revenue", "Collection", "Outstanding"]);
  for (const m of monthly) {
    wsMonthly.addRow([m.month, m.bills, m.revenue, m.collection, m.outstanding]);
  }
  wsMonthly.addRow([]);
  const totalRevenue = monthly.reduce((s, m) => s + m.revenue, 0);
  const totalBills = monthly.reduce((s, m) => s + m.bills, 0);
  wsMonthly.addRow(["Total Bills", totalBills, "Total Revenue", totalRevenue]);
  wsMonthly.columns.forEach((col) => { if (col) col.width = 20; });

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}
