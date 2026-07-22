import mongoose from "mongoose";
import { postJournalEntry } from "@/app/lib/accounting";
import { jsonError } from "@/app/lib/api-response";
import { getTenantModels } from "@/app/lib/tenant-db";
import { requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";
import { exportLedger } from "@/app/lib/excel-export";
import { exportLedgerPdf, generateCsv } from "@/app/lib/pdf-export";

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
    const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(250, Math.max(1, Number.parseInt(searchParams.get("limit") || "50", 10)));
    const exportFormat = searchParams.get("export");
    const query = { tenantId: auth.tenantId };

    if (sourceType && sourceType !== "all") query.sourceType = sourceType;
    if (accountId && mongoose.Types.ObjectId.isValid(accountId)) query["lines.accountId"] = accountId;
    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = from;
      if (to) query.date.$lte = to;
    }

    const { JournalEntry } = await getTenantModels(auth.tenantId);

    if (exportFormat) {
      const allEntries = await JournalEntry.find(query)
        .populate("lines.accountId", "code name type subtype")
        .populate("postedBy", "firstName lastName email userId")
        .sort({ date: -1, createdAt: -1 })
        .lean();

      if (exportFormat === "xlsx") {
        const buffer = await exportLedger(allEntries);
        return new Response(buffer, {
          headers: {
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": `attachment; filename="ledger.xlsx"`,
          },
        });
      }
      if (exportFormat === "pdf") {
        const buffer = await exportLedgerPdf(allEntries);
        return new Response(buffer, {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="ledger.pdf"`,
          },
        });
      }
      if (exportFormat === "csv") {
        const headers = ["Entry", "Date", "Account", "Debit", "Credit", "Source", "Description"];
        const csvRows = [];
        for (const entry of allEntries) {
          for (let i = 0; i < (entry.lines || []).length; i++) {
            const line = entry.lines[i];
            csvRows.push([
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
        const buffer = generateCsv(headers, csvRows);
        return new Response(buffer, {
          headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": `attachment; filename="ledger.csv"`,
          },
        });
      }
    }

    const [journalEntries, total] = await Promise.all([
      JournalEntry.find(query)
        .populate("lines.accountId", "code name type subtype")
        .populate("postedBy", "firstName lastName email userId")
        .sort({ date: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      JournalEntry.countDocuments(query),
    ]);

    return Response.json({
      journalEntries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
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
    if (description.length > 150) {
      return Response.json({ error: "Description must be 150 characters or less" }, { status: 400 });
    }
    if (lines.length > 20) {
      return Response.json({ error: "Journal entry cannot exceed 20 lines" }, { status: 400 });
    }
    if (body.date) {
      const entryDate = new Date(body.date);
      const tomorrow = new Date();
      tomorrow.setHours(23, 59, 59, 999);
      if (!Number.isNaN(entryDate.getTime()) && entryDate > tomorrow) {
        return Response.json({ error: "Date cannot be in the future" }, { status: 400 });
      }
    }

    const normalizedLines = lines.map((line) => ({
      accountId: clean(line.accountId),
      debit: money(line.debit),
      credit: money(line.credit),
    }));

    if (normalizedLines.some((line) => !mongoose.Types.ObjectId.isValid(line.accountId))) {
      return Response.json({ error: "Every line must have a valid account" }, { status: 400 });
    }

    const hasInvalidLine = normalizedLines.some(
      (line) => (line.debit > 0 && line.credit > 0) || (line.debit === 0 && line.credit === 0)
    );
    if (hasInvalidLine) {
      return Response.json({ error: "Each journal line must have either debit or credit (not both)" }, { status: 400 });
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
