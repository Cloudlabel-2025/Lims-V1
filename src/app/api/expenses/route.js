import mongoose from "mongoose";
import { getAccountByCode, postJournalEntry } from "@/app/lib/accounting";
import { jsonError } from "@/app/lib/api-response";
import { getTenantModels } from "@/app/lib/tenant-db";
import { requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";

const expenseAccountByCategory = {
  reagent: "5001",
  staff: "5002",
  equipment: "5003",
  overhead: "5004",
};

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
    const { ExpenseEntry } = await getTenantModels(auth.tenantId);
    const query = { tenantId: auth.tenantId };
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
    if (rawTaxAmount === undefined || rawTaxAmount === null || rawTaxAmount === "") {
      return Response.json({ error: "Tax amount is required" }, { status: 400 });
    }
    if (isExponentialNotation(String(rawTaxAmount))) {
      return Response.json({ error: "Exponential notation is not allowed in tax amount" }, { status: 400 });
    }

    const amount = money(rawAmount);
    const taxAmount = Math.max(0, money(rawTaxAmount));

    const maxAllowed = 9999999;
    if (amount > maxAllowed) {
      return Response.json({ error: `Amount cannot exceed Rs ${maxAllowed.toLocaleString("en-IN")}` }, { status: 400 });
    }
    if (vendorName.length > 30) {
      return Response.json({ error: "Vendor name must be 30 characters or less" }, { status: 400 });
    }
    if (vendorName.length < 3) {
      return Response.json({ error: "Vendor name must be at least 3 characters" }, { status: 400 });
    }
    if (body.date) {
      const expenseDate = dateValue(body.date);
      const tomorrow = new Date();
      tomorrow.setHours(23, 59, 59, 999);
      if (expenseDate > tomorrow) {
        return Response.json({ error: "Date cannot be in the future" }, { status: 400 });
      }
    }
    const paidFrom = ["cash", "bank", "vendor-payable"].includes(body.paidFrom)
      ? body.paidFrom
      : "vendor-payable";

    if (!expenseAccountByCategory[category] || amount <= 0) {
      return Response.json({ error: "Valid category and amount are required" }, { status: 400 });
    }

    const { connection, ExpenseEntry } = await getTenantModels(auth.tenantId);
    const result = await connection.transaction(async (session) => {
      const expenseAccount = body.accountId && mongoose.Types.ObjectId.isValid(body.accountId)
        ? { _id: body.accountId }
        : await getAccountByCode(connection, auth.tenantId, expenseAccountByCategory[category], { session });
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
            date: dateValue(body.date),
            accountId: expenseAccount._id,
            tenantId: auth.tenantId,
            attachmentUrl: clean(body.attachmentUrl),
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
