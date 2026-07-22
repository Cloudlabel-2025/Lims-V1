import PDFDocument from "pdfkit";

const fmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });
const money = (v) => fmt.format(Number(v) || 0);

function createDoc(title, subtitle) {
  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 40 });
  doc.fontSize(16).font("Helvetica-Bold").text(title, { align: "center" });
  if (subtitle) {
    doc.moveDown(0.3);
    doc.fontSize(9).font("Helvetica").text(subtitle, { align: "center" });
  }
  doc.moveDown(0.8);
  return doc;
}

function drawTable(doc, headers, rows, colWidths) {
  const startX = 40;
  const headerH = 22;
  const rowH = 18;
  const pageH = doc.page.height - 50;
  let y = doc.y;

  function drawHeaders() {
    let x = startX;
    doc.save();
    doc.rect(startX, y, colWidths.reduce((a, b) => a + b, 0), headerH).fill("#e0e0e0");
    doc.restore();
    doc.fontSize(8).font("Helvetica-Bold").fillColor("#000");
    for (let i = 0; i < headers.length; i++) {
      doc.text(headers[i], x + 4, y + 6, { width: colWidths[i] - 8, align: "left" });
      x += colWidths[i];
    }
    y += headerH;
  }

  drawHeaders();

  for (const row of rows) {
    if (y + rowH > pageH) {
      doc.addPage();
      y = 40;
      drawHeaders();
    }
    let x = startX;
    doc.fontSize(8).font("Helvetica").fillColor("#000");
    for (let i = 0; i < row.length; i++) {
      const val = row[i] != null ? String(row[i]) : "";
      doc.text(val, x + 4, y + 4, { width: colWidths[i] - 8, align: "left" });
      x += colWidths[i];
    }
    y += rowH;
  }
  doc.y = y + 6;
}

function toBuffer(doc) {
  return new Promise((resolve) => {
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.end();
  });
}

export async function exportDailyCollectionPdf(daily, totalCollection, breakdown) {
  const doc = createDoc("Daily Collection Report");
  const headers = ["Date", "Cash", "Card", "UPI", "Other", "Total"];
  const colWidths = [120, 100, 100, 100, 100, 100];
  const rows = daily.map((d) => [d.date, money(d.cash), money(d.card), money(d.upi || 0), money(d.other), money(d.total)]);
  drawTable(doc, headers, rows, colWidths);
  doc.moveDown(0.5);
  doc.fontSize(9).font("Helvetica-Bold");
  doc.text(`Total Collection: Rs ${money(totalCollection)}`);
  doc.text(`Cash: Rs ${money(breakdown.cash)}  |  Card: Rs ${money(breakdown.card)}  |  UPI: Rs ${money(breakdown.upi || 0)}  |  Other: Rs ${money(breakdown.other)}`);
  return toBuffer(doc);
}

export async function exportMonthlyRevenuePdf(monthly, totalRevenue, totalBills) {
  const doc = createDoc("Monthly Revenue Report");
  const headers = ["Month", "Bills", "Revenue", "Collection", "Outstanding"];
  const colWidths = [140, 80, 120, 120, 120];
  const rows = monthly.map((m) => [m.month, String(m.bills), money(m.revenue), money(m.collection), money(m.outstanding)]);
  drawTable(doc, headers, rows, colWidths);
  doc.moveDown(0.5);
  doc.fontSize(9).font("Helvetica-Bold");
  doc.text(`Total Bills: ${totalBills}  |  Total Revenue: Rs ${money(totalRevenue)}`);
  return toBuffer(doc);
}

export async function exportWeeklyCollectionPdf(weekly, totalCollection, breakdown) {
  const doc = createDoc("Weekly Collection Report");
  const headers = ["Week", "Cash", "Card", "Other", "Total"];
  const colWidths = [140, 110, 110, 110, 110];
  const rows = weekly.map((w) => [w.week, money(w.cash), money(w.card), money(w.other), money(w.total)]);
  drawTable(doc, headers, rows, colWidths);
  doc.moveDown(0.5);
  doc.fontSize(9).font("Helvetica-Bold");
  doc.text(`Total Collection: Rs ${money(totalCollection)}`);
  doc.text(`Cash: Rs ${money(breakdown.cash)}  |  Card: Rs ${money(breakdown.card)}  |  Other: Rs ${money(breakdown.other)}`);
  return toBuffer(doc);
}

export async function exportOutstandingPdf(rows, totalOutstanding, totalBilled, totalCollected) {
  const doc = createDoc("Outstanding Dues Report");
  const headers = ["Entry", "Bill ID", "Description", "Amount", "Date"];
  const colWidths = [100, 100, 200, 120, 100];
  const rowsData = rows.map((r) => [
    r.entryNumber || "-",
    r.billId || "-",
    r.description || "-",
    money(r.amount),
    r.date ? new Date(r.date).toLocaleDateString("en-IN") : "",
  ]);
  drawTable(doc, headers, rowsData, colWidths);
  doc.moveDown(0.5);
  doc.fontSize(9).font("Helvetica-Bold");
  doc.text(`Total Outstanding: Rs ${money(totalOutstanding)}`);
  doc.text(`Total Billed: Rs ${money(totalBilled)}  |  Total Collected: Rs ${money(totalCollected)}`);
  return toBuffer(doc);
}

export async function exportIncomeExpensePdf(monthly, totals) {
  const doc = createDoc("Income & Expense Report");
  const headers = ["Month", "Revenue", "Discounts", "Net Revenue", "Expenses", "Net Income"];
  const colWidths = [100, 100, 100, 110, 100, 110];
  const rows = monthly.map((m) => [m.month, money(m.revenue), money(m.discounts), money(m.netRevenue), money(m.expenses), money(m.netIncome)]);
  drawTable(doc, headers, rows, colWidths);
  doc.moveDown(0.5);
  doc.fontSize(9).font("Helvetica-Bold");
  doc.text(`Revenue: Rs ${money(totals.revenue)}  |  Discounts: Rs ${money(totals.discounts)}  |  Expenses: Rs ${money(totals.expenses)}`);
  doc.text(`Net Revenue: Rs ${money(totals.netRevenue)}  |  Net Income: Rs ${money(totals.netIncome)}`);
  return toBuffer(doc);
}

export async function exportExpensesPdf(expenses) {
  const doc = createDoc("Expenses Report");
  const headers = ["Date", "Category", "Vendor", "Amount", "Tax %", "Tax Amt", "Total", "Credit Mode"];
  const colWidths = [80, 70, 100, 80, 60, 80, 80, 90];
  const rows = expenses.map((e) => {
    const taxPct = e.amount && Number(e.amount) > 0 ? Math.round((Number(e.taxAmount || 0) / Number(e.amount)) * 100) : 0;
    const total = Number(e.amount || 0) + Number(e.taxAmount || 0);
    return [
      e.date ? new Date(e.date).toLocaleDateString("en-IN") : "",
      e.category || "",
      e.vendorName || "-",
      money(e.amount),
      `${taxPct}%`,
      money(e.taxAmount),
      money(total),
      e.paidFrom || "",
    ];
  });
  drawTable(doc, headers, rows, colWidths);
  return toBuffer(doc);
}

export async function exportPlPdf(revenue, expenses, totalRevenue, totalExpenses, netProfit) {
  const doc = createDoc("Profit & Loss Statement");
  const isProfit = netProfit >= 0;

  doc.fontSize(11).font("Helvetica-Bold").text("Revenue", { underline: true });
  doc.moveDown(0.3);
  const revHeaders = ["Code", "Name", "Balance"];
  const revWidths = [80, 300, 120];
  const revRows = revenue.map((r) => [r.code, r.name, money(r.balance)]);
  revRows.push(["", "Total Revenue", money(totalRevenue)]);
  drawTable(doc, revHeaders, revRows, revWidths);

  doc.moveDown(0.5);
  doc.fontSize(11).font("Helvetica-Bold").text("Expenses", { underline: true });
  doc.moveDown(0.3);
  const expHeaders = ["Code", "Name", "Balance"];
  const expWidths = [80, 300, 120];
  const expRows = expenses.map((e) => [e.code, e.name, money(e.balance)]);
  expRows.push(["", "Total Expenses", money(totalExpenses)]);
  drawTable(doc, expHeaders, expRows, expWidths);

  doc.moveDown(0.8);
  doc.fontSize(12).font("Helvetica-Bold").text(`Net ${isProfit ? "Profit" : "Loss"}: Rs ${money(Math.abs(netProfit))}`);
  return toBuffer(doc);
}

export async function exportLedgerPdf(journalEntries) {
  const doc = createDoc("General Ledger");
  const headers = ["Entry", "Date", "Account", "Debit", "Credit", "Source", "Description"];
  const colWidths = [80, 80, 160, 80, 80, 80, 160];
  const rows = [];
  for (const entry of journalEntries) {
    for (let i = 0; i < (entry.lines || []).length; i++) {
      const line = entry.lines[i];
      rows.push([
        i === 0 ? entry.entryNumber : "",
        i === 0 ? new Date(entry.date).toLocaleDateString("en-IN") : "",
        line.accountId ? `${line.accountId.code} - ${line.accountId.name}` : "-",
        line.debit ? money(line.debit) : "-",
        line.credit ? money(line.credit) : "-",
        i === 0 ? entry.sourceType : "",
        i === 0 ? entry.description : "",
      ]);
    }
  }
  drawTable(doc, headers, rows, colWidths);
  return toBuffer(doc);
}

export async function exportReceiptsPdf(receipts) {
  const doc = createDoc("Payment Receipts");
  const headers = ["Date", "Patient", "Invoice", "Amount", "Method", "Refunded", "Ref #"];
  const colWidths = [80, 120, 100, 100, 80, 80, 90];
  const rows = receipts.map((r) => [
    r.receivedAt ? new Date(r.receivedAt).toLocaleDateString("en-IN") : "",
    r.patientId?.name || "-",
    r.invoiceId?.billId || "-",
    money(r.amount),
    r.method || "",
    r.isRefunded ? "Refunded" : "Clear",
    r.journalEntryId ? `JE-${String(r.journalEntryId).slice(-6)}` : "-",
  ]);
  drawTable(doc, headers, rows, colWidths);
  return toBuffer(doc);
}

export async function exportCommissionsPdf(pendingDoctors, payoutHistory) {
  const doc = createDoc("Doctor Commissions Report");
  const totalPending = pendingDoctors.reduce((s, d) => s + Number(d.pendingPayout || 0), 0);

  doc.fontSize(11).font("Helvetica-Bold").text("Pending Payouts", { underline: true });
  doc.moveDown(0.3);
  const pendingHeaders = ["Doctor", "ID", "Commission %", "Pending Amount"];
  const pendingWidths = [180, 100, 100, 120];
  const pendingRows = pendingDoctors.map((d) => [d.name, d.doctorId || "-", `${d.commission || 0}%`, money(d.pendingPayout)]);
  pendingRows.push(["", "Total Pending", "", money(totalPending)]);
  drawTable(doc, pendingHeaders, pendingRows, pendingWidths);

  doc.moveDown(0.5);
  doc.fontSize(11).font("Helvetica-Bold").text("Payout History", { underline: true });
  doc.moveDown(0.3);
  const historyHeaders = ["Entry", "Date", "Doctor", "Amount", "Description"];
  const historyWidths = [80, 80, 140, 100, 200];
  const historyRows = payoutHistory.map((p) => [
    p.entryNumber || "-",
    p.date ? new Date(p.date).toLocaleDateString("en-IN") : "",
    p.doctor?.name || "-",
    money(p.amount),
    p.description || "-",
  ]);
  drawTable(doc, historyHeaders, historyRows, historyWidths);

  return toBuffer(doc);
}

export async function exportChartOfAccountsPdf(accounts) {
  const doc = createDoc("Chart of Accounts");
  const headers = ["Code", "Name", "Type", "Subtype", "Balance", "System"];
  const colWidths = [60, 160, 80, 100, 100, 70];
  const totals = { asset: 0, liability: 0, revenue: 0, expense: 0 };
  const rows = accounts.map((a) => {
    totals[a.type] = (totals[a.type] || 0) + Number(a.balance || 0);
    return [a.code, a.name, a.type, a.subtype || "-", money(a.balance), a.isSystem ? "System" : "Custom"];
  });
  drawTable(doc, headers, rows, colWidths);
  doc.moveDown(0.5);
  doc.fontSize(9).font("Helvetica-Bold");
  doc.text(`Asset: Rs ${money(totals.asset)}  |  Liability: Rs ${money(totals.liability)}  |  Revenue: Rs ${money(totals.revenue)}  |  Expense: Rs ${money(totals.expense)}`);
  return toBuffer(doc);
}

export async function exportCorporateAccountsPdf(corporates) {
  const doc = createDoc("Corporate Accounts");
  const headers = ["Name", "Contact Person", "Credit Limit", "Outstanding", "Statement Cycle"];
  const colWidths = [140, 120, 100, 100, 100];
  let totalCredit = 0;
  let totalOutstanding = 0;
  const rows = corporates.map((c) => {
    totalCredit += Number(c.creditLimit || 0);
    totalOutstanding += Number(c.outstandingBalance || 0);
    return [c.name, c.contactPerson || "-", money(c.creditLimit), money(c.outstandingBalance), c.statementCycle || "monthly"];
  });
  rows.push(["Total", "", money(totalCredit), money(totalOutstanding), ""]);
  drawTable(doc, headers, rows, colWidths);
  doc.moveDown(0.5);
  doc.fontSize(9).font("Helvetica-Bold");
  doc.text(`Total Credit Limit: Rs ${money(totalCredit)}  |  Total Outstanding: Rs ${money(totalOutstanding)}`);
  return toBuffer(doc);
}

export async function exportDashboardPdf(accounts, recentBills) {
  const doc = createDoc("Accounts Dashboard Summary");

  doc.fontSize(11).font("Helvetica-Bold").text("Account Balances", { underline: true });
  doc.moveDown(0.3);
  const totals = { asset: 0, liability: 0, revenue: 0, expense: 0 };
  for (const a of accounts) {
    totals[a.type] = (totals[a.type] || 0) + Number(a.balance || 0);
  }
  const balanceHeaders = ["Type", "Total Balance"];
  const balanceWidths = [200, 200];
  const balanceRows = Object.entries(totals).map(([type, total]) => [
    type.charAt(0).toUpperCase() + type.slice(1),
    money(total),
  ]);
  drawTable(doc, balanceHeaders, balanceRows, balanceWidths);

  doc.moveDown(0.5);
  doc.fontSize(11).font("Helvetica-Bold").text("Recent Bills", { underline: true });
  doc.moveDown(0.3);
  const billHeaders = ["Bill ID", "Patient", "Amount", "Paid", "Status", "Date"];
  const billWidths = [80, 120, 80, 80, 70, 90];
  const billRows = recentBills.map((b) => [
    b.billId || "-",
    b.patient?.name || "-",
    money(b.totalAmount),
    money(b.totalPaid || 0),
    b.billingStatus || "-",
    b.createdAt ? new Date(b.createdAt).toLocaleDateString("en-IN") : "",
  ]);
  drawTable(doc, billHeaders, billRows, billWidths);

  return toBuffer(doc);
}

export function generateCsv(headers, rows) {
  function escape(val) {
    const s = String(val != null ? val : "");
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }
  const lines = [headers.map(escape).join(",")];
  for (const row of rows) {
    lines.push(row.map(escape).join(","));
  }
  const csv = "\uFEFF" + lines.join("\r\n");
  return Buffer.from(csv, "utf-8");
}
