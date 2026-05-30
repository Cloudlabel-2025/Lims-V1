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

    const { ExpenseEntry } = await getTenantModels(auth.tenantId);
    const expenses = await ExpenseEntry.find({ tenantId: auth.tenantId })
      .populate("accountId", "code name type subtype")
      .populate("journalEntryId", "entryNumber date")
      .sort({ date: -1, createdAt: -1 })
      .limit(200)
      .lean();

    return Response.json({ expenses });
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
    const amount = money(body.amount);
    const taxAmount = Math.max(0, money(body.taxAmount));
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
            vendorName: clean(body.vendorName),
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
