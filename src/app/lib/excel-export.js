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

export async function exportIncomeExpense(monthly, totals) {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("Income & Expense");

  addHeaderRow(ws, "Income & Expense Report", ["Month", "Revenue", "Discounts", "Net Revenue", "Expenses", "Net Income"]);
  addColumnHeaders(ws, ["Month", "Revenue", "Discounts", "Net Revenue", "Expenses", "Net Income"]);

  for (const m of monthly) {
    ws.addRow([m.month, m.revenue, m.discounts, m.netRevenue, m.expenses, m.netIncome]);
  }

  ws.addRow([]);
  ws.addRow(["Total", totals.revenue, totals.discounts, totals.netRevenue, totals.expenses, totals.netIncome]);

  ws.columns.forEach((col) => { if (col) col.width = 18; });

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

export async function exportExpenses(expenses) {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("Expenses");

  addHeaderRow(ws, "Expenses Report", ["Date", "Category", "Vendor", "Amount", "Tax %", "Tax Amt", "Total", "Credit Mode", "Journal #"]);
  addColumnHeaders(ws, ["Date", "Category", "Vendor", "Amount", "Tax %", "Tax Amt", "Total", "Credit Mode", "Journal #"]);

  for (const e of expenses) {
    const taxPct = e.amount && Number(e.amount) > 0 ? Math.round((Number(e.taxAmount || 0) / Number(e.amount)) * 100) : 0;
    const total = Number(e.amount || 0) + Number(e.taxAmount || 0);
    ws.addRow([
      e.date ? new Date(e.date).toLocaleDateString("en-IN") : "",
      e.category,
      e.vendorName || "-",
      e.amount,
      `${taxPct}%`,
      e.taxAmount,
      total,
      e.paidFrom,
      e.journalEntryId?.entryNumber || "",
    ]);
  }

  ws.columns.forEach((col) => { if (col) col.width = 16; });

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

export async function exportPl(revenue, expenses, totalRevenue, totalExpenses, netProfit) {
  const workbook = new ExcelJS.Workbook();

  const wsRev = workbook.addWorksheet("Revenue");
  addHeaderRow(wsRev, "Profit & Loss Statement - Revenue", ["Code", "Name", "Balance"]);
  addColumnHeaders(wsRev, ["Code", "Name", "Balance"]);
  for (const r of revenue) {
    wsRev.addRow([r.code, r.name, r.balance]);
  }
  wsRev.addRow([]);
  wsRev.addRow(["", "Total Revenue", totalRevenue]);
  wsRev.columns.forEach((col) => { if (col) col.width = 22; });

  const wsExp = workbook.addWorksheet("Expenses");
  addHeaderRow(wsExp, "Profit & Loss Statement - Expenses", ["Code", "Name", "Balance"]);
  addColumnHeaders(wsExp, ["Code", "Name", "Balance"]);
  for (const e of expenses) {
    wsExp.addRow([e.code, e.name, e.balance]);
  }
  wsExp.addRow([]);
  wsExp.addRow(["", "Total Expenses", totalExpenses]);
  wsExp.addRow(["", "Net Profit/Loss", netProfit]);
  wsExp.columns.forEach((col) => { if (col) col.width = 22; });

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

export async function exportLedger(journalEntries) {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("General Ledger");

  addHeaderRow(ws, "General Ledger", ["Entry", "Date", "Account", "Debit", "Credit", "Source", "Description"]);
  addColumnHeaders(ws, ["Entry", "Date", "Account", "Debit", "Credit", "Source", "Description"]);

  for (const entry of journalEntries) {
    for (let i = 0; i < (entry.lines || []).length; i++) {
      const line = entry.lines[i];
      ws.addRow([
        i === 0 ? entry.entryNumber : "",
        i === 0 ? new Date(entry.date).toLocaleDateString("en-IN") : "",
        line.accountId ? `${line.accountId.code} - ${line.accountId.name}` : "-",
        line.debit || 0,
        line.credit || 0,
        i === 0 ? entry.sourceType : "",
        i === 0 ? entry.description : "",
      ]);
    }
  }

  ws.columns.forEach((col) => { if (col) col.width = 20; });

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

export async function exportReceipts(receipts) {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("Payment Receipts");

  addHeaderRow(ws, "Payment Receipts", ["Date", "Patient", "Invoice", "Amount", "Method", "Refunded", "Ref #"]);
  addColumnHeaders(ws, ["Date", "Patient", "Invoice", "Amount", "Method", "Refunded", "Ref #"]);

  for (const r of receipts) {
    ws.addRow([
      r.receivedAt ? new Date(r.receivedAt).toLocaleDateString("en-IN") : "",
      r.patientId?.name || "-",
      r.invoiceId?.billId || "-",
      r.amount,
      r.method || "",
      r.isRefunded ? "Refunded" : "Clear",
      r.journalEntryId ? `JE-${String(r.journalEntryId).slice(-6)}` : "-",
    ]);
  }

  ws.columns.forEach((col) => { if (col) col.width = 18; });

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

export async function exportCommissions(pendingDoctors, payoutHistory) {
  const workbook = new ExcelJS.Workbook();

  const wsPending = workbook.addWorksheet("Pending Payouts");
  addHeaderRow(wsPending, "Pending Payouts", ["Doctor", "ID", "Commission %", "Pending Amount"]);
  addColumnHeaders(wsPending, ["Doctor", "ID", "Commission %", "Pending Amount"]);
  for (const d of pendingDoctors) {
    wsPending.addRow([d.name, d.doctorId || "-", `${d.commission || 0}%`, d.pendingPayout]);
  }
  wsPending.addRow([]);
  const totalPending = pendingDoctors.reduce((s, d) => s + Number(d.pendingPayout || 0), 0);
  wsPending.addRow(["", "Total Pending", "", totalPending]);
  wsPending.columns.forEach((col) => { if (col) col.width = 22; });

  const wsHistory = workbook.addWorksheet("Payout History");
  addHeaderRow(wsHistory, "Payout History", ["Entry", "Date", "Doctor", "Amount", "Description"]);
  addColumnHeaders(wsHistory, ["Entry", "Date", "Doctor", "Amount", "Description"]);
  for (const p of payoutHistory) {
    wsHistory.addRow([
      p.entryNumber || "-",
      p.date ? new Date(p.date).toLocaleDateString("en-IN") : "",
      p.doctor?.name || "-",
      p.amount,
      p.description || "-",
    ]);
  }
  wsHistory.columns.forEach((col) => { if (col) col.width = 22; });

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
