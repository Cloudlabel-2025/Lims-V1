import { jsonError } from "@/app/lib/api-response";
import { getTenantModels } from "@/app/lib/tenant-db";
import { requireTenantSession } from "@/app/lib/auth";

export async function GET(req, { params }) {
  try {
    let auth = requireTenantSession(req, "accounts.view");
    if (auth.error) {
      auth = requireTenantSession(req, "billing.view");
    }
    if (auth.error) {
      auth = requireTenantSession(req, "corporate_accounts.view");
    }
    if (auth.error) return auth.error;

    const { id } = await params;

    const { CorporateAccount, BillingRecord } = await getTenantModels(auth.tenantId);
    const account = await CorporateAccount.findById(id);
    if (!account) return Response.json({ error: "Corporate account not found" }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const fromStr = searchParams.get("from");
    const toStr = searchParams.get("to");
    const exportFormat = searchParams.get("export");

    let fromDate = null;
    let toDate = null;
    if (fromStr) {
      const d = new Date(fromStr);
      if (!Number.isNaN(d.getTime())) {
        d.setHours(0, 0, 0, 0);
        fromDate = d;
      }
    }
    if (toStr) {
      const d = new Date(toStr);
      if (!Number.isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        toDate = d;
      }
    }

    const allTransactions = await BillingRecord.find({
      tenantId: auth.tenantId,
      $or: [
        { corporateAccount: account._id },
        { "paymentMeta.corporateAccountId": account._id },
      ],
    })
      .select("billId receiptNumber totalAmount totalPaid dueAmount paymentBreakdown paymentMeta status paymentMethod createdAt")
      .sort({ createdAt: 1 })
      .lean();

    let openingBalance = 0;
    let periodBilled = 0;
    let periodPaid = 0;
    const periodTransactions = [];

    for (const b of allTransactions) {
      const txDate = new Date(b.createdAt);
      const billed = Number(b.paymentBreakdown?.corporate ?? b.paymentMeta?.corporateAmount ?? b.totalAmount ?? 0);
      const paid = Number(b.totalPaid ?? (billed - Number(b.dueAmount ?? 0)));
      const balance = Math.max(0, billed - paid);

      if (fromDate && txDate < fromDate) {
        // Prior to period: contributes to opening balance
        openingBalance += (billed - paid);
      } else if (!toDate || txDate <= toDate) {
        // Inside period
        periodBilled += billed;
        periodPaid += paid;
        periodTransactions.push({
          id: b._id,
          billId: b.billId || "-",
          receiptNumber: b.receiptNumber || "-",
          date: b.createdAt,
          amount: billed,
          paid,
          balance,
          status: b.status,
          paymentMethod: b.paymentMethod,
        });
      }
    }

    openingBalance = Math.round(Math.max(0, openingBalance) * 100) / 100;
    periodBilled = Math.round(periodBilled * 100) / 100;
    periodPaid = Math.round(periodPaid * 100) / 100;
    const closingBalance = Math.round((openingBalance + periodBilled - periodPaid) * 100) / 100;

    // Sort descending for display
    periodTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (exportFormat === "csv") {
      const headers = ["Date", "Bill ID", "Receipt #", "Billed Amount", "Paid Amount", "Balance", "Status"];
      const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const rows = [
        headers.map(escape).join(","),
        [`"Opening Balance"`, `""`, `""`, `""`, `""`, openingBalance, `""`].join(","),
        ...periodTransactions.map((t) => [
          escape(new Date(t.date).toLocaleDateString("en-IN")),
          escape(t.billId),
          escape(t.receiptNumber),
          t.amount,
          t.paid,
          t.balance,
          escape(t.status),
        ].join(",")),
        [`"Total / Closing"`, `""`, `""`, periodBilled, periodPaid, closingBalance, `""`].join(","),
      ];
      return new Response("\uFEFF" + rows.join("\r\n"), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="corporate-statement-${account.accountCode || id}.csv"`,
        },
      });
    }

    return Response.json({
      account: {
        name: account.name,
        accountCode: account.accountCode,
        creditLimit: account.creditLimit,
        outstandingBalance: account.outstandingBalance,
        status: account.status,
      },
      summary: {
        openingBalance,
        periodBilled,
        periodPaid,
        closingBalance,
        totalOutstanding: account.outstandingBalance,
      },
      dateRange: {
        from: fromStr || null,
        to: toStr || null,
      },
      transactions: periodTransactions,
      totalOutstanding: account.outstandingBalance,
    });
  } catch (error) {
    return jsonError("Unable to fetch statement", error, 500);
  }
}
