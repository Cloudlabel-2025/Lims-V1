import { jsonError } from "@/app/lib/api-response";
import { getTenantModels } from "@/app/lib/tenant-db";
import { requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";
import { exportDashboardSummary } from "@/app/lib/excel-export";
import { exportDashboardPdf, generateCsv } from "@/app/lib/pdf-export";

export async function GET(req) {
  try {
    const auth = requireTenantSession(req, "accounts.view");
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "accounts.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { searchParams } = new URL(req.url);
    const exportFormat = searchParams.get("export");

    if (!exportFormat) {
      return jsonError("Export format is required (xlsx, pdf, csv)", null, 400);
    }

    const { Account, BillingRecord } = await getTenantModels(auth.tenantId);

    const [accounts, recentBills] = await Promise.all([
      Account.find({ tenantId: auth.tenantId }).sort({ code: 1 }).lean(),
      BillingRecord.find({ tenantId: auth.tenantId })
        .sort({ createdAt: -1 })
        .limit(50)
        .populate("patient", "name patientId")
        .lean(),
    ]);

    if (exportFormat === "xlsx") {
      const buffer = await exportDashboardSummary(accounts, recentBills);
      return new Response(buffer, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": 'attachment; filename="accounts-dashboard.xlsx"',
        },
      });
    }

    if (exportFormat === "pdf") {
      const buffer = await exportDashboardPdf(accounts, recentBills);
      return new Response(buffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": 'attachment; filename="accounts-dashboard.pdf"',
        },
      });
    }

    if (exportFormat === "csv") {
      const totals = { asset: 0, liability: 0, revenue: 0, expense: 0 };
      for (const a of accounts) {
        totals[a.type] = (totals[a.type] || 0) + Number(a.balance || 0);
      }
      const balanceHeaders = ["Type", "Total Balance"];
      const balanceRows = Object.entries(totals).map(([type, total]) => [
        type.charAt(0).toUpperCase() + type.slice(1),
        String(total),
      ]);

      const billHeaders = ["Bill ID", "Patient", "Amount", "Paid", "Status", "Date"];
      const billRows = recentBills.map((b) => [
        b.billId || "-",
        b.patient?.name || "-",
        String(b.totalAmount),
        String(b.totalPaid || 0),
        b.billingStatus || "-",
        b.createdAt ? new Date(b.createdAt).toLocaleDateString("en-IN") : "",
      ]);

      const csv = generateCsv(balanceHeaders, balanceRows) + "\n\n" + generateCsv(billHeaders, billRows);
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="accounts-dashboard.csv"',
        },
      });
    }

    return jsonError("Invalid export format", null, 400);
  } catch (error) {
    return jsonError("Unable to load dashboard export", error, 500);
  }
}
