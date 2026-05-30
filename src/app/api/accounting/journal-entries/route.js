import mongoose from "mongoose";
import { postJournalEntry } from "@/app/lib/accounting";
import { jsonError } from "@/app/lib/api-response";
import { getTenantModels } from "@/app/lib/tenant-db";
import { requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";

function clean(value) {
  return String(value || "").trim();
}

function money(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function dateValue(value) {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export async function GET(req) {
  try {
    const auth = requireTenantSession(req, "accounts.view");
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "accounts.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { searchParams } = new URL(req.url);
    const sourceType = clean(searchParams.get("sourceType"));
    const accountId = clean(searchParams.get("accountId"));
    const from = dateValue(searchParams.get("from"));
    const to = dateValue(searchParams.get("to"));
    const query = { tenantId: auth.tenantId };

    if (sourceType && sourceType !== "all") query.sourceType = sourceType;
    if (accountId && mongoose.Types.ObjectId.isValid(accountId)) query["lines.accountId"] = accountId;
    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = from;
      if (to) query.date.$lte = to;
    }

    const { JournalEntry } = await getTenantModels(auth.tenantId);
    const journalEntries = await JournalEntry.find(query)
      .populate("lines.accountId", "code name type subtype")
      .populate("postedBy", "firstName lastName email userId")
      .sort({ date: -1, createdAt: -1 })
      .limit(250)
      .lean();

    return Response.json({ journalEntries });
  } catch (error) {
    return jsonError("Unable to load journal entries", error, 500);
  }
}

export async function POST(req) {
  try {
    const auth = requireTenantSession(req, "accounts.manage");
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "accounts.view");
    if (moduleAuth.error) return moduleAuth.error;

    const body = await req.json();
    const description = clean(body.description);
    const lines = Array.isArray(body.lines) ? body.lines : [];

    if (!description || lines.length < 2) {
      return Response.json({ error: "Description and at least two journal lines are required" }, { status: 400 });
    }

    const normalizedLines = lines.map((line) => ({
      accountId: clean(line.accountId),
      debit: money(line.debit),
      credit: money(line.credit),
    }));

    if (normalizedLines.some((line) => !mongoose.Types.ObjectId.isValid(line.accountId))) {
      return Response.json({ error: "Every line must have a valid account" }, { status: 400 });
    }

    const debitTotal = money(normalizedLines.reduce((sum, line) => sum + line.debit, 0));
    const creditTotal = money(normalizedLines.reduce((sum, line) => sum + line.credit, 0));

    if (debitTotal !== creditTotal || debitTotal <= 0) {
      return Response.json({ error: "Journal entry must balance to zero" }, { status: 400 });
    }

    const { connection } = await getTenantModels(auth.tenantId);
    const journalEntry = await postJournalEntry(connection, {
      tenantId: auth.tenantId,
      postedBy: auth.session.userId,
      date: dateValue(body.date) || new Date(),
      description,
      sourceType: "manual",
      lines: normalizedLines,
    });

    return Response.json({ journalEntry }, { status: 201 });
  } catch (error) {
    return jsonError("Unable to post journal entry", error, 500);
  }
}
