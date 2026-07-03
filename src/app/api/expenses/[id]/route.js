import { jsonError } from "@/app/lib/api-response";
import { writeAuditLog } from "@/app/lib/audit";
import { getTenantModels } from "@/app/lib/tenant-db";
import { requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";

function clean(value) {
  return String(value || "").trim();
}

function money(value) {
  return Math.max(0, Math.round((Number(value) || 0) * 100) / 100);
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

const expenseAccountByCategory = {
  reagent: "5001",
  staff: "5002",
  equipment: "5003",
  overhead: "5004",
};

export async function GET(req, { params }) {
  try {
    const auth = requireTenantSession(req, "accounts.view");
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "accounts.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { id } = await params;
    const { ExpenseEntry } = await getTenantModels(auth.tenantId);
    const expense = await ExpenseEntry.findById(id)
      .populate("accountId", "code name type subtype")
      .populate("journalEntryId", "entryNumber date");

    if (!expense) {
      return Response.json({ error: "Expense not found" }, { status: 404 });
    }

    return Response.json({ expense });
  } catch (error) {
    return jsonError("Unable to load expense", error, 500);
  }
}

export async function PUT(req, { params }) {
  try {
    const auth = requireTenantSession(req, "accounts.manage");
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "accounts.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { id } = await params;
    const body = await req.json();
    const { ExpenseEntry } = await getTenantModels(auth.tenantId);

    const expense = await ExpenseEntry.findById(id);
    if (!expense) {
      return Response.json({ error: "Expense not found" }, { status: 404 });
    }

    if (body.category !== undefined) {
      if (!expenseAccountByCategory[body.category]) {
        return Response.json({ error: "Invalid category" }, { status: 400 });
      }
      expense.category = clean(body.category);
    }
    if (body.vendorName !== undefined) {
      const vn = clean(body.vendorName);
      if (!vn) return Response.json({ error: "Vendor name is required" }, { status: 400 });
      if (vn.length < 3) return Response.json({ error: "Vendor name must be at least 3 characters" }, { status: 400 });
      if (vn.length > 30) return Response.json({ error: "Vendor name must be 30 characters or less" }, { status: 400 });
      if (hasUrl(vn)) return Response.json({ error: "URLs are not allowed in vendor name" }, { status: 400 });
      if (!isValidName(vn)) return Response.json({ error: "Vendor name contains invalid characters" }, { status: 400 });
      expense.vendorName = vn;
    }
    if (body.amount !== undefined) {
      if (body.amount === null || body.amount === "") {
        return Response.json({ error: "Amount is required" }, { status: 400 });
      }
      if (isExponentialNotation(String(body.amount))) {
        return Response.json({ error: "Exponential notation is not allowed in amount" }, { status: 400 });
      }
      const amount = money(body.amount);
      if (amount <= 0) return Response.json({ error: "Amount must be greater than zero" }, { status: 400 });
      const maxAllowed = 9999999;
      if (amount > maxAllowed) return Response.json({ error: `Amount cannot exceed Rs ${maxAllowed.toLocaleString("en-IN")}` }, { status: 400 });
      expense.amount = amount;
    }
    if (body.taxAmount !== undefined) {
      if (body.taxAmount === null || body.taxAmount === "") {
        return Response.json({ error: "Tax amount is required" }, { status: 400 });
      }
      if (isExponentialNotation(String(body.taxAmount))) {
        return Response.json({ error: "Exponential notation is not allowed in tax amount" }, { status: 400 });
      }
      expense.taxAmount = Math.max(0, money(body.taxAmount));
    }
    if (body.paidFrom !== undefined) {
      if (!["cash", "bank", "vendor-payable"].includes(body.paidFrom)) {
        return Response.json({ error: "Invalid paidFrom value" }, { status: 400 });
      }
      expense.paidFrom = body.paidFrom;
    }
    if (body.date !== undefined) {
      const parsed = new Date(body.date);
      if (!Number.isNaN(parsed.getTime())) expense.date = parsed;
    }

    await expense.save();

    await writeAuditLog(req, auth, {
      action: "expense.updated",
      resourceType: "ExpenseEntry",
      resourceId: expense._id,
      metadata: { category: expense.category, amount: expense.amount },
    });

    return Response.json({ expense });
  } catch (error) {
    return jsonError("Unable to update expense", error, 500);
  }
}

export async function DELETE(req, { params }) {
  try {
    const auth = requireTenantSession(req, "accounts.manage");
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "accounts.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { id } = await params;
    const { ExpenseEntry } = await getTenantModels(auth.tenantId);

    const expense = await ExpenseEntry.findById(id);
    if (!expense) {
      return Response.json({ error: "Expense not found" }, { status: 404 });
    }

    if (expense.journalEntryId) {
      return Response.json({ error: "Cannot delete expense with linked journal entry. Reverse it instead." }, { status: 400 });
    }

    await ExpenseEntry.deleteOne({ _id: id });

    await writeAuditLog(req, auth, {
      action: "expense.deleted",
      resourceType: "ExpenseEntry",
      resourceId: id,
      metadata: { category: expense.category, amount: expense.amount },
    });

    return Response.json({ message: "Expense deleted successfully" });
  } catch (error) {
    return jsonError("Unable to delete expense", error, 500);
  }
}
