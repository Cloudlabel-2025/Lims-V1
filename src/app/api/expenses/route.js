import mongoose from "mongoose";
import { getAccountByCode, postJournalEntry } from "@/app/lib/accounting";
import { jsonError } from "@/app/lib/api-response";
import { getTenantModels } from "@/app/lib/tenant-db";
import { requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";
import { exportExpenses } from "@/app/lib/excel-export";
import { exportExpensesPdf, generateCsv } from "@/app/lib/pdf-export";

const expenseAccountByCategory = {
  reagent: "5001",
  staff: "5002",
  equipment: "5003",
  overhead: "5004",
};

const DEFAULT_EXPENSE_ACCOUNT = "5001"; // default fallback

function clean(value) {
  return String(value || "").trim();
}

function money(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function isExponentialNotation(value) {
  if (typeof value === "string" && /[eE]/.test(value)) return true;
  return false;
}

function hasUrl(value) {
  return /https?:\/\//.test(value);
}

function isValidName(value) {
  return /^[A-Za-z0-9 .&'\/,()@_-]*$/.test(value);
}

function dateValue(value) {
  if (!value) return new Date();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export async function GET(req) {
  try {
    const auth = requireTenantSession(req, "accounts.view");
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "accounts.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(200, Math.max(1, Number.parseInt(searchParams.get("limit") || "50", 10)));
    const exportFormat = searchParams.get("export");
    const { ExpenseEntry } = await getTenantModels(auth.tenantId);
    const query = { tenantId: auth.tenantId };

    if (exportFormat) {
      const allExpenses = await ExpenseEntry.find(query)
        .populate("accountId", "code name type subtype")
        .populate("journalEntryId", "entryNumber date")
        .sort({ date: -1, createdAt: -1 })
        .lean();

      if (exportFormat === "xlsx") {
        const buffer = await exportExpenses(allExpenses);
        return new Response(buffer, {
          headers: {
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": `attachment; filename="expenses.xlsx"`,
          },
        });
      }
      if (exportFormat === "pdf") {
        const buffer = await exportExpensesPdf(allExpenses);
        return new Response(buffer, {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="expenses.pdf"`,
          },
        });
      }
      if (exportFormat === "csv") {
        const headers = ["Date", "Category", "Vendor", "Amount", "Tax %", "Tax Amt", "Total", "Credit Mode", "Journal #"];
        const csvRows = allExpenses.map((e) => {
          const taxPct = e.amount && Number(e.amount) > 0 ? Math.round((Number(e.taxAmount || 0) / Number(e.amount)) * 100) : 0;
          const total = Number(e.amount || 0) + Number(e.taxAmount || 0);
          return [
            e.date ? new Date(e.date).toLocaleDateString("en-IN") : "",
            e.category,
            e.vendorName || "-",
            e.amount,
            `${taxPct}%`,
            e.taxAmount,
            total,
            e.paidFrom,
            e.journalEntryId?.entryNumber || "",
          ];
        });
        const buffer = generateCsv(headers, csvRows);
        return new Response(buffer, {
          headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": `attachment; filename="expenses.csv"`,
          },
        });
      }
    }
    const [expenses, total] = await Promise.all([
      ExpenseEntry.find(query)
        .populate("accountId", "code name type subtype")
        .populate("journalEntryId", "entryNumber date")
        .sort({ date: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ExpenseEntry.countDocuments(query),
    ]);

    return Response.json({
      expenses,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    return jsonError("Unable to load expenses", error, 500);
  }
}

export async function POST(req) {
  try {
    const auth = requireTenantSession(req, "accounts.manage");
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "accounts.view");
    if (moduleAuth.error) return moduleAuth.error;

    const body = await req.json();
    const category = clean(body.category);
    const vendorName = clean(body.vendorName);
    const rawAmount = body.amount;
    const rawTaxAmount = body.taxAmount;

    if (!category) {
      return Response.json({ error: "Category is required" }, { status: 400 });
    }
    if (category.length < 2 || category.length > 50) {
      return Response.json({ error: "Category must be between 2 and 50 characters" }, { status: 400 });
    }
    if (hasUrl(category)) {
      return Response.json({ error: "URLs are not allowed in category" }, { status: 400 });
    }
    if (!isValidName(category)) {
      return Response.json({ error: "Category contains invalid characters" }, { status: 400 });
    }

    if (!vendorName) {
      return Response.json({ error: "Vendor name is required" }, { status: 400 });
    }
    if (hasUrl(vendorName)) {
      return Response.json({ error: "URLs are not allowed in vendor name" }, { status: 400 });
    }
    if (!isValidName(vendorName)) {
      return Response.json({ error: "Vendor name contains invalid characters" }, { status: 400 });
    }
    if (rawAmount === undefined || rawAmount === null || rawAmount === "") {
      return Response.json({ error: "Amount is required" }, { status: 400 });
    }
    if (isExponentialNotation(String(rawAmount))) {
      return Response.json({ error: "Exponential notation is not allowed in amount" }, { status: 400 });
    }
    const numAmount = Number(rawAmount);
    if (Number.isNaN(numAmount) || numAmount <= 0) {
      return Response.json({ error: "Amount must be greater than zero" }, { status: 400 });
    }

    if (rawTaxAmount === undefined || rawTaxAmount === null || rawTaxAmount === "") {
      return Response.json({ error: "Tax amount is required" }, { status: 400 });
    }
    if (isExponentialNotation(String(rawTaxAmount))) {
      return Response.json({ error: "Exponential notation is not allowed in tax amount" }, { status: 400 });
    }
    const numTaxAmount = Number(rawTaxAmount);
    if (Number.isNaN(numTaxAmount) || numTaxAmount < 0) {
      return Response.json({ error: "Tax amount cannot be negative" }, { status: 400 });
    }
    if (numTaxAmount > numAmount) {
      return Response.json({ error: "Tax amount cannot exceed expense amount" }, { status: 400 });
    }

    const amount = money(rawAmount);
    const taxAmount = money(rawTaxAmount);

    const maxAllowed = 9999999;
    if (amount > maxAllowed) {
      return Response.json({ error: `Amount cannot exceed Rs ${maxAllowed.toLocaleString("en-IN")}` }, { status: 400 });
    }
    if (vendorName.length > 75) {
      return Response.json({ error: "Vendor name must be 75 characters or less" }, { status: 400 });
    }
    if (vendorName.length < 3) {
      return Response.json({ error: "Vendor name must be at least 3 characters" }, { status: 400 });
    }

    const expenseDate = dateValue(body.date);
    const tomorrow = new Date();
    tomorrow.setHours(23, 59, 59, 999);
    if (expenseDate > tomorrow) {
      return Response.json({ error: "Date cannot be in the future" }, { status: 400 });
    }

    if (body.paidFrom && !["cash", "bank", "vendor-payable"].includes(body.paidFrom)) {
      return Response.json({ error: "Invalid payment mode. Must be cash, bank, or vendor-payable" }, { status: 400 });
    }
    const paidFrom = body.paidFrom || "vendor-payable";

    const attachmentUrl = clean(body.attachmentUrl);
    if (attachmentUrl && attachmentUrl.length > 500) {
      return Response.json({ error: "Attachment URL is too long" }, { status: 400 });
    }

    const { connection, ExpenseEntry } = await getTenantModels(auth.tenantId);

    // BUG-074 duplicate prevention: Check if same vendor, category, amount on same day already exists
    const startOfDay = new Date(expenseDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(expenseDate);
    endOfDay.setHours(23, 59, 59, 999);
    const escapeRegex = (s) => String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const duplicateExpense = await ExpenseEntry.findOne({
      tenantId: auth.tenantId,
      vendorName: { $regex: new RegExp(`^${escapeRegex(vendorName)}$`, "i") },
      category: { $regex: new RegExp(`^${escapeRegex(category)}$`, "i") },
      amount,
      date: { $gte: startOfDay, $lte: endOfDay },
    });

    if (duplicateExpense) {
      return Response.json(
        { error: "Duplicate expense detected: An expense for this vendor, category, and amount has already been recorded on this date" },
        { status: 409 }
      );
    }

    const isRecurring = Boolean(body.isRecurring);
    const recurringInterval = isRecurring
      ? ["daily", "weekly", "monthly", "yearly"].includes(body.recurringInterval)
        ? body.recurringInterval
        : "monthly"
      : null;

    let nextDueDate = null;
    if (isRecurring) {
      const d = new Date(expenseDate);
      if (recurringInterval === "daily") d.setDate(d.getDate() + 1);
      else if (recurringInterval === "weekly") d.setDate(d.getDate() + 7);
      else if (recurringInterval === "yearly") d.setFullYear(d.getFullYear() + 1);
      else d.setMonth(d.getMonth() + 1);
      nextDueDate = d;
    }

    const expenseAccountCode = expenseAccountByCategory[category] || DEFAULT_EXPENSE_ACCOUNT;
    const result = await connection.transaction(async (session) => {
      const expenseAccount = body.accountId && mongoose.Types.ObjectId.isValid(body.accountId)
        ? { _id: body.accountId }
        : await getAccountByCode(connection, auth.tenantId, expenseAccountCode, { session });
      const creditAccountCode = paidFrom === "cash" ? "1001" : paidFrom === "bank" ? "1002" : "2002";
      const creditAccount = await getAccountByCode(connection, auth.tenantId, creditAccountCode, { session });
      const totalAmount = money(amount + taxAmount);

      const [expense] = await ExpenseEntry.create(
        [
          {
            category,
            vendorName,
            amount,
            taxAmount,
            paidFrom,
            date: expenseDate,
            accountId: expenseAccount._id,
            tenantId: auth.tenantId,
            attachmentUrl,
            isRecurring,
            recurringInterval,
            nextDueDate,
          },
        ],
        { session }
      );

      const journalEntry = await postJournalEntry(
        connection,
        {
          tenantId: auth.tenantId,
          postedBy: auth.session.userId,
          sourceType: "expense",
          sourceId: expense._id,
          description: `Expense recorded: ${category}`,
          lines: [
            { accountId: expenseAccount._id, debit: totalAmount, credit: 0 },
            { accountId: creditAccount._id, debit: 0, credit: totalAmount },
          ],
        },
        { session }
      );

      expense.journalEntryId = journalEntry._id;
      await expense.save({ session });

      return { expense, journalEntry };
    });

    return Response.json(result, { status: 201 });
  } catch (error) {
    return jsonError("Unable to record expense", error, 500);
  }
}
